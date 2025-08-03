package qbittorrent

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	qbt "github.com/autobrr/go-qbittorrent"
	"github.com/dgraph-io/ristretto"
	"github.com/rs/zerolog/log"

	"github.com/s0up4200/qbitweb/internal/api/converters"
)

// TorrentResponse represents a response containing torrents with stats
type TorrentResponse struct {
	Torrents []converters.Torrent `json:"torrents"`
	Total    int                  `json:"total"`
	Stats    *TorrentStats        `json:"stats,omitempty"`
}

// TorrentStats represents aggregated torrent statistics
type TorrentStats struct {
	Total              int `json:"total"`
	Downloading        int `json:"downloading"`
	Seeding            int `json:"seeding"`
	Paused             int `json:"paused"`
	Error              int `json:"error"`
	TotalDownloadSpeed int `json:"totalDownloadSpeed"`
	TotalUploadSpeed   int `json:"totalUploadSpeed"`
}

// SyncManager manages SyncMainData for efficient torrent updates
type SyncManager struct {
	clientPool *ClientPool
	mainData   map[int]*qbt.MainData
	ridTracker map[int]int64
	mu         sync.RWMutex
	cache      *ristretto.Cache
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
		Torrents: converters.ConvertTorrents(torrents),
		Total:    total,
	}

	// Cache the response with shorter TTL for more responsive updates
	sm.cache.SetWithTTL(cacheKey, response, 1, 2*time.Second)

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

	// Sort torrents before pagination
	sm.sortTorrents(filteredTorrents, sort, order)

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
		Torrents: converters.ConvertTorrents(paginatedTorrents),
		Total:    len(filteredTorrents),
		Stats:    stats,
	}

	// Cache the response with shorter TTL for more responsive updates
	sm.cache.SetWithTTL(cacheKey, response, 1, 2*time.Second)

	log.Debug().
		Int("instanceID", instanceID).
		Int("count", len(paginatedTorrents)).
		Int("total", len(filteredTorrents)).
		Str("search", search).
		Msg("Torrent search completed")

	return response, nil
}

// GetTorrentsWithFilters gets torrents with filters, search, sorting, and pagination
func (sm *SyncManager) GetTorrentsWithFilters(ctx context.Context, instanceID int, limit, offset int, sort, order, search string, filters FilterOptions) (*TorrentResponse, error) {
	// Build cache key
	cacheKey := fmt.Sprintf("torrents:filtered:%d:%d:%d:%s:%s:%s:%+v", instanceID, offset, limit, sort, order, search, filters)
	if cached, found := sm.cache.Get(cacheKey); found {
		if response, ok := cached.(*TorrentResponse); ok {
			return response, nil
		}
	}

	// Get all torrents for filtering and stats calculation
	allTorrents, err := sm.getAllTorrentsForStats(ctx, instanceID, "")
	if err != nil {
		return nil, fmt.Errorf("failed to get all torrents: %w", err)
	}

	// Apply filters
	filteredTorrents := sm.applyFilters(allTorrents, filters)

	// Apply search filter if provided
	if search != "" {
		filteredTorrents = sm.filterTorrentsBySearch(filteredTorrents, search)
	}

	// Calculate stats from filtered torrents
	stats := sm.calculateStats(filteredTorrents)

	// Sort torrents before pagination
	sm.sortTorrents(filteredTorrents, sort, order)

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
		Torrents: converters.ConvertTorrents(paginatedTorrents),
		Total:    len(filteredTorrents),
		Stats:    stats,
	}

	// Cache the response with shorter TTL for more responsive updates
	sm.cache.SetWithTTL(cacheKey, response, 1, 2*time.Second)

	log.Debug().
		Int("instanceID", instanceID).
		Int("count", len(paginatedTorrents)).
		Int("total", len(filteredTorrents)).
		Str("search", search).
		Interface("filters", filters).
		Msg("Torrent filtering completed")

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
		Torrents: converters.ConvertTorrents(torrents),
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

// GetTorrentProperties gets detailed properties for a specific torrent
func (sm *SyncManager) GetTorrentProperties(ctx context.Context, instanceID int, hash string) (*qbt.TorrentProperties, error) {
	// Check cache
	cacheKey := fmt.Sprintf("torrent:properties:%d:%s", instanceID, hash)
	if cached, found := sm.cache.Get(cacheKey); found {
		if props, ok := cached.(*qbt.TorrentProperties); ok {
			return props, nil
		}
	}

	// Get client
	client, err := sm.clientPool.GetClient(instanceID)
	if err != nil {
		return nil, fmt.Errorf("failed to get client: %w", err)
	}

	// Get properties
	props, err := client.GetTorrentPropertiesCtx(ctx, hash)
	if err != nil {
		return nil, fmt.Errorf("failed to get torrent properties: %w", err)
	}

	// Cache for 30 seconds
	sm.cache.SetWithTTL(cacheKey, &props, 1, 30*time.Second)

	return &props, nil
}

