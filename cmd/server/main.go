package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"github.com/spf13/cobra"

	"github.com/autobrr/qbitweb/internal/api"
	"github.com/autobrr/qbitweb/internal/auth"
	"github.com/autobrr/qbitweb/internal/config"
	"github.com/autobrr/qbitweb/internal/database"
	"github.com/autobrr/qbitweb/internal/models"
	"github.com/autobrr/qbitweb/internal/polar"
	"github.com/autobrr/qbitweb/internal/qbittorrent"
	"github.com/autobrr/qbitweb/internal/services"
	"github.com/autobrr/qbitweb/internal/web"
)

var (
	Version = "dev"
	cfgFile string

	// Publisher credentials - set during build via ldflags
	PolarAccessToken = ""           // Set via: -X main.PolarAccessToken=your-token
	PolarOrgID       = ""           // Set via: -X main.PolarOrgID=your-org-id
	PolarEnvironment = "production" // Set via: -X main.PolarEnvironment=production
)

var rootCmd = &cobra.Command{
	Use:   "qbitweb",
	Short: "A self-hosted qBittorrent WebUI alternative",
	Long: `qBittorrent WebUI - A modern, self-hosted web interface for managing 
multiple qBittorrent instances with support for 10k+ torrents.`,
	Run: func(cmd *cobra.Command, args []string) {
		// Start the server
		runServer()
	},
}

func init() {
	cobra.OnInitialize(initConfig)
	rootCmd.PersistentFlags().StringVar(&cfgFile, "config", "", "config file (default is $HOME/.qbitweb/config.toml)")
	rootCmd.Version = Version
}

func initConfig() {
	// Initialize logger
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})

	// Config initialization will be implemented later
}

func runServer() {
	log.Info().Str("version", Version).Msg("Starting qBittorrent WebUI")

	// Initialize configuration
	cfg, err := config.New(cfgFile)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to initialize configuration")
	}

	// Initialize database
	db, err := database.New(cfg.Config.DatabasePath)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to initialize database")
	}
	defer db.Close()

	// Initialize services
	authService := auth.NewService(db.Conn(), cfg.Config.SessionSecret)

	// Initialize stores
	instanceStore, err := models.NewInstanceStore(db.Conn(), cfg.GetEncryptionKey())
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to initialize instance store")
	}

	// Initialize qBittorrent client pool
	clientPool, err := qbittorrent.NewClientPool(instanceStore)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to initialize client pool")
	}
	defer clientPool.Close()

	// Initialize sync manager
	syncManager := qbittorrent.NewSyncManager(clientPool)

	// Initialize web handler (for embedded frontend)
	webHandler, err := web.NewHandler(Version, cfg.Config.BaseURL)
	if err != nil {
		log.Warn().Err(err).Msg("Failed to initialize web handler")
	}

	// Initialize Polar client and theme license service
	var themeLicenseService *services.ThemeLicenseService

	// Use ONLY the baked-in credentials from build time
	if PolarAccessToken != "" && PolarOrgID != "" {
		// Production: Use baked-in publisher credentials
		log.Trace().
			Msg("Initializing Polar SDK")

		polarClient := polar.NewClient(PolarAccessToken, PolarEnvironment)
		polarClient.SetOrganizationID(PolarOrgID)

		// Test the connection
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		if err := polarClient.ValidateConfiguration(ctx); err != nil {
			log.Error().Err(err).Msg("Failed to validate Polar configuration")
			// Continue with the configured client even if validation fails
			// This allows the service to start but theme licensing will fail gracefully
		}

		themeLicenseService = services.NewThemeLicenseService(db, polarClient)
		log.Info().Msg("Theme licensing service initialized (production mode)")
	} else {
		// No credentials: Premium themes will not be available
		log.Warn().Msg("No Polar credentials configured - premium themes will be disabled")

		// Create a client with empty credentials
		// All license validations will fail, which is the expected behavior
		polarClient := polar.NewClient("", "production")
		polarClient.SetOrganizationID("")

		themeLicenseService = services.NewThemeLicenseService(db, polarClient)
		log.Info().Msg("Theme licensing service initialized (no credentials mode)")
	}

	// Create router dependencies
	deps := &api.Dependencies{
		Config:              cfg,
		DB:                  db.Conn(),
		AuthService:         authService,
		InstanceStore:       instanceStore,
		ClientPool:          clientPool,
		SyncManager:         syncManager,
		WebHandler:          webHandler,
		ThemeLicenseService: themeLicenseService,
	}

	// Initialize router
	router := api.NewRouter(deps)

	// Create HTTP server
	srv := &http.Server{
		Addr:         fmt.Sprintf("%s:%d", cfg.Config.Host, cfg.Config.Port),
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in goroutine
	go func() {
		log.Info().Str("address", srv.Addr).Msg("Starting HTTP server")
		if cfg.Config.BaseURL != "" {
			log.Info().Str("baseURL", cfg.Config.BaseURL).Msg("Serving under base URL")
		}

		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("Server failed")
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Info().Msg("Shutting down server...")

	// Graceful shutdown with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal().Err(err).Msg("Server forced to shutdown")
	}

	log.Info().Msg("Server stopped")
}

func main() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
