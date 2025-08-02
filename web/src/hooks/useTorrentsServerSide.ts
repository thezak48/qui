import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { MainData, Torrent } from '@/types'

interface UseTorrentsServerSideOptions {
  enabled?: boolean
  pageSize?: number
  pollingInterval?: number
}

interface TorrentQuery {
  page: number
  limit: number
  sort?: string
  order?: 'asc' | 'desc'
  search?: string
}

export function useTorrentsServerSide(
  instanceId: number,
  query: TorrentQuery,
  options: UseTorrentsServerSideOptions = {}
) {
  const { enabled = true, pageSize = 50, pollingInterval = 5000 } = options
  
  const [stats, setStats] = useState({
    total: 0,
    downloading: 0,
    seeding: 0,
    paused: 0,
    error: 0,
    totalDownloadSpeed: 0,
    totalUploadSpeed: 0,
  })
  
  const ridRef = useRef(0)
  
  // Server-side paginated torrent data
  const { 
    data: torrentPage, 
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['torrents-page', instanceId, query],
    queryFn: () => api.getTorrents(instanceId, {
      page: query.page,
      limit: query.limit,
      sort: query.sort,
      order: query.order,
      search: query.search,
    }),
    staleTime: 2000,
    enabled,
  })
  
  // Update stats from torrent page data (which now includes stats from backend)
  useEffect(() => {
    if (torrentPage?.stats) {
      setStats(prev => ({
        ...prev,
        total: torrentPage.stats.total,
        downloading: torrentPage.stats.downloading,
        seeding: torrentPage.stats.seeding,
        paused: torrentPage.stats.paused,
        error: torrentPage.stats.error,
      }))
    }
  }, [torrentPage?.stats])
  
  // Background sync for real-time stats updates (lightweight)
  useEffect(() => {
    if (!enabled) return
    
    const syncInterval = setInterval(async () => {
      try {
        const updates = await api.syncMainData(instanceId, ridRef.current)
        
        // Update stats from server state (speeds only)
        if (updates.serverState) {
          setStats(prev => ({
            ...prev,
            totalDownloadSpeed: updates.serverState.dlInfoSpeed || 0,
            totalUploadSpeed: updates.serverState.upInfoSpeed || 0,
          }))
        }
        
        ridRef.current = updates.rid
        
        // If there are torrent updates that might affect current page, refetch
        if (updates.torrents || updates.torrentsRemoved) {
          refetch()
        }
      } catch (error) {
        console.error('Background sync error:', error)
      }
    }, pollingInterval)
    
    return () => clearInterval(syncInterval)
  }, [instanceId, enabled, pollingInterval, refetch])
  
  return {
    torrents: torrentPage?.torrents || [],
    totalCount: torrentPage?.total || stats.total || 0,
    stats,
    isLoading,
    error,
    hasNextPage: torrentPage ? (query.page + 1) * query.limit < (torrentPage.total || 0) : false,
    hasPreviousPage: query.page > 0,
    refetch,
  }
}