// GetTorrentTrackers gets trackers for a specific torrent
func (sm *SyncManager) GetTorrentTrackers(ctx context.Context, instanceID int, hash string) ([]qbt.TorrentTracker, error) {
	// Check cache
	cacheKey := fmt.Sprintf("torrent:trackers:%d:%s", instanceID, hash)
	if cached, found := sm.cache.Get(cacheKey); found {
		if trackers, ok := cached.([]qbt.TorrentTracker); ok {
			return trackers, nil
		}
	}

	// Get client
	client, err := sm.clientPool.GetClient(instanceID)
	if err != nil {
		return nil, fmt.Errorf("failed to get client: %w", err)
	}

	// Get trackers
	trackers, err := client.GetTorrentTrackersCtx(ctx, hash)
	if err != nil {
		return nil, fmt.Errorf("failed to get torrent trackers: %w", err)
	}

	// Cache for 30 seconds
	sm.cache.SetWithTTL(cacheKey, trackers, 1, 30*time.Second)

	return trackers, nil
}

// GetTorrentFiles gets files information for a specific torrent
func (sm *SyncManager) GetTorrentFiles(ctx context.Context, instanceID int, hash string) (*qbt.TorrentFiles, error) {
	// Check cache
	cacheKey := fmt.Sprintf("torrent:files:%d:%s", instanceID, hash)
	if cached, found := sm.cache.Get(cacheKey); found {
		if files, ok := cached.(*qbt.TorrentFiles); ok {
			return files, nil
		}
	}

	// Get client
	client, err := sm.clientPool.GetClient(instanceID)
	if err != nil {
		return nil, fmt.Errorf("failed to get client: %w", err)
	}

	// Get files
	files, err := client.GetFilesInformationCtx(ctx, hash)
	if err != nil {
		return nil, fmt.Errorf("failed to get torrent files: %w", err)
	}

	// Cache for 30 seconds
	sm.cache.SetWithTTL(cacheKey, files, 1, 30*time.Second)

	return files, nil
}

