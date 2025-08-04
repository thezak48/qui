import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TorrentTableOptimized } from '@/components/torrents/TorrentTableOptimized'
import { FilterSidebar } from '@/components/torrents/FilterSidebar'
import { TorrentDetailsPanel } from '@/components/torrents/TorrentDetailsPanel'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { VisuallyHidden } from '@/components/ui/visually-hidden'
import { useTorrentCounts } from '@/hooks/useTorrentCounts'
import { usePersistedFilters } from '@/hooks/usePersistedFilters'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { api } from '@/lib/api'
import type { Torrent } from '@/types'

interface TorrentsProps {
  instanceId: number
  instanceName: string
}

export function Torrents({ instanceId, instanceName }: TorrentsProps) {
  const [filters, setFilters] = usePersistedFilters(instanceId)
  const [selectedTorrent, setSelectedTorrent] = useState<Torrent | null>(null)
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as any
  
  // Check if add torrent modal should be open
  const isAddTorrentModalOpen = search?.modal === 'add-torrent'
  
  const handleAddTorrentModalChange = (open: boolean) => {
    if (open) {
      navigate({ 
        search: { ...search, modal: 'add-torrent' },
        replace: true 
      })
    } else {
      const { modal, ...restSearch } = search || {}
      navigate({ 
        search: restSearch,
        replace: true 
      })
    }
  }
  
  // Get all torrents for accurate counting (separate from table's progressive loading)
  const { data: allTorrentsForCounts } = useQuery({
    queryKey: ['all-torrents-for-counts', instanceId],
    queryFn: async () => {
      // Load torrents in batches until we get them all
      let allTorrents: any[] = []
      let page = 0
      const pageSize = 1000
      let hasMore = true
      
      while (hasMore) {
        const response = await api.getTorrents(instanceId, { 
          page,
          limit: pageSize,
          sort: 'addedOn',
          order: 'desc'
        })
        
        allTorrents = [...allTorrents, ...response.torrents]
        hasMore = response.torrents.length === pageSize && allTorrents.length < response.total
        page++
        
        // Safety break to prevent infinite loops
        if (page > 10) break
      }
      
      console.log(`Loaded ${allTorrents.length} torrents for counting in ${page} batches`)
      return allTorrents
    },
    staleTime: 30000, // Cache for 30 seconds
    refetchInterval: 60000, // Refresh every minute
  })

  // Fetch categories and tags for count calculation
  const { data: categories = {} } = useQuery({
    queryKey: ['categories', instanceId],
    queryFn: () => api.getCategories(instanceId),
    staleTime: 60000,
  })

  const { data: tags = [] } = useQuery({
    queryKey: ['tags', instanceId],
    queryFn: () => api.getTags(instanceId),
    staleTime: 60000,
  })
  
  // Calculate torrent counts for the sidebar
  const torrentCounts = useTorrentCounts({ 
    torrents: allTorrentsForCounts || [], 
    allCategories: categories, 
    allTags: tags 
  })
  
  const handleTorrentSelect = (torrent: Torrent | null) => {
    setSelectedTorrent(torrent)
  }

  return (
    <div className="flex h-full">
      {/* Sidebar - hidden on mobile */}
      <div className="hidden xl:block">
        <FilterSidebar
          instanceId={instanceId}
          selectedFilters={filters}
          onFilterChange={setFilters}
          torrentCounts={torrentCounts}
        />
      </div>
      
      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="p-3 sm:p-4 lg:p-6 flex flex-col h-full">
          <div className="flex-shrink-0 mb-4 lg:mb-6">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">{instanceName}</h1>
            <p className="text-muted-foreground mt-1 lg:mt-2 text-sm lg:text-base">
              Manage torrents for this qBittorrent instance
            </p>
          </div>
          <div className="flex-1 min-h-0">
            <TorrentTableOptimized 
              instanceId={instanceId} 
              filters={filters}
              selectedTorrent={selectedTorrent}
              onTorrentSelect={handleTorrentSelect}
              addTorrentModalOpen={isAddTorrentModalOpen}
              onAddTorrentModalChange={handleAddTorrentModalChange}
            />
          </div>
        </div>
      </div>
      
      <Sheet open={!!selectedTorrent} onOpenChange={(open) => !open && setSelectedTorrent(null)}>
        <SheetContent 
          side="right"
          className="w-full sm:w-[480px] md:w-[540px] lg:w-[600px] xl:w-[640px] sm:max-w-[480px] md:max-w-[540px] lg:max-w-[600px] xl:max-w-[640px] p-0"
        >
          <SheetHeader>
            <VisuallyHidden>
              <SheetTitle>
                {selectedTorrent ? `Torrent Details: ${selectedTorrent.name}` : 'Torrent Details'}
              </SheetTitle>
            </VisuallyHidden>
          </SheetHeader>
          {selectedTorrent && (
            <TorrentDetailsPanel
              instanceId={instanceId}
              torrent={selectedTorrent}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}