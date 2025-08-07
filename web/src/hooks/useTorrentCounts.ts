import { useMemo } from 'react'
import type { Torrent } from '@/types'

interface UseTorrentCountsProps {
  torrents: Torrent[]
  allCategories?: Record<string, any>
  allTags?: string[]
}

// Helper function to match torrent status based on the same logic as FilterSidebar
function matchTorrentStatus(torrent: Torrent, status: string): boolean {
  const state = torrent.state
  switch (status) {
    case 'all':
      return true
    case 'downloading':
      return state === 'downloading' || state === 'stalledDL' ||
        state === 'metaDL' || state === 'queuedDL' ||
        state === 'allocating' || state === 'checkingDL' ||
        state === 'forcedDL'
    case 'seeding':
      return state === 'uploading' || state === 'stalledUP' ||
        state === 'queuedUP' || state === 'checkingUP' ||
        state === 'forcedUP'
    case 'completed':
      return torrent.progress === 1
    case 'paused':
      return state === 'pausedDL' || state === 'pausedUP' ||
        state === 'stoppedDL' || state === 'stoppedUP'
    case 'active':
      return state === 'downloading' || state === 'uploading' ||
        state === 'forcedDL' || state === 'forcedUP'
    case 'inactive':
      return state !== 'downloading' && state !== 'uploading' &&
        state !== 'forcedDL' && state !== 'forcedUP'
    case 'resumed':
      return state !== 'pausedDL' && state !== 'pausedUP' &&
        state !== 'stoppedDL' && state !== 'stoppedUP'
    case 'stalled':
      return state === 'stalledDL' || state === 'stalledUP'
    case 'stalled_uploading':
      return state === 'stalledUP'
    case 'stalled_downloading':
      return state === 'stalledDL'
    case 'errored':
      return state === 'error' || state === 'missingFiles'
    case 'checking':
      return state === 'checkingDL' || state === 'checkingUP' ||
        state === 'checkingResumeData'
    case 'moving':
      return state === 'moving'
    default:
      // For specific states, match exactly
      return state === status
  }
}

export function useTorrentCounts({ torrents, allCategories = {}, allTags = [] }: UseTorrentCountsProps): Record<string, number> {
  return useMemo(() => {
    const counts: Record<string, number> = {}

    // Status counts
    const statusFilters = [
      'all', 'downloading', 'seeding', 'completed', 'paused', 
      'active', 'inactive', 'resumed', 'stalled', 
      'stalled_uploading', 'stalled_downloading', 'errored',
      'checking', 'moving'
    ]

    statusFilters.forEach(status => {
      counts[`status:${status}`] = torrents.filter(t => matchTorrentStatus(t, status)).length
    })

    // Category counts
    const categoryMap = new Map<string, number>()
    
    // Initialize all known categories with 0
    Object.keys(allCategories).forEach(category => {
      categoryMap.set(category, 0)
    })
    // Always include uncategorized
    categoryMap.set('', 0)
    
    // Count actual torrents
    torrents.forEach(torrent => {
      const category = torrent.category || '' // Empty string for uncategorized
      categoryMap.set(category, (categoryMap.get(category) || 0) + 1)
    })
    
    categoryMap.forEach((count, category) => {
      counts[`category:${category}`] = count
    })

    // Tag counts
    const tagMap = new Map<string, number>()
    
    // Initialize all known tags with 0
    allTags.forEach(tag => {
      tagMap.set(tag, 0)
    })
    // Always include untagged
    tagMap.set('', 0)
    
    // Count actual torrents
    torrents.forEach(torrent => {
      if (!torrent.tags || torrent.tags === '') {
        // Count untagged torrents
        tagMap.set('', (tagMap.get('') || 0) + 1)
      } else {
        // Handle tags as comma-separated string
        const tagArray = torrent.tags.split(',').map(tag => tag.trim()).filter(tag => tag !== '')
        tagArray.forEach(tag => {
          tagMap.set(tag, (tagMap.get(tag) || 0) + 1)
        })
      }
    })
    
    tagMap.forEach((count, tag) => {
      counts[`tag:${tag}`] = count
    })

    // Tracker counts
    const trackerMap = new Map<string, number>()
    
    // Count actual torrents by tracker hostname
    torrents.forEach(torrent => {
      if (!torrent.tracker || torrent.tracker === '') {
        // Count trackerless torrents
        trackerMap.set('', (trackerMap.get('') || 0) + 1)
      } else {
        try {
          // Extract hostname from tracker URL
          const url = new URL(torrent.tracker)
          const hostname = url.hostname
          trackerMap.set(hostname, (trackerMap.get(hostname) || 0) + 1)
        } catch {
          // If tracker URL is invalid, count as unknown
          trackerMap.set('Unknown', (trackerMap.get('Unknown') || 0) + 1)
        }
      }
    })
    
    trackerMap.forEach((count, tracker) => {
      counts[`tracker:${tracker}`] = count
    })

    return counts
  }, [torrents, allCategories, allTags])
}