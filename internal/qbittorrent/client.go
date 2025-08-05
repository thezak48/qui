package qbittorrent

import (
	"context"
	"fmt"
	"sync"
	"time"

	qbt "github.com/autobrr/go-qbittorrent"
)

// Client wraps the qBittorrent client with additional functionality
type Client struct {
	*qbt.Client
	instanceID      int
	lastHealthCheck time.Time
	isHealthy       bool
	mu              sync.RWMutex
}

// NewClient creates a new qBittorrent client wrapper
func NewClient(instanceID int, host string, port int, username, password string) (*Client, error) {
	// Create the base client
	cfg := qbt.Config{
		Host:      fmt.Sprintf("%s:%d", host, port),
		Username:  username,
		Password:  password,
		BasicUser: username,
		BasicPass: password,
		Timeout:   30, // timeout in seconds
	}

	qbtClient := qbt.NewClient(cfg)

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := qbtClient.LoginCtx(ctx); err != nil {
		return nil, fmt.Errorf("failed to connect to qBittorrent instance: %w", err)
	}

	client := &Client{
		Client:          qbtClient,
		instanceID:      instanceID,
		lastHealthCheck: time.Now(),
		isHealthy:       true,
	}

	return client, nil
}

// GetInstanceID returns the instance ID associated with this client
func (c *Client) GetInstanceID() int {
	return c.instanceID
}

// IsHealthy returns whether the client connection is healthy
func (c *Client) IsHealthy() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.isHealthy
}

// SetHealthy updates the health status of the client
func (c *Client) SetHealthy(healthy bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.isHealthy = healthy
	c.lastHealthCheck = time.Now()
}

// HealthCheck performs a health check on the qBittorrent connection
func (c *Client) HealthCheck(ctx context.Context) error {
	// Try to login again as a health check
	if err := c.Client.LoginCtx(ctx); err != nil {
		c.SetHealthy(false)
		return fmt.Errorf("health check failed: %w", err)
	}

	c.SetHealthy(true)
	return nil
}

// GetLastHealthCheck returns the time of the last health check
func (c *Client) GetLastHealthCheck() time.Time {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.lastHealthCheck
}
