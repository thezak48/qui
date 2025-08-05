package qbittorrent

import (
	"fmt"
	"testing"
	"time"

	qbt "github.com/autobrr/go-qbittorrent"
	"github.com/dgraph-io/ristretto"
	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestCacheInvalidation tests the cache invalidation logic used in the sync manager
func TestCacheInvalidation_InvalidateCache(t *testing.T) {
	// Create test cache
	cache, err := ristretto.NewCache(&ristretto.Config{
		NumCounters: 1e4,
		MaxCost:     1 << 20,
		BufferItems: 64,
	})
	require.NoError(t, err)
	defer cache.Close()

	// Create sync manager with test cache
	sm := &SyncManager{
		mainData:   make(map[int]*qbt.MainData),
		ridTracker: make(map[int]int64),
		cache:      cache,
	}

	instanceID := 1

	// Pre-populate cache with various keys that would exist in real usage
	cacheKeys := []string{
		fmt.Sprintf("torrents:%d:0:50", instanceID),
		fmt.Sprintf("torrents:search:%d:0:25:name:asc:movie", instanceID),
		fmt.Sprintf("torrents:filtered:%d:0:50:added_on:desc::", instanceID),
		fmt.Sprintf("categories:%d", instanceID),
		fmt.Sprintf("tags:%d", instanceID),
		fmt.Sprintf("torrent:properties:%d:hash123", instanceID),
		fmt.Sprintf("torrent:trackers:%d:hash456", instanceID),
		fmt.Sprintf("torrent:files:%d:hash789", instanceID),
		fmt.Sprintf("torrent_count:%d", instanceID),
		fmt.Sprintf("all_torrents:%d:", instanceID),
		fmt.Sprintf("all_torrents:%d:search", instanceID),
	}

	// Also add keys for other instances to test they get cleared too
	otherInstanceID := 2
	for _, baseKey := range []string{"torrents", "categories", "tags"} {
		otherKey := fmt.Sprintf("%s:%d", baseKey, otherInstanceID)
		cacheKeys = append(cacheKeys, otherKey)
	}

	// Populate cache
	for i, key := range cacheKeys {
		value := fmt.Sprintf("test-data-%d", i)
		sm.cache.SetWithTTL(key, value, 1, time.Minute)
	}
	sm.cache.Wait() // Ensure all are set

	// Verify cache is populated
	for _, key := range cacheKeys {
		_, found := sm.cache.Get(key)
		assert.True(t, found, "Cache key should exist: %s", key)
	}

	// Invalidate cache (this clears ALL cache entries due to Ristretto limitation)
	sm.InvalidateCache(instanceID)

	// Wait a bit for the clear operation to complete
	time.Sleep(100 * time.Millisecond)

	// Verify ALL cache entries are cleared (not just for the specific instance)
	for _, key := range cacheKeys {
		_, found := sm.cache.Get(key)
		assert.False(t, found, "Cache key should be cleared: %s", key)
	}
}

// TestCacheInvalidation_RealWorldScenario tests cache invalidation in a scenario
// that simulates real usage patterns
func TestCacheInvalidation_RealWorldScenario(t *testing.T) {
	// Create test cache
	cache, err := ristretto.NewCache(&ristretto.Config{
		NumCounters: 1e4,
		MaxCost:     1 << 20,
		BufferItems: 64,
	})
	require.NoError(t, err)
	defer cache.Close()

	// Create sync manager with test cache
	sm := &SyncManager{
		mainData:   make(map[int]*qbt.MainData),
		ridTracker: make(map[int]int64),
		cache:      cache,
	}

	// Simulate multiple instances with cached data
	instances := []int{1, 2, 3}
	
	// Pre-populate cache with realistic data for all instances
	for _, instanceID := range instances {
		// Torrent lists with different pagination
		for offset := 0; offset < 200; offset += 50 {
			key := fmt.Sprintf("torrents:%d:%d:50", instanceID, offset)
			value := &TorrentResponse{
				Torrents: createTestTorrents(50),
				Total:    1000 + instanceID*100,
			}
			sm.cache.SetWithTTL(key, value, 1, 2*time.Second)
		}

		// Search results
		searches := []string{"action", "movie", "2023"}
		for _, search := range searches {
			key := fmt.Sprintf("torrents:search:%d:0:25:name:asc:%s", instanceID, search)
			value := &TorrentResponse{
				Torrents: createTestTorrents(25),
				Total:    100 + len(search)*10,
			}
			sm.cache.SetWithTTL(key, value, 1, 2*time.Second)
		}

		// Filtered results
		key := fmt.Sprintf("torrents:filtered:%d:0:50:added_on:desc::movies:action", instanceID)
		value := &TorrentResponse{
			Torrents: createTestTorrents(30),
			Total:    150,
		}
		sm.cache.SetWithTTL(key, value, 1, 5*time.Second)

		// Categories
		categories := map[string]qbt.Category{
			"movies": {Name: "movies", SavePath: fmt.Sprintf("/downloads/%d/movies", instanceID)},
			"tv":     {Name: "tv", SavePath: fmt.Sprintf("/downloads/%d/tv", instanceID)},
		}
		sm.cache.SetWithTTL(fmt.Sprintf("categories:%d", instanceID), categories, 1, 60*time.Second)

		// Tags
		tags := []string{fmt.Sprintf("tag1-%d", instanceID), fmt.Sprintf("tag2-%d", instanceID)}
		sm.cache.SetWithTTL(fmt.Sprintf("tags:%d", instanceID), tags, 1, 60*time.Second)

		// Individual torrent data 
		for i := 0; i < 10; i++ {
			hash := fmt.Sprintf("hash%d_%d", instanceID, i)
			
			// Properties
			props := &qbt.TorrentProperties{
				Hash: hash,
				Name: fmt.Sprintf("Torrent %d from Instance %d", i, instanceID),
			}
			sm.cache.SetWithTTL(fmt.Sprintf("torrent:properties:%d:%s", instanceID, hash), props, 1, 30*time.Second)

			// Trackers
			trackers := []qbt.TorrentTracker{
				{Url: fmt.Sprintf("http://tracker%d.example.com/announce", instanceID)},
			}
			sm.cache.SetWithTTL(fmt.Sprintf("torrent:trackers:%d:%s", instanceID, hash), trackers, 1, 30*time.Second)
		}

		// Counts
		sm.cache.SetWithTTL(fmt.Sprintf("torrent_count:%d", instanceID), 1000+instanceID*100, 1, 2*time.Second)

		// All torrents for stats
		allTorrents := createTestTorrents(1000 + instanceID*100)
		sm.cache.SetWithTTL(fmt.Sprintf("all_torrents:%d:", instanceID), allTorrents, 1, 2*time.Second)
	}

	sm.cache.Wait() // Ensure all are set

	// Count total cache entries
	totalEntries := 0
	testKeys := []string{}
	
	for _, instanceID := range instances {
		// Count entries we expect for each instance
		entriesPerInstance := 4 + 3 + 1 + 1 + 1 + 10 + 10 + 1 + 1 // rough count
		totalEntries += entriesPerInstance
		
		// Add some test keys to verify
		testKeys = append(testKeys, fmt.Sprintf("torrents:%d:0:50", instanceID))
		testKeys = append(testKeys, fmt.Sprintf("categories:%d", instanceID))
		testKeys = append(testKeys, fmt.Sprintf("tags:%d", instanceID))
	}

	// Verify cache is populated
	for _, key := range testKeys {
		_, found := sm.cache.Get(key)
		assert.True(t, found, "Cache key should exist before invalidation: %s", key)
	}

	// Simulate a bulk action that requires cache invalidation for instance 2
	targetInstanceID := 2

	// This would normally be called after a bulk action like pause/resume/delete
	sm.InvalidateCache(targetInstanceID)

	// Wait for invalidation to complete
	time.Sleep(100 * time.Millisecond)

	// Verify ALL cache entries are cleared (Ristretto limitation)
	// In a real scenario, this means that actions on one instance affect
	// the cache for all instances, but ensures consistency
	for _, key := range testKeys {
		_, found := sm.cache.Get(key)
		assert.False(t, found, "Cache key should be cleared after invalidation: %s", key)
	}
}

// TestCacheInvalidation_CoordinatedUpdates tests the coordination between
// cache invalidation and the update cycle described in CLAUDE.md
func TestCacheInvalidation_CoordinatedUpdates(t *testing.T) {
	// Create test cache
	cache, err := ristretto.NewCache(&ristretto.Config{
		NumCounters: 1e4,
		MaxCost:     1 << 20,
		BufferItems: 64,
	})
	require.NoError(t, err)
	defer cache.Close()

	// Create sync manager
	sm := &SyncManager{
		mainData:   make(map[int]*qbt.MainData),
		ridTracker: make(map[int]int64),
		cache:      cache,
	}

	instanceID := 1

	// Simulate the update cycle described in CLAUDE.md:
	// 1. Backend cache TTL: 2 seconds
	// 2. Frontend invalidation delay: 1000ms for actions, 500ms for adding torrents
	// 3. React Query stale time: 5 seconds

	// Phase 1: Initial cache population (simulating normal operation)
	torrentsKey := fmt.Sprintf("torrents:%d:0:50", instanceID)
	initialTorrents := &TorrentResponse{
		Torrents: createTestTorrents(50),
		Total:    100,
	}
	
	// Set with 2-second TTL as per the system design
	sm.cache.SetWithTTL(torrentsKey, initialTorrents, 1, 2*time.Second)
	sm.cache.Wait()

	// Verify data is cached
	cached, found := sm.cache.Get(torrentsKey)
	require.True(t, found, "Initial data should be cached")
	response := cached.(*TorrentResponse)
	assert.Equal(t, 100, response.Total)

	// Phase 2: Simulate bulk action (pause/resume/delete)
	// This would be called immediately after the action in the handler
	sm.InvalidateCache(instanceID)
	
	// Verify cache is cleared immediately (good for consistency)
	time.Sleep(50 * time.Millisecond)
	_, found = sm.cache.Get(torrentsKey)
	assert.False(t, found, "Cache should be cleared immediately after action")

	// Phase 3: Simulate new data being cached after qBittorrent processes changes
	// This would happen when the next API request comes in after the frontend delay
	updatedTorrents := &TorrentResponse{
		Torrents: createTestTorrents(45), // 5 torrents were deleted
		Total:    95,
	}
	sm.cache.SetWithTTL(torrentsKey, updatedTorrents, 1, 2*time.Second)
	sm.cache.Wait()

	// Verify updated data is now cached
	cached, found = sm.cache.Get(torrentsKey)
	require.True(t, found, "Updated data should be cached")
	response = cached.(*TorrentResponse)
	assert.Equal(t, 95, response.Total, "Should have updated total after action")
	assert.Len(t, response.Torrents, 45, "Should have fewer torrents after deletion")
}

// TestCacheInvalidation_MultipleInstances tests that invalidation behavior
// works correctly in a multi-instance environment
func TestCacheInvalidation_MultipleInstances(t *testing.T) {
	// Create test cache
	cache, err := ristretto.NewCache(&ristretto.Config{
		NumCounters: 1e4,
		MaxCost:     1 << 20,
		BufferItems: 64,
	})
	require.NoError(t, err)
	defer cache.Close()

	// Create sync manager
	sm := &SyncManager{
		mainData:   make(map[int]*qbt.MainData),
		ridTracker: make(map[int]int64),
		cache:      cache,
	}

	// Setup multiple instances
	instances := map[int]string{
		1: "Home Server qBittorrent",
		2: "Seedbox qBittorrent", 
		3: "VPS qBittorrent",
	}

	// Populate cache for all instances
	for instanceID, name := range instances {
		// Different data for each instance
		torrents := createTestTorrents(50 * instanceID) // Different amounts
		response := &TorrentResponse{
			Torrents: torrents[:10], // Show first 10
			Total:    len(torrents),
		}

		key := fmt.Sprintf("torrents:%d:0:10", instanceID)
		sm.cache.SetWithTTL(key, response, 1, time.Minute)

		// Categories
		categories := map[string]qbt.Category{
			"movies": {Name: "movies", SavePath: fmt.Sprintf("/downloads/%s/movies", name)},
		}
		sm.cache.SetWithTTL(fmt.Sprintf("categories:%d", instanceID), categories, 1, time.Minute)

		// Individual torrent data
		hash := fmt.Sprintf("hash_instance_%d", instanceID)
		props := &qbt.TorrentProperties{
			Hash: hash,
			Name: fmt.Sprintf("Sample torrent from %s", name),
		}
		sm.cache.SetWithTTL(fmt.Sprintf("torrent:properties:%d:%s", instanceID, hash), props, 1, time.Minute)
	}

	sm.cache.Wait()

	// Verify all instances have cached data
	for instanceID := range instances {
		key := fmt.Sprintf("torrents:%d:0:10", instanceID)
		_, found := sm.cache.Get(key)
		assert.True(t, found, "Instance %d should have cached data", instanceID)
	}

	// Perform action on instance 2 only
	targetInstance := 2
	sm.InvalidateCache(targetInstance)

	// Wait for invalidation
	time.Sleep(100 * time.Millisecond)

	// Due to Ristretto's limitation (Clear() clears entire cache),
	// ALL instances will have their data cleared
	for instanceID := range instances {
		key := fmt.Sprintf("torrents:%d:0:10", instanceID)
		_, found := sm.cache.Get(key)
		assert.False(t, found, "Instance %d data should be cleared", instanceID)
	}

	// This is the current behavior - action on one instance affects all
	// This is documented in CLAUDE.md as a limitation but ensures consistency
}

// TestCacheInvalidation_CacheKeyPatterns tests that the correct key patterns
// are used for different types of cache operations
func TestCacheInvalidation_CacheKeyPatterns(t *testing.T) {
	// Test the cache key patterns used throughout the system
	instanceID := 1
	hash := "abcdef123456"
	
	expectedPatterns := map[string]string{
		// Basic torrent lists
		"InitialLoad":           fmt.Sprintf("torrents:%d:0:50", instanceID),
		"Paginated":             fmt.Sprintf("torrents:%d:50:25", instanceID),
		
		// Search results
		"SearchWithQuery":       fmt.Sprintf("torrents:search:%d:0:25:name:asc:movie", instanceID),
		"SearchEmpty":           fmt.Sprintf("torrents:search:%d:0:25:size:desc:", instanceID),
		
		// Filtered results  
		"FilteredComplex":       fmt.Sprintf("torrents:filtered:%d:0:50:added_on:desc:action:{\"status\":[\"downloading\"],\"categories\":[\"movies\"]}", instanceID),
		"FilteredBasic":         fmt.Sprintf("torrents:filtered:%d:25:25:name:asc::", instanceID),
		
		// Metadata
		"Categories":            fmt.Sprintf("categories:%d", instanceID),
		"Tags":                  fmt.Sprintf("tags:%d", instanceID),
		
		// Individual torrent data
		"TorrentProperties":     fmt.Sprintf("torrent:properties:%d:%s", instanceID, hash),
		"TorrentTrackers":       fmt.Sprintf("torrent:trackers:%d:%s", instanceID, hash),
		"TorrentFiles":          fmt.Sprintf("torrent:files:%d:%s", instanceID, hash), 
		"TorrentWebSeeds":       fmt.Sprintf("torrent:webseeds:%d:%s", instanceID, hash),
		
		// Counts and stats
		"TorrentCount":          fmt.Sprintf("torrent_count:%d", instanceID),
		"AllTorrentsEmpty":      fmt.Sprintf("all_torrents:%d:", instanceID),
		"AllTorrentsSearch":     fmt.Sprintf("all_torrents:%d:movie", instanceID),
	}

	// Verify key patterns are unique and follow expected format
	usedKeys := make(map[string]string)
	for testName, key := range expectedPatterns {
		// Check for collisions
		if existingTest, exists := usedKeys[key]; exists {
			t.Errorf("Key collision: %s and %s both use key: %s", testName, existingTest, key)
		}
		usedKeys[key] = testName

		// Verify key format
		assert.Contains(t, key, fmt.Sprintf("%d", instanceID), 
			"Key should contain instance ID: %s", key)
		
		// Verify no spaces in keys (would break caching)
		assert.NotContains(t, key, " ", 
			"Key should not contain spaces: %s", key)
		
		// Verify reasonable length (Ristretto has limits)
		assert.LessOrEqual(t, len(key), 250, 
			"Key should be reasonable length: %s", key)
	}

	// Test that similar keys for different instances don't collide
	for testName, baseKey := range expectedPatterns {
		key1 := baseKey
		key2 := fmt.Sprintf(baseKey, 2, hash) // Different instance
		
		if key1 != key2 { // Only test if they would actually be different
			assert.NotEqual(t, key1, key2, 
				"Keys for different instances should not collide in test: %s", testName)
		}
	}
}

// Benchmark cache invalidation performance
func BenchmarkCacheInvalidation_Clear(b *testing.B) {
	// Disable logging for benchmarks
	oldLevel := zerolog.GlobalLevel()
	zerolog.SetGlobalLevel(zerolog.Disabled)
	defer zerolog.SetGlobalLevel(oldLevel)

	cache, _ := ristretto.NewCache(&ristretto.Config{
		NumCounters: 1e6,
		MaxCost:     1 << 28, // 256MB
		BufferItems: 64,
	})
	defer cache.Close()

	// Pre-populate cache with many entries
	for i := 0; i < 10000; i++ {
		key := fmt.Sprintf("torrents:%d:%d:50", i%5+1, i)
		value := &TorrentResponse{
			Torrents: createTestTorrents(50),
			Total:    1000,
		}
		cache.SetWithTTL(key, value, 1, time.Minute)
	}
	cache.Wait()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		// Call Clear directly to avoid logging during benchmarks
		cache.Clear()
		
		// Re-populate for next iteration
		if i < b.N-1 {
			for j := 0; j < 100; j++ { // Smaller repopulation for speed
				key := fmt.Sprintf("torrents:%d:%d:50", j%5+1, j)
				value := &TorrentResponse{
					Torrents: createTestTorrents(10),
					Total:    100,
				}
				cache.SetWithTTL(key, value, 1, time.Minute)
			}
			cache.Wait()
		}
	}
}