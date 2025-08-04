import { useState, useEffect } from 'react'
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
  
  // Reset pagination when filters or search change
  useEffect(() => {
    setCurrentPage(0)
    setAllTorrents([])
    setHasLoadedAll(false)
  }, [filters, search])
  
  // Initial load
  const { data: initialData, isLoading: initialLoading } = useQuery({
    queryKey: ['torrents-list', instanceId, currentPage, filters, search],
    queryFn: () => api.getTorrents(instanceId, { 
      page: currentPage, 
      limit: pageSize,
      sort: 'addedOn',
      order: 'desc',
      search,
      filters
    }),
    staleTime: 2000, // 2 seconds - match backend cache TTL
    refetchInterval: 5000, // Poll every 5 seconds for real-time updates
    refetchIntervalInBackground: false, // Don't poll when tab is not active
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
          total: initialData.total || initialData.stats.total,
          downloading: initialData.stats.downloading || 0,
          seeding: initialData.stats.seeding || 0,
          paused: initialData.stats.paused || 0,
          error: initialData.stats.error || 0,
          totalDownloadSpeed: initialData.stats.totalDownloadSpeed || 0,
          totalUploadSpeed: initialData.stats.totalUploadSpeed || 0,
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
  
  // Since search is now handled server-side, we don't need client-side filtering
  const filteredTorrents = allTorrents
  
  return {
    torrents: filteredTorrents,
    allTorrents,
    totalCount: stats.total,
    stats,
    isLoading: initialLoading && currentPage === 0,
    isLoadingMore,
    hasLoadedAll,
    loadMore,
  }
}