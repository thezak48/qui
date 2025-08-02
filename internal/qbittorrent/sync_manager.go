package qbittorrent

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	qbt "github.com/autobrr/go-qbittorrent"
	"github.com/dgraph-io/ristretto"
	"github.com/rs/zerolog/log"
)

// TorrentResponse represents a response containing torrents with stats
type TorrentResponse struct {
	Torrents []qbt.Torrent `json:"torrents"`
	Total    int           `json:"total"`
	Stats    *TorrentStats `json:"stats,omitempty"`
}

// TorrentStats represents aggregated torrent statistics
type TorrentStats struct {
	Total       int `json:"total"`
	Downloading int `json:"downloading"`
	Seeding     int `json:"seeding"`
	Paused      int `json:"paused"`
	Error       int `json:"error"`
}

// SyncManager manages SyncMainData for efficient torrent updates
type SyncManager struct {
	clientPool  *ClientPool
	mainData    map[int]*qbt.MainData
	ridTracker  map[int]int64
	mu          sync.RWMutex
	cache       *ristretto.Cache
}

// NewSyncManager creates a new sync manager
func NewSyncManager(clientPool *ClientPool) *SyncManager {
	return &SyncManager{
		clientPool: clientPool,
		mainData:   make(map[int]*qbt.MainData),
		ridTracker: make(map[int]int64),
		cache:      clientPool.GetCache(),
	}
}

// InitialLoad performs initial paginated load of torrents
func (sm *SyncManager) InitialLoad(ctx context.Context, instanceID int, limit, offset int) (*TorrentResponse, error) {
	// Check cache first
	cacheKey := fmt.Sprintf("torrents:%d:%d:%d", instanceID, offset, limit)
	if cached, found := sm.cache.Get(cacheKey); found {
		if response, ok := cached.(*TorrentResponse); ok {
			return response, nil
		}
	}

	// Get client
	client, err := sm.clientPool.GetClient(instanceID)
	if err != nil {
		return nil, fmt.Errorf("failed to get client: %w", err)
	}

	// Use GetTorrentsCtx for initial paginated load
	opts := qbt.TorrentFilterOptions{
		Limit:   limit,
		Offset:  offset,
		Sort:    "added_on",
		Reverse: true,
	}

	torrents, err := client.GetTorrentsCtx(ctx, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to get torrents: %w", err)
	}

	// Get total count
	total := sm.getTotalCount(ctx, instanceID)

	response := &TorrentResponse{
		Torrents: torrents,
		Total:    total,
	}

	// Cache the response
	sm.cache.SetWithTTL(cacheKey, response, 1, 10*time.Second)

	log.Debug().
		Int("instanceID", instanceID).
		Int("count", len(torrents)).
		Int("total", total).
		Msg("Initial torrent load completed")

	return response, nil
}

// GetTorrentsWithSearch gets torrents with search, sorting, and pagination with stats
func (sm *SyncManager) GetTorrentsWithSearch(ctx context.Context, instanceID int, limit, offset int, sort, order, search string) (*TorrentResponse, error) {
	// Build cache key
	cacheKey := fmt.Sprintf("torrents:search:%d:%d:%d:%s:%s:%s", instanceID, offset, limit, sort, order, search)
	if cached, found := sm.cache.Get(cacheKey); found {
		if response, ok := cached.(*TorrentResponse); ok {
			return response, nil
		}
	}

	// Get all torrents for stats calculation (cached separately)
	allTorrents, err := sm.getAllTorrentsForStats(ctx, instanceID, search)
	if err != nil {
		return nil, fmt.Errorf("failed to get all torrents for stats: %w", err)
	}

	// Filter torrents by search if provided
	var filteredTorrents []qbt.Torrent
	if search != "" {
		filteredTorrents = sm.filterTorrentsBySearch(allTorrents, search)
	} else {
		filteredTorrents = allTorrents
	}

	// Calculate stats from filtered torrents
	stats := sm.calculateStats(filteredTorrents)

	// Apply pagination to filtered results
	var paginatedTorrents []qbt.Torrent
	start := offset
	end := offset + limit
	if start < len(filteredTorrents) {
		if end > len(filteredTorrents) {
			end = len(filteredTorrents)
		}
		paginatedTorrents = filteredTorrents[start:end]
	}

	response := &TorrentResponse{
		Torrents: paginatedTorrents,
		Total:    len(filteredTorrents),
		Stats:    stats,
	}

	// Cache the response
	sm.cache.SetWithTTL(cacheKey, response, 1, 10*time.Second)

	log.Debug().
		Int("instanceID", instanceID).
		Int("count", len(paginatedTorrents)).
		Int("total", len(filteredTorrents)).
		Str("search", search).
		Msg("Torrent search completed")

	return response, nil
}

