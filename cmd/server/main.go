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
	
	"github.com/s0up4200/qbitweb/internal/api"
	"github.com/s0up4200/qbitweb/internal/auth"
	"github.com/s0up4200/qbitweb/internal/config"
	"github.com/s0up4200/qbitweb/internal/database"
	"github.com/s0up4200/qbitweb/internal/models"
	"github.com/s0up4200/qbitweb/internal/qbittorrent"
	"github.com/s0up4200/qbitweb/internal/web"
)

var (
	Version = "dev"
	cfgFile string
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

	// Create router dependencies
	deps := &api.Dependencies{
		Config:        cfg,
		DB:            db.Conn(),
		AuthService:   authService,
		InstanceStore: instanceStore,
		ClientPool:    clientPool,
		SyncManager:   syncManager,
		WebHandler:    webHandler,
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