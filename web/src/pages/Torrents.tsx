import { useState } from 'react'
import { TorrentTableOptimized } from '@/components/torrents/TorrentTableOptimized'
import { FilterSidebar } from '@/components/torrents/FilterSidebar'

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

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <FilterSidebar
        instanceId={instanceId}
        selectedFilters={filters}
        onFilterChange={setFilters}
      />
      
      {/* Main content */}
      <div className="flex-1 overflow-auto">
        <div className="container mx-auto p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">{instanceName}</h1>
            <p className="text-muted-foreground mt-2">
              Manage torrents for this qBittorrent instance
            </p>
          </div>
          <TorrentTableOptimized 
            instanceId={instanceId} 
            filters={filters}
          />
        </div>
      </div>
    </div>
  )
}