// GetUpdates gets real-time updates using SyncMainData
func (sm *SyncManager) GetUpdates(ctx context.Context, instanceID int) (*qbt.MainData, error) {
	sm.mu.Lock()
	rid := sm.ridTracker[instanceID]
	sm.mu.Unlock()

	// Get client
	client, err := sm.clientPool.GetClient(instanceID)
	if err != nil {
		return nil, fmt.Errorf("failed to get client: %w", err)
	}

	// Get sync data
	mainData, err := client.SyncMainDataCtx(ctx, rid)
	if err != nil {
		return nil, fmt.Errorf("failed to sync main data: %w", err)
	}

	// Update RID for next request
	sm.mu.Lock()
	sm.ridTracker[instanceID] = mainData.Rid

	// Merge updates into existing data
	if existing, ok := sm.mainData[instanceID]; ok && !mainData.FullUpdate {
		sm.mergeMainData(existing, mainData)
		sm.mainData[instanceID] = existing
	} else {
		sm.mainData[instanceID] = mainData
	}
	sm.mu.Unlock()

	log.Debug().
		Int("instanceID", instanceID).
		Int64("rid", mainData.Rid).
		Bool("fullUpdate", mainData.FullUpdate).
		Msg("Sync update completed")

	return mainData, nil
}

// GetFilteredTorrents gets torrents with filtering and pagination
func (sm *SyncManager) GetFilteredTorrents(ctx context.Context, instanceID int, opts qbt.TorrentFilterOptions) (*TorrentResponse, error) {
	// Build cache key based on filter options
	cacheKey := fmt.Sprintf("torrents:filtered:%d:%+v", instanceID, opts)
	if cached, found := sm.cache.Get(cacheKey); found {
		if response, ok := cached.(*TorrentResponse); ok {
			return response, nil
		}
	}

	// Get client
	client, err := sm.clientPool.GetClient(instanceID)
	if err != nil {
		return nil, fmt.Errorf("failed to get client: %w", err)
	}

	// Get filtered torrents
	torrents, err := client.GetTorrentsCtx(ctx, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to get filtered torrents: %w", err)
	}

	// For filtered results, we need to get total count differently
	// This is a limitation of the qBittorrent API
	total := len(torrents)
	if opts.Limit > 0 && len(torrents) == opts.Limit {
		// If we got exactly the limit, there might be more
		total = -1 // Indicate unknown total
	}

	response := &TorrentResponse{
		Torrents: torrents,
		Total:    total,
	}

	// Cache with shorter TTL for filtered results
	sm.cache.SetWithTTL(cacheKey, response, 1, 5*time.Second)

	return response, nil
}

// BulkAction performs bulk operations on torrents
func (sm *SyncManager) BulkAction(ctx context.Context, instanceID int, hashes []string, action string) error {
	// Get client
	client, err := sm.clientPool.GetClient(instanceID)
	if err != nil {
		return fmt.Errorf("failed to get client: %w", err)
	}

	// Perform action based on type
	switch action {
	case "pause":
		return client.PauseCtx(ctx, hashes)
	case "resume":
		return client.ResumeCtx(ctx, hashes)
	case "delete":
		return client.DeleteTorrentsCtx(ctx, hashes, false)
	case "deleteWithFiles":
		return client.DeleteTorrentsCtx(ctx, hashes, true)
	case "recheck":
		return client.RecheckCtx(ctx, hashes)
	case "reannounce":
		return client.ReAnnounceTorrentsCtx(ctx, hashes)
	case "increasePriority":
		return client.IncreasePriorityCtx(ctx, hashes)
	case "decreasePriority":
		return client.DecreasePriorityCtx(ctx, hashes)
	case "topPriority":
		return client.SetMaxPriorityCtx(ctx, hashes)
	case "bottomPriority":
		return client.SetMinPriorityCtx(ctx, hashes)
	default:
		return fmt.Errorf("unknown bulk action: %s", action)
	}
}

// AddTorrent adds a new torrent from file content
func (sm *SyncManager) AddTorrent(ctx context.Context, instanceID int, fileContent []byte, options map[string]string) error {
	// Get client
	client, err := sm.clientPool.GetClient(instanceID)
	if err != nil {
		return fmt.Errorf("failed to get client: %w", err)
	}

	// The go-qbittorrent library expects a filename for the torrent file
	// We'll use a generic name since we're passing the content directly
	return client.AddTorrentFromFileCtx(ctx, "upload.torrent", options)
}

// GetCategories gets all categories
func (sm *SyncManager) GetCategories(ctx context.Context, instanceID int) (map[string]qbt.Category, error) {
	// Check cache
	cacheKey := fmt.Sprintf("categories:%d", instanceID)
	if cached, found := sm.cache.Get(cacheKey); found {
		if categories, ok := cached.(map[string]qbt.Category); ok {
			return categories, nil
		}
	}

	// Get client
	client, err := sm.clientPool.GetClient(instanceID)
	if err != nil {
		return nil, fmt.Errorf("failed to get client: %w", err)
	}

	// Get categories
	categories, err := client.GetCategoriesCtx(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get categories: %w", err)
	}

	// Cache for 1 minute
	sm.cache.SetWithTTL(cacheKey, categories, 1, 60*time.Second)

	return categories, nil
}

