package handlers

import (
	"encoding/json"
	"io"
	"net/http"
	"strconv"

	qbt "github.com/autobrr/go-qbittorrent"
	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog/log"
	"github.com/s0up4200/qbitweb/internal/qbittorrent"
)

type TorrentsHandler struct {
	syncManager *qbittorrent.SyncManager
}

func NewTorrentsHandler(syncManager *qbittorrent.SyncManager) *TorrentsHandler {
	return &TorrentsHandler{
		syncManager: syncManager,
	}
}

// ListTorrents returns paginated torrents for an instance
func (h *TorrentsHandler) ListTorrents(w http.ResponseWriter, r *http.Request) {
	// Get instance ID from URL
	instanceID, err := strconv.Atoi(chi.URLParam(r, "instanceID"))
	if err != nil {
		RespondError(w, http.StatusBadRequest, "Invalid instance ID")
		return
	}

	// Parse query parameters
	limit := 50
	page := 0
	sort := "addedOn"
	order := "desc"
	search := ""
	
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 1000 {
			limit = parsed
		}
	}
	
	if p := r.URL.Query().Get("page"); p != "" {
		if parsed, err := strconv.Atoi(p); err == nil && parsed >= 0 {
			page = parsed
		}
	}
	
	if s := r.URL.Query().Get("sort"); s != "" {
		sort = s
	}
	
	if o := r.URL.Query().Get("order"); o != "" {
		order = o
	}
	
	if q := r.URL.Query().Get("search"); q != "" {
		search = q
	}
	
	// Debug logging
	log.Debug().
		Str("sort", sort).
		Str("order", order).
		Int("page", page).
		Int("limit", limit).
		Str("search", search).
		Msg("Torrent list request parameters")

	// Calculate offset from page
	offset := page * limit

	// Get torrents with search and sorting
	response, err := h.syncManager.GetTorrentsWithSearch(r.Context(), instanceID, limit, offset, sort, order, search)
	if err != nil {
		log.Error().Err(err).Int("instanceID", instanceID).Msg("Failed to get torrents")
		RespondError(w, http.StatusInternalServerError, "Failed to get torrents")
		return
	}

	RespondJSON(w, http.StatusOK, response)
}

// SyncTorrents returns sync updates for an instance
func (h *TorrentsHandler) SyncTorrents(w http.ResponseWriter, r *http.Request) {
	// Get instance ID from URL
	instanceID, err := strconv.Atoi(chi.URLParam(r, "instanceID"))
	if err != nil {
		RespondError(w, http.StatusBadRequest, "Invalid instance ID")
		return
	}

	// Get sync updates
	mainData, err := h.syncManager.GetUpdates(r.Context(), instanceID)
	if err != nil {
		log.Error().Err(err).Int("instanceID", instanceID).Msg("Failed to sync torrents")
		RespondError(w, http.StatusInternalServerError, "Failed to sync torrents")
		return
	}

	RespondJSON(w, http.StatusOK, mainData)
}

// AddTorrentRequest represents a request to add a torrent
type AddTorrentRequest struct {
	Category     string   `json:"category,omitempty"`
	Tags         []string `json:"tags,omitempty"`
	StartPaused  bool     `json:"start_paused,omitempty"`
	SkipChecking bool     `json:"skip_checking,omitempty"`
	SavePath     string   `json:"save_path,omitempty"`
}

// AddTorrent adds a new torrent
func (h *TorrentsHandler) AddTorrent(w http.ResponseWriter, r *http.Request) {
	// Get instance ID from URL
	instanceID, err := strconv.Atoi(chi.URLParam(r, "instanceID"))
	if err != nil {
		RespondError(w, http.StatusBadRequest, "Invalid instance ID")
		return
	}

	// Parse multipart form
	err = r.ParseMultipartForm(32 << 20) // 32MB max
	if err != nil {
		RespondError(w, http.StatusBadRequest, "Failed to parse form data")
		return
	}

	// Get torrent file
	file, _, err := r.FormFile("torrent")
	if err != nil {
		RespondError(w, http.StatusBadRequest, "Torrent file is required")
		return
	}
	defer file.Close()

	// Read file content
	fileContent, err := io.ReadAll(file)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "Failed to read torrent file")
		return
	}

	// Parse options from form
	options := make(map[string]string)
	
	if category := r.FormValue("category"); category != "" {
		options["category"] = category
	}
	
	if tags := r.FormValue("tags"); tags != "" {
		options["tags"] = tags
	}
	
	if paused := r.FormValue("paused"); paused == "true" {
		options["paused"] = "true"
	}
	
	if skipChecking := r.FormValue("skip_checking"); skipChecking == "true" {
		options["skip_checking"] = "true"
	}
	
	if savePath := r.FormValue("savepath"); savePath != "" {
		options["savepath"] = savePath
	}

	// Add torrent
	if err := h.syncManager.AddTorrent(r.Context(), instanceID, fileContent, options); err != nil {
		log.Error().Err(err).Int("instanceID", instanceID).Msg("Failed to add torrent")
		RespondError(w, http.StatusInternalServerError, "Failed to add torrent")
		return
	}

	RespondJSON(w, http.StatusCreated, map[string]string{
		"message": "Torrent added successfully",
	})
}

