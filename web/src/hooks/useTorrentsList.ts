import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Torrent } from '@/types'

interface UseTorrentsListOptions {
  enabled?: boolean
  search?: string
  filters?: {
    status: string[]
    categories: string[]
    tags: string[]
    trackers: string[]
  }
}

// This hook uses the standard paginated API, not SyncMainData
// It's simpler and more reliable for the current implementation
export function useTorrentsList(
  instanceId: number,
  options: UseTorrentsListOptions = {}
) {
  const { enabled = true, search, filters } = options
  
  const [allTorrents, setAllTorrents] = useState<Torrent[]>([])
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasLoadedAll, setHasLoadedAll] = useState(false)
  const [currentPage, setCurrentPage] = useState(0)
  const pageSize = 500 // Load 500 at a time
  
  const [stats, setStats] = useState({
    total: 0,
    downloading: 0,
    seeding: 0,
    paused: 0,
    error: 0,
    totalDownloadSpeed: 0,
    totalUploadSpeed: 0,
  })
  
  // Initial load
  const { data: initialData, isLoading: initialLoading } = useQuery({
    queryKey: ['torrents-list', instanceId, currentPage],
    queryFn: () => api.getTorrents(instanceId, { 
      page: currentPage, 
      limit: pageSize,
      sort: 'addedOn',
      order: 'desc'
    }),
    staleTime: 30000, // 30 seconds
    enabled,
  })
  
  // Update torrents when data arrives
  useEffect(() => {
    if (initialData?.torrents) {
      if (currentPage === 0) {
        // First page, replace all
        setAllTorrents(initialData.torrents)
      } else {
        // Append to existing
        setAllTorrents(prev => [...prev, ...initialData.torrents])
      }
      
      // Update stats - use the total from the API response
      if (initialData.stats) {
        setStats({
          ...initialData.stats,
          total: initialData.total || initialData.stats.total
        })
      } else if (initialData.total) {
        setStats(prev => ({
          ...prev,
          total: initialData.total
        }))
      }
      
      // Check if we've loaded all - compare current loaded count with total
      const totalLoaded = currentPage === 0 ? initialData.torrents.length : allTorrents.length + initialData.torrents.length
      if (totalLoaded >= (initialData.total || initialData.stats?.total || 0)) {
        setHasLoadedAll(true)
      }
      
      setIsLoadingMore(false)
    }
  }, [initialData, currentPage, pageSize])
  
  // Load more function
  const loadMore = () => {
    if (!hasLoadedAll && !isLoadingMore) {
      setIsLoadingMore(true)
      setCurrentPage(prev => prev + 1)
    }
  }
  
  // Client-side filtering
  const filteredTorrents = useMemo(() => {
    let result = [...allTorrents]
    
    // Search filter
    if (search) {
      const searchLower = search.toLowerCase()
      result = result.filter(t => {
        const nameMatch = t.name.toLowerCase().includes(searchLower)
        const categoryMatch = t.category?.toLowerCase().includes(searchLower)
        
        // Handle tags which could be string[] or string from API
        let tagsMatch = false
        if (Array.isArray(t.tags)) {
          tagsMatch = t.tags.some(tag => tag.toLowerCase().includes(searchLower))
        } else if (typeof t.tags === 'string') {
          tagsMatch = (t.tags as any).toLowerCase().includes(searchLower)
        }
        
        return nameMatch || categoryMatch || tagsMatch
      })
    }
    
    // Status filter
    if (filters?.status?.length) {
      result = result.filter(t => filters.status.includes(t.state))
    }
    
    // Category filter
    if (filters?.categories?.length) {
      result = result.filter(t => t.category && filters.categories.includes(t.category))
    }
    
    // Tags filter
    if (filters?.tags?.length) {
      result = result.filter(t => {
        if (!t.tags) return false
        
        // Handle tags which could be string[] or comma-separated string from API
        let torrentTags: string[] = []
        if (Array.isArray(t.tags)) {
          torrentTags = t.tags
        } else if (typeof t.tags === 'string') {
          torrentTags = (t.tags as any).split(',').map((tag: string) => tag.trim())
        }
        
        return filters.tags.some(tag => torrentTags.includes(tag))
      })
    }
    
    // Sort by added date (newest first) - already sorted from API
    
    return result
  }, [allTorrents, search, filters])
  
  // Update filtered stats
  const filteredStats = useMemo(() => {
    // If we have filters/search active, recalculate counts from filtered results
    if (search || filters?.status?.length || filters?.categories?.length || filters?.tags?.length) {
      const filtered = {
        total: filteredTorrents.length,
        downloading: filteredTorrents.filter(t => t.state === 'downloading' || t.state === 'stalledDL').length,
        seeding: filteredTorrents.filter(t => t.state === 'uploading' || t.state === 'stalledUP').length,
        paused: filteredTorrents.filter(t => t.state === 'pausedDL' || t.state === 'pausedUP').length,
        error: filteredTorrents.filter(t => t.state === 'error' || t.state === 'missingFiles').length,
        totalDownloadSpeed: stats.totalDownloadSpeed,
        totalUploadSpeed: stats.totalUploadSpeed,
      }
      return filtered
    }
    
    // Otherwise use the stats from the API which includes ALL torrents
    return stats
  }, [filteredTorrents, stats, search, filters])
  
  return {
    torrents: filteredTorrents,
    allTorrents,
    totalCount: stats.total,
    stats: filteredStats,
    isLoading: initialLoading && currentPage === 0,
    isLoadingMore,
    hasLoadedAll,
    loadMore,
  }
}