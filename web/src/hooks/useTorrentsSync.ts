import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { MainData, Torrent } from '@/types'

interface UseTorrentsSyncOptions {
  enabled?: boolean
  pollingInterval?: number
}

export function useTorrentsSync(
  instanceId: number,
  options: UseTorrentsSyncOptions = {}
) {
  const { enabled = true, pollingInterval = 2000 } = options
  
  const [mainData, setMainData] = useState<MainData | null>(null)
  const [torrents, setTorrents] = useState<Record<string, Torrent>>({})
  const ridRef = useRef(0)
  
  // Initial paginated load for first render
  const { data: initialData, isLoading: isInitialLoading } = useQuery({
    queryKey: ['torrents', instanceId, 'initial'],
    queryFn: () => api.getTorrents(instanceId, { limit: 100, page: 0 }),
    staleTime: Infinity, // Never refetch initial data
    enabled,
  })
  
  // Convert initial array to record format
  useEffect(() => {
    if (initialData?.torrents) {
      const torrentsMap = initialData.torrents.reduce((acc, torrent) => {
        acc[torrent.hash] = torrent
        return acc
      }, {} as Record<string, Torrent>)
      setTorrents(torrentsMap)
    }
  }, [initialData])
  
  // Real-time sync updates using polling
  useEffect(() => {
    if (!enabled || !initialData) return
    
    const syncInterval = setInterval(async () => {
      try {
        const updates = await api.syncMainData(instanceId, ridRef.current)
        
        if (updates.fullUpdate) {
          // Full update - replace everything
          setMainData(updates)
          if (updates.torrents) {
            setTorrents(updates.torrents)
          }
        } else {
          // Incremental update - merge changes
          setMainData(prev => ({
            ...prev,
            ...updates,
            torrents: updates.torrents ? { ...prev?.torrents, ...updates.torrents } : prev?.torrents,
          }))
          
          // Update torrents state
          if (updates.torrents) {
            setTorrents(prev => {
              const newTorrents = { ...prev }
              
              // Apply updates
              Object.entries(updates.torrents || {}).forEach(([hash, torrent]) => {
                newTorrents[hash] = torrent
              })
              
              // Remove deleted torrents
              if (updates.torrentsRemoved) {
                updates.torrentsRemoved.forEach(hash => {
                  delete newTorrents[hash]
                })
              }
              
              return newTorrents
            })
          }
        }
        
        // Update RID for next request
        ridRef.current = updates.rid
      } catch (error) {
        console.error('SyncMainData error:', error)
      }
    }, pollingInterval)
    
    return () => clearInterval(syncInterval)
  }, [instanceId, initialData, enabled, pollingInterval])
  
  // Convert torrents record to array for easier consumption
  const torrentsArray = Object.values(torrents)
  
  // Calculate statistics
  const stats = useCallback(() => {
    const downloading = torrentsArray.filter(t => 
      t.state === 'downloading' || t.state === 'stalledDL' || t.state === 'metaDL' || t.state === 'queuedDL'
    ).length
    
    const seeding = torrentsArray.filter(t => 
      t.state === 'uploading' || t.state === 'stalledUP' || t.state === 'queuedUP'
    ).length
    
    const paused = torrentsArray.filter(t => 
      t.state === 'pausedDL' || t.state === 'pausedUP'
    ).length
    
    const error = torrentsArray.filter(t => 
      t.state === 'error' || t.state === 'missingFiles'
    ).length
    
    const completed = torrentsArray.filter(t => t.progress === 1).length
    
    const totalDownloadSpeed = torrentsArray.reduce((sum, t) => sum + t.dlspeed, 0)
    const totalUploadSpeed = torrentsArray.reduce((sum, t) => sum + t.upspeed, 0)
    
    return {
      total: torrentsArray.length,
      downloading,
      seeding,
      paused,
      error,
      completed,
      totalDownloadSpeed,
      totalUploadSpeed,
    }
  }, [torrentsArray])
  
  return {
    torrents: torrentsArray,
    torrentsMap: torrents,
    mainData,
    stats: stats(),
    isLoading: isInitialLoading,
    serverState: mainData?.serverState,
    categories: mainData?.categories,
    tags: mainData?.tags,
  }
}