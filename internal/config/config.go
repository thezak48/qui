package config

import (
	"github.com/spf13/viper"
)

type Config struct {
	Host          string `mapstructure:"host"`
	Port          int    `mapstructure:"port"`
	BaseURL       string `mapstructure:"baseUrl"`
	SessionSecret string `mapstructure:"sessionSecret"`
	LogLevel      string `mapstructure:"logLevel"`
	LogPath       string `mapstructure:"logPath"`
	DatabasePath  string `mapstructure:"databasePath"`
}

type AppConfig struct {
	Config *Config
	viper  *viper.Viper
}

func New(configPath string) (*AppConfig, error) {
	c := &AppConfig{
		viper: viper.New(),
		Config: &Config{},
	}
	
	// Set defaults
	c.defaults()
	
	return c, nil
}

func (c *AppConfig) defaults() {
	c.viper.SetDefault("host", "localhost")
	c.viper.SetDefault("port", 8080)
	c.viper.SetDefault("logLevel", "INFO")
	c.viper.SetDefault("databasePath", "./data/qbitweb.db")
}