// GetTorrentWebSeeds gets web seeds for a specific torrent
func (sm *SyncManager) GetTorrentWebSeeds(ctx context.Context, instanceID int, hash string) ([]qbt.WebSeed, error) {
	// Check cache
	cacheKey := fmt.Sprintf("torrent:webseeds:%d:%s", instanceID, hash)
	if cached, found := sm.cache.Get(cacheKey); found {
		if seeds, ok := cached.([]qbt.WebSeed); ok {
			return seeds, nil
		}
	}

	// Get client
	client, err := sm.clientPool.GetClient(instanceID)
	if err != nil {
		return nil, fmt.Errorf("failed to get client: %w", err)
	}

	// Get web seeds
	seeds, err := client.GetTorrentsWebSeedsCtx(ctx, hash)
	if err != nil {
		return nil, fmt.Errorf("failed to get torrent web seeds: %w", err)
	}

	// Cache for 30 seconds
	sm.cache.SetWithTTL(cacheKey, seeds, 1, 30*time.Second)

	return seeds, nil
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

	// Cache for shorter time for more responsive updates
	sm.cache.SetWithTTL(cacheKey, count, 1, 2*time.Second)

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

// InvalidateCache clears all cached data for a specific instance
func (sm *SyncManager) InvalidateCache(instanceID int) {
	log.Debug().Int("instanceID", instanceID).Msg("Invalidating cache for instance")

	// Ristretto doesn't support pattern deletion, so we use a simpler approach:
	// Just clear the entire cache. This is not ideal for multi-instance setups,
	// but ensures consistency and is simple to implement.
	sm.cache.Clear()
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

	// Cache for shorter time for more responsive updates
	sm.cache.SetWithTTL(cacheKey, torrents, 1, 2*time.Second)

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

// applyFilters applies multiple filters to torrents
func (sm *SyncManager) applyFilters(torrents []qbt.Torrent, filters FilterOptions) []qbt.Torrent {
	// If no filters are applied, return all torrents
	if len(filters.Status) == 0 && len(filters.Categories) == 0 && len(filters.Tags) == 0 && len(filters.Trackers) == 0 {
		return torrents
	}

	var filtered []qbt.Torrent
	for _, torrent := range torrents {
		// Check status filter
		if len(filters.Status) > 0 {
			statusMatch := false
			for _, status := range filters.Status {
				if sm.matchTorrentStatus(torrent, status) {
					statusMatch = true
					break
				}
			}
			if !statusMatch {
				continue
			}
		}

		// Check category filter
		if len(filters.Categories) > 0 {
			categoryMatch := false
			for _, category := range filters.Categories {
				if torrent.Category == category {
					categoryMatch = true
					break
				}
			}
			if !categoryMatch {
				continue
			}
		}

		// Check tags filter
		if len(filters.Tags) > 0 {
			tagMatch := false
			torrentTags := strings.Split(torrent.Tags, ", ")
			for _, filterTag := range filters.Tags {
				if filterTag == "" && torrent.Tags == "" {
					// Handle "Untagged" filter
					tagMatch = true
					break
				}
				for _, torrentTag := range torrentTags {
					if torrentTag == filterTag {
						tagMatch = true
						break
					}
				}
				if tagMatch {
					break
				}
			}
			if !tagMatch {
				continue
			}
		}

		// Note: Tracker filtering would require additional API calls for each torrent
		// which is expensive. Consider implementing this differently if needed.

		filtered = append(filtered, torrent)
	}

	return filtered
}

// matchTorrentStatus checks if a torrent matches a specific status filter
func (sm *SyncManager) matchTorrentStatus(torrent qbt.Torrent, status string) bool {
	state := string(torrent.State)
	switch status {
	case "all":
		return true
	case "downloading":
		return state == "downloading" || state == "stalledDL" ||
			state == "metaDL" || state == "queuedDL" ||
			state == "allocating" || state == "checkingDL"
	case "seeding":
		return state == "uploading" || state == "stalledUP" ||
			state == "queuedUP" || state == "checkingUP"
	case "completed":
		return torrent.Progress == 1
	case "paused":
		return state == "pausedDL" || state == "pausedUP"
	case "active":
		return state == "downloading" || state == "uploading"
	case "inactive":
		return state != "downloading" && state != "uploading"
	case "resumed":
		return state != "pausedDL" && state != "pausedUP"
	case "stalled":
		return state == "stalledDL" || state == "stalledUP"
	case "stalled_uploading":
		return state == "stalledUP"
	case "stalled_downloading":
		return state == "stalledDL"
	case "errored":
		return state == "error" || state == "missingFiles"
	default:
		// For specific states, match exactly
		return state == status
	}
}

// calculateStats calculates torrent statistics from a list of torrents
func (sm *SyncManager) calculateStats(torrents []qbt.Torrent) *TorrentStats {
	stats := &TorrentStats{
		Total: len(torrents),
	}

	for _, torrent := range torrents {
		// Add speeds
		stats.TotalDownloadSpeed += int(torrent.DlSpeed)
		stats.TotalUploadSpeed += int(torrent.UpSpeed)

		// Count states
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

// sortTorrents sorts torrents in-place based on the given field and order
func (sm *SyncManager) sortTorrents(torrents []qbt.Torrent, sortField, order string) {
	// Default to descending order if not specified
	if order != "asc" && order != "desc" {
		order = "desc"
	}

	log.Trace().
		Str("sortField", sortField).
		Str("order", order).
		Int("torrentCount", len(torrents)).
		Msg("Sorting torrents")

	sort.Slice(torrents, func(i, j int) bool {
		var less bool

		switch sortField {
		case "name":
			less = strings.ToLower(torrents[i].Name) < strings.ToLower(torrents[j].Name)
		case "size":
			less = torrents[i].Size < torrents[j].Size
		case "progress":
			less = torrents[i].Progress < torrents[j].Progress
		case "dlspeed":
			less = torrents[i].DlSpeed < torrents[j].DlSpeed
		case "upspeed":
			less = torrents[i].UpSpeed < torrents[j].UpSpeed
		case "eta":
			less = torrents[i].ETA < torrents[j].ETA
		case "ratio":
			less = torrents[i].Ratio < torrents[j].Ratio
		case "category":
			less = strings.ToLower(torrents[i].Category) < strings.ToLower(torrents[j].Category)
		case "tags":
			less = strings.ToLower(torrents[i].Tags) < strings.ToLower(torrents[j].Tags)
		case "added_on", "addedOn":
			less = torrents[i].AddedOn < torrents[j].AddedOn
		case "state":
			less = torrents[i].State < torrents[j].State
		default:
			// Default to sorting by added date (newest first)
			less = torrents[i].AddedOn < torrents[j].AddedOn
		}

		// Reverse for descending order
		if order == "desc" {
			return !less
		}
		return less
	})
}

// AddTags adds tags to the specified torrents (keeps existing tags)
func (sm *SyncManager) AddTags(ctx context.Context, instanceID int, hashes []string, tags string) error {
	client, err := sm.clientPool.GetClient(instanceID)
	if err != nil {
		return fmt.Errorf("failed to get client: %w", err)
	}

	return client.Client.AddTagsCtx(ctx, hashes, tags)
}

// RemoveTags removes specific tags from the specified torrents
func (sm *SyncManager) RemoveTags(ctx context.Context, instanceID int, hashes []string, tags string) error {
	client, err := sm.clientPool.GetClient(instanceID)
	if err != nil {
		return fmt.Errorf("failed to get client: %w", err)
	}

	return client.Client.RemoveTagsCtx(ctx, hashes, tags)
}

// SetCategory sets the category for the specified torrents
func (sm *SyncManager) SetCategory(ctx context.Context, instanceID int, hashes []string, category string) error {
	client, err := sm.clientPool.GetClient(instanceID)
	if err != nil {
		return fmt.Errorf("failed to get client: %w", err)
	}

	return client.Client.SetCategoryCtx(ctx, hashes, category)
}