// GetTags gets all tags
func (sm *SyncManager) GetTags(ctx context.Context, instanceID int) ([]string, error) {
	// Check cache
	cacheKey := fmt.Sprintf("tags:%d", instanceID)
	if cached, found := sm.cache.Get(cacheKey); found {
		if tags, ok := cached.([]string); ok {
			return tags, nil
		}
	}

	// Get client
	client, err := sm.clientPool.GetClient(instanceID)
	if err != nil {
		return nil, fmt.Errorf("failed to get client: %w", err)
	}

	// Get tags
	tags, err := client.GetTagsCtx(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get tags: %w", err)
	}

	// Cache for 1 minute
	sm.cache.SetWithTTL(cacheKey, tags, 1, 60*time.Second)

	return tags, nil
}

// Helper methods

func (sm *SyncManager) getTotalCount(ctx context.Context, instanceID int) int {
	// Check cache
	cacheKey := fmt.Sprintf("torrent_count:%d", instanceID)
	if cached, found := sm.cache.Get(cacheKey); found {
		if count, ok := cached.(int); ok {
			return count
		}
	}

	// Get client
	client, err := sm.clientPool.GetClient(instanceID)
	if err != nil {
		return 0
	}

	// Get all torrents to count (this is inefficient but necessary)
	// In the future, we might want to maintain a count in the database
	torrents, err := client.GetTorrentsCtx(ctx, qbt.TorrentFilterOptions{})
	if err != nil {
		return 0
	}

	count := len(torrents)

	// Cache for 30 seconds
	sm.cache.SetWithTTL(cacheKey, count, 1, 30*time.Second)

	return count
}

func (sm *SyncManager) mergeMainData(existing, update *qbt.MainData) {
	// Merge torrents
	if existing.Torrents == nil {
		existing.Torrents = make(map[string]qbt.Torrent)
	}
	for hash, torrent := range update.Torrents {
		existing.Torrents[hash] = torrent
	}

	// Remove deleted torrents
	for _, hash := range update.TorrentsRemoved {
		delete(existing.Torrents, hash)
	}

	// Merge categories
	if update.Categories != nil {
		existing.Categories = update.Categories
	}

	// Merge tags
	if update.Tags != nil {
		existing.Tags = update.Tags
	}

	// Update server state (ServerState is a struct, not a pointer)
	existing.ServerState = update.ServerState
}

// ResetRID resets the RID for an instance (useful after reconnection)
func (sm *SyncManager) ResetRID(instanceID int) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	delete(sm.ridTracker, instanceID)
	delete(sm.mainData, instanceID)
}

// getAllTorrentsForStats gets all torrents for stats calculation (cached)
func (sm *SyncManager) getAllTorrentsForStats(ctx context.Context, instanceID int, search string) ([]qbt.Torrent, error) {
	// Use different cache key for search vs no search
	cacheKey := fmt.Sprintf("all_torrents:%d:%s", instanceID, search)
	if cached, found := sm.cache.Get(cacheKey); found {
		if torrents, ok := cached.([]qbt.Torrent); ok {
			return torrents, nil
		}
	}

	// Get client
	client, err := sm.clientPool.GetClient(instanceID)
	if err != nil {
		return nil, fmt.Errorf("failed to get client: %w", err)
	}

	// Get all torrents
	torrents, err := client.GetTorrentsCtx(ctx, qbt.TorrentFilterOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get all torrents: %w", err)
	}

	// Cache for 30 seconds
	sm.cache.SetWithTTL(cacheKey, torrents, 1, 30*time.Second)

	return torrents, nil
}

// filterTorrentsBySearch filters torrents by search string
func (sm *SyncManager) filterTorrentsBySearch(torrents []qbt.Torrent, search string) []qbt.Torrent {
	if search == "" {
		return torrents
	}

	var filtered []qbt.Torrent
	searchLower := strings.ToLower(search)

	for _, torrent := range torrents {
		// Search in name, category, and tags
		nameMatch := strings.Contains(strings.ToLower(torrent.Name), searchLower)
		categoryMatch := strings.Contains(strings.ToLower(torrent.Category), searchLower)
		
		// Search in tags (Tags is a comma-separated string)
		tagsMatch := strings.Contains(strings.ToLower(torrent.Tags), searchLower)

		if nameMatch || categoryMatch || tagsMatch {
			filtered = append(filtered, torrent)
		}
	}

	return filtered
}

// calculateStats calculates torrent statistics from a list of torrents
func (sm *SyncManager) calculateStats(torrents []qbt.Torrent) *TorrentStats {
	stats := &TorrentStats{
		Total: len(torrents),
	}

	for _, torrent := range torrents {
		switch torrent.State {
		case qbt.TorrentStateDownloading, qbt.TorrentStateStalledDl, qbt.TorrentStateMetaDl, qbt.TorrentStateQueuedDl, qbt.TorrentStateForcedDl:
			stats.Downloading++
		case qbt.TorrentStateUploading, qbt.TorrentStateStalledUp, qbt.TorrentStateQueuedUp, qbt.TorrentStateForcedUp:
			stats.Seeding++
		case qbt.TorrentStatePausedDl, qbt.TorrentStatePausedUp:
			stats.Paused++
		case qbt.TorrentStateError, qbt.TorrentStateMissingFiles:
			stats.Error++
		}
	}

	return stats
}