package web

import (
	"embed"
	"io"
	"io/fs"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog/log"
)

//go:embed dist/*
var embedFS embed.FS

type Handler struct {
	fs      fs.FS
	baseURL string
	version string
}

func NewHandler(version, baseURL string) (*Handler, error) {
	// Get the dist subdirectory
	distFS, err := fs.Sub(embedFS, "dist")
	if err != nil {
		// If dist doesn't exist yet (development), return a handler that serves 404
		log.Warn().Msg("Frontend dist directory not found, web UI will not be available")
		return &Handler{
			fs:      nil,
			baseURL: baseURL,
			version: version,
		}, nil
	}

	return &Handler{
		fs:      distFS,
		baseURL: baseURL,
		version: version,
	}, nil
}

func (h *Handler) RegisterRoutes(r chi.Router) {
	if h.fs == nil {
		// No frontend available
		r.Get("/*", func(w http.ResponseWriter, r *http.Request) {
			http.Error(w, "Frontend not built. Run 'make frontend' to build the web UI.", http.StatusNotFound)
		})
		return
	}

	// Serve static assets
	fileServer := http.FileServer(http.FS(h.fs))
	r.Handle("/assets/*", fileServer)

	// SPA catch-all route
	r.Get("/*", h.serveSPA)
}

func (h *Handler) serveSPA(w http.ResponseWriter, r *http.Request) {
	// Always serve index.html for SPA routes
	file, err := h.fs.Open("index.html")
	if err != nil {
		http.Error(w, "Not found", http.StatusNotFound)
		return
	}
	defer file.Close()

	stat, err := file.Stat()
	if err != nil {
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}

	// Serve the file
	http.ServeContent(w, r, "index.html", stat.ModTime(), file.(io.ReadSeeker))
}
