package config

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"text/template"

	"github.com/fsnotify/fsnotify"
	"github.com/rs/zerolog/log"
	"github.com/spf13/viper"
	"github.com/s0up4200/qbitweb/internal/domain"
)

type AppConfig struct {
	Config *domain.Config
	viper  *viper.Viper
}

func New(configPath string) (*AppConfig, error) {
	c := &AppConfig{
		viper:  viper.New(),
		Config: &domain.Config{},
	}

	// Set defaults
	c.defaults()

	// Load from config file
	if err := c.load(configPath); err != nil {
		return nil, err
	}

	// Override with environment variables
	c.loadFromEnv()

	// Unmarshal the configuration
	if err := c.viper.Unmarshal(c.Config); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	// Watch for config changes
	c.watchConfig()

	return c, nil
}

func (c *AppConfig) defaults() {
	// Detect if running in container
	host := "localhost"
	if detectContainer() {
		host = "0.0.0.0"
	}

	// Generate secure session secret if not provided
	sessionSecret := generateSecureToken(32)

	c.viper.SetDefault("host", host)
	c.viper.SetDefault("port", 8080)
	c.viper.SetDefault("baseUrl", "")
	c.viper.SetDefault("sessionSecret", sessionSecret)
	c.viper.SetDefault("logLevel", "INFO")
	c.viper.SetDefault("logPath", "")
	c.viper.SetDefault("databasePath", "./data/qbitweb.db")
}

func (c *AppConfig) load(configPath string) error {
	c.viper.SetConfigType("toml")

	if configPath != "" {
		// Use provided config path
		if err := c.writeDefaultConfig(filepath.Join(configPath, "config.toml")); err != nil {
			return err
		}
		c.viper.SetConfigFile(filepath.Join(configPath, "config.toml"))
	} else {
		// Search for config in standard locations
		c.viper.SetConfigName("config")
		c.viper.AddConfigPath(".")
		c.viper.AddConfigPath("$HOME/.config/qbitweb")
		c.viper.AddConfigPath("$HOME/.qbitweb")

		// Create default config if doesn't exist
		if err := c.writeDefaultConfig("config.toml"); err != nil {
			return err
		}
	}

	if err := c.viper.ReadInConfig(); err != nil {
		// It's okay if config doesn't exist, we'll use defaults
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return fmt.Errorf("failed to read config: %w", err)
		}
	}

	return nil
}

func (c *AppConfig) loadFromEnv() {
	// Enable environment variable support
	c.viper.SetEnvPrefix("QBITWEB")
	c.viper.SetEnvKeyReplacer(strings.NewReplacer(".", "__"))
	c.viper.AutomaticEnv()
}

func (c *AppConfig) watchConfig() {
	c.viper.WatchConfig()
	c.viper.OnConfigChange(func(e fsnotify.Event) {
		log.Info().Msgf("Config file changed: %s", e.Name)

		// Reload configuration
		if err := c.viper.Unmarshal(c.Config); err != nil {
			log.Error().Err(err).Msg("Failed to reload configuration")
			return
		}

		// Apply dynamic changes
		c.applyDynamicChanges()
	})
}

func (c *AppConfig) applyDynamicChanges() {
	// Update log level dynamically
	setLogLevel(c.Config.LogLevel)

	// Update log output if path changed
	if c.Config.LogPath != "" {
		if err := setupLogFile(c.Config.LogPath); err != nil {
			log.Error().Err(err).Msg("Failed to update log file")
		}
	}
}

func (c *AppConfig) writeDefaultConfig(path string) error {
	// Check if config already exists
	if _, err := os.Stat(path); err == nil {
		return nil
	}

	// Ensure directory exists
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create config directory: %w", err)
	}

	// Create config template
	configTemplate := `# config.toml - Auto-generated on first run

# Hostname / IP
# Default: "localhost" (or "0.0.0.0" in containers)
host = "{{ .host }}"

# Port
# Default: 8080
port = {{ .port }}

# Base URL
# Set custom baseUrl eg /qbitweb/ to serve in subdirectory.
# Not needed for subdomain, or by accessing with :port directly.
# Optional
#baseUrl = "/qbitweb/"

# Session secret
# Auto-generated if not provided
sessionSecret = "{{ .sessionSecret }}"

# Database path
# Default: "./data/qbitweb.db"
databasePath = "{{ .databasePath }}"

# Log file path
# If not defined, logs to stdout
# Optional
#logPath = "log/qbitweb.log"

# Log level
# Default: "INFO"
# Options: "ERROR", "DEBUG", "INFO", "WARN", "TRACE"
logLevel = "{{ .logLevel }}"
`

	// Prepare template data
	data := map[string]interface{}{
		"host":          c.viper.GetString("host"),
		"port":          c.viper.GetInt("port"),
		"sessionSecret": c.viper.GetString("sessionSecret"),
		"databasePath":  c.viper.GetString("databasePath"),
		"logLevel":      c.viper.GetString("logLevel"),
	}

	// Parse and execute template
	tmpl, err := template.New("config").Parse(configTemplate)
	if err != nil {
		return fmt.Errorf("failed to parse config template: %w", err)
	}

	// Create config file
	f, err := os.Create(path)
	if err != nil {
		return fmt.Errorf("failed to create config file: %w", err)
	}
	defer f.Close()

	if err := tmpl.Execute(f, data); err != nil {
		return fmt.Errorf("failed to write config file: %w", err)
	}

	log.Info().Msgf("Created default config file: %s", path)
	return nil
}

// Helper functions

func detectContainer() bool {
	// Check Docker
	if _, err := os.Stat("/.dockerenv"); err == nil {
		return true
	}
	// Check LXC
	if _, err := os.Stat("/dev/.lxc-boot-id"); err == nil {
		return true
	}
	// Check if running as init
	if os.Getpid() == 1 {
		return true
	}
	return false
}

func generateSecureToken(length int) string {
	bytes := make([]byte, length)
	if _, err := rand.Read(bytes); err != nil {
		// Fallback to a less secure method if crypto/rand fails
		log.Warn().Err(err).Msg("Failed to generate secure token, using fallback")
		return "change-me-" + fmt.Sprintf("%d", os.Getpid())
	}
	return hex.EncodeToString(bytes)
}

func setLogLevel(level string) {
	switch strings.ToUpper(level) {
	case "TRACE":
		log.Logger = log.Level(5)
	case "DEBUG":
		log.Logger = log.Level(0)
	case "INFO":
		log.Logger = log.Level(1)
	case "WARN":
		log.Logger = log.Level(2)
	case "ERROR":
		log.Logger = log.Level(3)
	default:
		log.Logger = log.Level(1) // Default to INFO
	}
}

func setupLogFile(path string) error {
	// Create log directory if needed
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create log directory: %w", err)
	}

	// Open log file
	f, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		return fmt.Errorf("failed to open log file: %w", err)
	}

	// Update logger output
	log.Logger = log.Output(f)
	return nil
}

// GetEncryptionKey derives a 32-byte encryption key from the session secret
func (c *AppConfig) GetEncryptionKey() []byte {
	// Use first 32 bytes of session secret as encryption key
	// In production, you might want to derive this differently
	secret := c.Config.SessionSecret
	if len(secret) >= 32 {
		return []byte(secret[:32])
	}

	// Pad the secret if it's too short
	padded := make([]byte, 32)
	copy(padded, []byte(secret))
	return padded
}