// BulkActionRequest represents a bulk action request
type BulkActionRequest struct {
	Hashes []string `json:"hashes"`
	Action string   `json:"action"`
}

// BulkAction performs bulk operations on torrents
func (h *TorrentsHandler) BulkAction(w http.ResponseWriter, r *http.Request) {
	// Get instance ID from URL
	instanceID, err := strconv.Atoi(chi.URLParam(r, "instanceID"))
	if err != nil {
		RespondError(w, http.StatusBadRequest, "Invalid instance ID")
		return
	}

	var req BulkActionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Validate input
	if len(req.Hashes) == 0 {
		RespondError(w, http.StatusBadRequest, "No torrents selected")
		return
	}

	validActions := []string{
		"pause", "resume", "delete", "deleteWithFiles",
		"recheck", "reannounce", "increasePriority", "decreasePriority",
		"topPriority", "bottomPriority",
	}
	
	valid := false
	for _, action := range validActions {
		if req.Action == action {
			valid = true
			break
		}
	}
	
	if !valid {
		RespondError(w, http.StatusBadRequest, "Invalid action")
		return
	}

	// Perform bulk action
	if err := h.syncManager.BulkAction(r.Context(), instanceID, req.Hashes, req.Action); err != nil {
		log.Error().Err(err).Int("instanceID", instanceID).Str("action", req.Action).Msg("Failed to perform bulk action")
		RespondError(w, http.StatusInternalServerError, "Failed to perform bulk action")
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{
		"message": "Bulk action completed successfully",
	})
}

// Individual torrent actions

// DeleteTorrent deletes a single torrent
func (h *TorrentsHandler) DeleteTorrent(w http.ResponseWriter, r *http.Request) {
	// Get instance ID and hash from URL
	instanceID, err := strconv.Atoi(chi.URLParam(r, "instanceID"))
	if err != nil {
		RespondError(w, http.StatusBadRequest, "Invalid instance ID")
		return
	}

	hash := chi.URLParam(r, "hash")
	if hash == "" {
		RespondError(w, http.StatusBadRequest, "Torrent hash is required")
		return
	}

	// Check if files should be deleted
	deleteFiles := r.URL.Query().Get("deleteFiles") == "true"
	
	action := "delete"
	if deleteFiles {
		action = "deleteWithFiles"
	}

	// Delete torrent
	if err := h.syncManager.BulkAction(r.Context(), instanceID, []string{hash}, action); err != nil {
		log.Error().Err(err).Int("instanceID", instanceID).Str("hash", hash).Msg("Failed to delete torrent")
		RespondError(w, http.StatusInternalServerError, "Failed to delete torrent")
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{
		"message": "Torrent deleted successfully",
	})
}

// PauseTorrent pauses a single torrent
func (h *TorrentsHandler) PauseTorrent(w http.ResponseWriter, r *http.Request) {
	// Get instance ID and hash from URL
	instanceID, err := strconv.Atoi(chi.URLParam(r, "instanceID"))
	if err != nil {
		RespondError(w, http.StatusBadRequest, "Invalid instance ID")
		return
	}

	hash := chi.URLParam(r, "hash")
	if hash == "" {
		RespondError(w, http.StatusBadRequest, "Torrent hash is required")
		return
	}

	// Pause torrent
	if err := h.syncManager.BulkAction(r.Context(), instanceID, []string{hash}, "pause"); err != nil {
		log.Error().Err(err).Int("instanceID", instanceID).Str("hash", hash).Msg("Failed to pause torrent")
		RespondError(w, http.StatusInternalServerError, "Failed to pause torrent")
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{
		"message": "Torrent paused successfully",
	})
}

