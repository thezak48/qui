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
        state === 'allocating' || state === 'checkingDL'
    case 'seeding':
      return state === 'uploading' || state === 'stalledUP' ||
        state === 'queuedUP' || state === 'checkingUP'
    case 'completed':
      return torrent.progress === 1
    case 'paused':
      return state === 'pausedDL' || state === 'pausedUP'
    case 'active':
      return state === 'downloading' || state === 'uploading'
    case 'inactive':
      return state !== 'downloading' && state !== 'uploading'
    case 'resumed':
      return state !== 'pausedDL' && state !== 'pausedUP'
    case 'stalled':
      return state === 'stalledDL' || state === 'stalledUP'
    case 'stalled_uploading':
      return state === 'stalledUP'
    case 'stalled_downloading':
      return state === 'stalledDL'
    case 'errored':
      return state === 'error' || state === 'missingFiles'
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
      'stalled_uploading', 'stalled_downloading', 'errored'
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

    // Debug logging
    console.log('useTorrentCounts debug:', {
      torrentCount: torrents.length,
      categoryCount: Object.keys(allCategories).length,
      tagCount: allTags.length,
      sampleCategories: Object.keys(allCategories).slice(0, 5),
      sampleTorrents: torrents.slice(0, 3).map(t => ({ name: t.name, category: t.category, tags: t.tags })),
      categoryCounts: Object.keys(counts).filter(k => k.startsWith('category:')).reduce((acc, key) => {
        acc[key] = counts[key]
        return acc
      }, {} as Record<string, number>)
    })

    return counts
  }, [torrents, allCategories, allTags])
}