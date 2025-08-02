package api

import (
	"database/sql"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/s0up4200/qbitweb/internal/api/handlers"
	apimiddleware "github.com/s0up4200/qbitweb/internal/api/middleware"
	"github.com/s0up4200/qbitweb/internal/auth"
	"github.com/s0up4200/qbitweb/internal/config"
	"github.com/s0up4200/qbitweb/internal/models"
	"github.com/s0up4200/qbitweb/internal/qbittorrent"
	"github.com/s0up4200/qbitweb/internal/web"
)

// Dependencies holds all the dependencies needed for the API
type Dependencies struct {
	Config        *config.AppConfig
	DB            *sql.DB
	AuthService   *auth.Service
	InstanceStore *models.InstanceStore
	ClientPool    *qbittorrent.ClientPool
	SyncManager   *qbittorrent.SyncManager
	WebHandler    *web.Handler
}

// NewRouter creates and configures the main application router
func NewRouter(deps *Dependencies) *chi.Mux {
	r := chi.NewRouter()

	// Global middleware
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Compress(5))
	
	// CORS - configure based on your needs
	allowedOrigins := []string{"http://localhost:3000", "http://localhost:5173"}
	if deps.Config.Config.BaseURL != "" {
		allowedOrigins = append(allowedOrigins, deps.Config.Config.BaseURL)
	}
	r.Use(apimiddleware.CORSWithCredentials(allowedOrigins))

	// Create handlers
	authHandler := handlers.NewAuthHandler(deps.AuthService)
	instancesHandler := handlers.NewInstancesHandler(deps.InstanceStore, deps.ClientPool)
	torrentsHandler := handlers.NewTorrentsHandler(deps.SyncManager)

	// API routes
	r.Route("/api", func(r chi.Router) {
		// Apply setup check middleware
		r.Use(apimiddleware.RequireSetup(deps.AuthService))

		// Public routes (no auth required)
		r.Route("/auth", func(r chi.Router) {
			r.Post("/setup", authHandler.Setup)
			r.Post("/login", authHandler.Login)
		})

		// Protected routes
		r.Group(func(r chi.Router) {
			r.Use(apimiddleware.IsAuthenticated(deps.AuthService))

			// Auth routes
			r.Post("/auth/logout", authHandler.Logout)
			r.Get("/auth/me", authHandler.GetCurrentUser)
			r.Put("/auth/change-password", authHandler.ChangePassword)
			
			// API key management
			r.Route("/api-keys", func(r chi.Router) {
				r.Get("/", authHandler.ListAPIKeys)
				r.Post("/", authHandler.CreateAPIKey)
				r.Delete("/{id}", authHandler.DeleteAPIKey)
			})

			// Instance management
			r.Route("/instances", func(r chi.Router) {
				r.Get("/", instancesHandler.ListInstances)
				r.Post("/", instancesHandler.CreateInstance)
				
				r.Route("/{instanceID}", func(r chi.Router) {
					r.Put("/", instancesHandler.UpdateInstance)
					r.Delete("/", instancesHandler.DeleteInstance)
					r.Post("/test", instancesHandler.TestConnection)
					r.Get("/stats", instancesHandler.GetInstanceStats)

					// Torrent operations
					r.Route("/torrents", func(r chi.Router) {
						r.Get("/", torrentsHandler.ListTorrents)
						r.Get("/sync", torrentsHandler.SyncTorrents)
						r.Get("/filter", torrentsHandler.GetFilteredTorrents)
						r.Post("/", torrentsHandler.AddTorrent)
						r.Post("/bulk-action", torrentsHandler.BulkAction)
						
						r.Route("/{hash}", func(r chi.Router) {
							r.Delete("/", torrentsHandler.DeleteTorrent)
							r.Put("/pause", torrentsHandler.PauseTorrent)
							r.Put("/resume", torrentsHandler.ResumeTorrent)
						})
					})

					// Categories and tags
					r.Get("/categories", torrentsHandler.GetCategories)
					r.Get("/tags", torrentsHandler.GetTags)
				})
			})
		})
	})

	// Health check endpoint
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	})

	// Web UI routes (handled by the embedded frontend)
	if deps.WebHandler != nil {
		deps.WebHandler.RegisterRoutes(r)
	}

	return r
}