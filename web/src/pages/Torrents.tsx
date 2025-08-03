import { useState, useRef } from 'react'
import { TorrentTableOptimized } from '@/components/torrents/TorrentTableOptimized'
import { FilterSidebar } from '@/components/torrents/FilterSidebar'
import { TorrentDetailsPanel } from '@/components/torrents/TorrentDetailsPanel'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { VisuallyHidden } from '@/components/ui/visually-hidden'
import type { Torrent } from '@/types'

interface TorrentsProps {
  instanceId: number
  instanceName: string
}

export function Torrents({ instanceId, instanceName }: TorrentsProps) {
  const [filters, setFilters] = useState({
    status: [] as string[],
    categories: [] as string[],
    tags: [] as string[],
    trackers: [] as string[],
  })
  const [selectedTorrent, setSelectedTorrent] = useState<Torrent | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  const handleTorrentSelect = (torrent: Torrent | null) => {
    // Clear any existing timeout
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current)
    }
    
    setIsAnimating(true)
    setSelectedTorrent(torrent)
    
    // Clear animation flag after animation duration (500ms + 100ms buffer)
    animationTimeoutRef.current = setTimeout(() => {
      setIsAnimating(false)
    }, 600)
  }

  return (
    <div className="flex h-full">
      {/* Sidebar - hidden on mobile */}
      <div className="hidden xl:block">
        <FilterSidebar
          instanceId={instanceId}
          selectedFilters={filters}
          onFilterChange={setFilters}
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
              isAnimating={isAnimating}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}