// ResumeTorrent resumes a single torrent
func (h *TorrentsHandler) ResumeTorrent(w http.ResponseWriter, r *http.Request) {
	// Get instance ID and hash from URL
	instanceID, err := strconv.Atoi(chi.URLParam(r, "instanceID"))
	if err != nil {
		RespondError(w, http.StatusBadRequest, "Invalid instance ID")
		return
	}

	hash := chi.URLParam(r, "hash")
	if hash == "" {
		RespondError(w, http.StatusBadRequest, "Torrent hash is required")
		return
	}

	// Resume torrent
	if err := h.syncManager.BulkAction(r.Context(), instanceID, []string{hash}, "resume"); err != nil {
		log.Error().Err(err).Int("instanceID", instanceID).Str("hash", hash).Msg("Failed to resume torrent")
		RespondError(w, http.StatusInternalServerError, "Failed to resume torrent")
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{
		"message": "Torrent resumed successfully",
	})
}

// GetFilteredTorrents returns filtered torrents
func (h *TorrentsHandler) GetFilteredTorrents(w http.ResponseWriter, r *http.Request) {
	// Get instance ID from URL
	instanceID, err := strconv.Atoi(chi.URLParam(r, "instanceID"))
	if err != nil {
		RespondError(w, http.StatusBadRequest, "Invalid instance ID")
		return
	}

	// Build filter options from query parameters
	opts := qbt.TorrentFilterOptions{}

	// Filter (convert string to TorrentFilter type)
	if filter := r.URL.Query().Get("filter"); filter != "" {
		opts.Filter = qbt.TorrentFilter(filter)
	}

	// Category
	if category := r.URL.Query().Get("category"); category != "" {
		opts.Category = category
	}

	// Tag
	if tag := r.URL.Query().Get("tag"); tag != "" {
		opts.Tag = tag
	}

	// Sort
	if sort := r.URL.Query().Get("sort"); sort != "" {
		opts.Sort = sort
	}

	// Reverse
	if reverse := r.URL.Query().Get("reverse"); reverse == "true" {
		opts.Reverse = true
	}

	// Limit
	if l := r.URL.Query().Get("limit"); l != "" {
		if limit, err := strconv.Atoi(l); err == nil && limit > 0 {
			opts.Limit = limit
		}
	}

	// Offset
	if o := r.URL.Query().Get("offset"); o != "" {
		if offset, err := strconv.Atoi(o); err == nil && offset >= 0 {
			opts.Offset = offset
		}
	}

	// Get filtered torrents
	response, err := h.syncManager.GetFilteredTorrents(r.Context(), instanceID, opts)
	if err != nil {
		log.Error().Err(err).Int("instanceID", instanceID).Msg("Failed to get filtered torrents")
		RespondError(w, http.StatusInternalServerError, "Failed to get filtered torrents")
		return
	}

	RespondJSON(w, http.StatusOK, response)
}

// GetCategories returns all categories
func (h *TorrentsHandler) GetCategories(w http.ResponseWriter, r *http.Request) {
	// Get instance ID from URL
	instanceID, err := strconv.Atoi(chi.URLParam(r, "instanceID"))
	if err != nil {
		RespondError(w, http.StatusBadRequest, "Invalid instance ID")
		return
	}

	// Get categories
	categories, err := h.syncManager.GetCategories(r.Context(), instanceID)
	if err != nil {
		log.Error().Err(err).Int("instanceID", instanceID).Msg("Failed to get categories")
		RespondError(w, http.StatusInternalServerError, "Failed to get categories")
		return
	}

	RespondJSON(w, http.StatusOK, categories)
}

// GetTags returns all tags
func (h *TorrentsHandler) GetTags(w http.ResponseWriter, r *http.Request) {
	// Get instance ID from URL
	instanceID, err := strconv.Atoi(chi.URLParam(r, "instanceID"))
	if err != nil {
		RespondError(w, http.StatusBadRequest, "Invalid instance ID")
		return
	}

	// Get tags
	tags, err := h.syncManager.GetTags(r.Context(), instanceID)
	if err != nil {
		log.Error().Err(err).Int("instanceID", instanceID).Msg("Failed to get tags")
		RespondError(w, http.StatusInternalServerError, "Failed to get tags")
		return
	}

	RespondJSON(w, http.StatusOK, tags)
}