package main

import (
	"fmt"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"github.com/spf13/cobra"
	
	"github.com/s0up4200/qbitweb/internal/api"
	"github.com/s0up4200/qbitweb/internal/config"
	"github.com/s0up4200/qbitweb/internal/database"
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

	// Initialize router
	router := api.NewRouter()

	// Start server
	addr := fmt.Sprintf("%s:%d", cfg.Config.Host, cfg.Config.Port)
	log.Info().Str("address", addr).Msg("Starting HTTP server")
	
	if err := http.ListenAndServe(addr, router); err != nil {
		log.Fatal().Err(err).Msg("Server failed")
	}
}

func main() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}