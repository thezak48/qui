import { useQuery } from '@tanstack/react-query'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { api } from '@/lib/api'
import {
  Circle,
  Download,
  Upload,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  StopCircle,
  AlertCircle,
  XCircle,
  type LucideIcon,
} from 'lucide-react'

interface FilterSidebarProps {
  instanceId: number
  selectedFilters: {
    status: string[]
    categories: string[]
    tags: string[]
    trackers: string[]
  }
  onFilterChange: (filters: {
    status: string[]
    categories: string[]
    tags: string[]
    trackers: string[]
  }) => void
  torrentCounts?: Record<string, number>
}

// Define torrent states based on qBittorrent
const TORRENT_STATES: Array<{ value: string; label: string; icon: LucideIcon }> = [
  { value: 'all', label: 'All', icon: Circle },
  { value: 'downloading', label: 'Downloading', icon: Download },
  { value: 'seeding', label: 'Seeding', icon: Upload },
  { value: 'completed', label: 'Completed', icon: CheckCircle2 },
  { value: 'paused', label: 'Paused', icon: PauseCircle },
  { value: 'active', label: 'Active', icon: PlayCircle },
  { value: 'inactive', label: 'Inactive', icon: StopCircle },
  { value: 'resumed', label: 'Resumed', icon: PlayCircle },
  { value: 'stalled', label: 'Stalled', icon: AlertCircle },
  { value: 'stalled_uploading', label: 'Stalled Uploading', icon: AlertCircle },
  { value: 'stalled_downloading', label: 'Stalled Downloading', icon: AlertCircle },
  { value: 'errored', label: 'Error', icon: XCircle },
]

export function FilterSidebar({
  instanceId,
  selectedFilters,
  onFilterChange,
  torrentCounts = {},
}: FilterSidebarProps) {
  // Fetch categories
  const { data: categories = {} } = useQuery({
    queryKey: ['categories', instanceId],
    queryFn: () => api.getCategories(instanceId),
    staleTime: 60000, // 1 minute
  })

  // Fetch tags
  const { data: tags = [] } = useQuery({
    queryKey: ['tags', instanceId],
    queryFn: () => api.getTags(instanceId),
    staleTime: 60000, // 1 minute
  })

  // For now, we'll skip trackers since the backend doesn't support it yet
  // We can add it later when backend support is added

  const handleStatusToggle = (status: string) => {
    const newStatus = selectedFilters.status.includes(status)
      ? selectedFilters.status.filter(s => s !== status)
      : [...selectedFilters.status, status]
    
    onFilterChange({
      ...selectedFilters,
      status: newStatus,
    })
  }

  const handleCategoryToggle = (category: string) => {
    const newCategories = selectedFilters.categories.includes(category)
      ? selectedFilters.categories.filter(c => c !== category)
      : [...selectedFilters.categories, category]
    
    onFilterChange({
      ...selectedFilters,
      categories: newCategories,
    })
  }

  const handleTagToggle = (tag: string) => {
    const newTags = selectedFilters.tags.includes(tag)
      ? selectedFilters.tags.filter(t => t !== tag)
      : [...selectedFilters.tags, tag]
    
    onFilterChange({
      ...selectedFilters,
      tags: newTags,
    })
  }

  const clearFilters = () => {
    onFilterChange({
      status: [],
      categories: [],
      tags: [],
      trackers: [],
    })
  }

  const hasActiveFilters = 
    selectedFilters.status.length > 0 ||
    selectedFilters.categories.length > 0 ||
    selectedFilters.tags.length > 0 ||
    selectedFilters.trackers.length > 0

  return (
    <div className="w-64 border-r bg-muted/10 h-full">
      <ScrollArea className="h-full">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Filters</h3>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear all
              </button>
            )}
          </div>

          <Accordion 
            type="multiple" 
            defaultValue={['status', 'categories', 'tags']}
            className="space-y-2"
          >
            {/* Status Filter */}
            <AccordionItem value="status" className="border rounded-lg">
              <AccordionTrigger className="px-3 py-2 hover:no-underline">
                <div className="flex items-center justify-between w-full">
                  <span className="text-sm font-medium">Status</span>
                  {selectedFilters.status.length > 0 && (
                    <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                      {selectedFilters.status.length}
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-2">
                <div className="space-y-1">
                  {TORRENT_STATES.map((state) => (
                    <label
                      key={state.value}
                      className="flex items-center space-x-2 py-1 hover:bg-muted rounded cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedFilters.status.includes(state.value)}
                        onCheckedChange={() => handleStatusToggle(state.value)}
                      />
                      <span className="text-sm flex-1 flex items-center gap-2">
                        <state.icon className="h-4 w-4" />
                        <span>{state.label}</span>
                      </span>
                      {torrentCounts[`status:${state.value}`] !== undefined && (
                        <span className="text-xs text-muted-foreground">
                          {torrentCounts[`status:${state.value}`]}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Categories Filter */}
            <AccordionItem value="categories" className="border rounded-lg">
              <AccordionTrigger className="px-3 py-2 hover:no-underline">
                <div className="flex items-center justify-between w-full">
                  <span className="text-sm font-medium">Categories</span>
                  {selectedFilters.categories.length > 0 && (
                    <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                      {selectedFilters.categories.length}
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-2">
                <div className="space-y-1">
                  {/* Uncategorized option */}
                  <label className="flex items-center space-x-2 py-1 hover:bg-muted rounded cursor-pointer">
                    <Checkbox
                      checked={selectedFilters.categories.includes('')}
                      onCheckedChange={() => handleCategoryToggle('')}
                    />
                    <span className="text-sm flex-1 italic text-muted-foreground">
                      Uncategorized
                    </span>
                    {torrentCounts['category:'] !== undefined && (
                      <span className="text-xs text-muted-foreground">
                        {torrentCounts['category:']}
                      </span>
                    )}
                  </label>
                  
                  {/* Category list */}
                  {Object.entries(categories).map(([name]) => (
                    <label
                      key={name}
                      className="flex items-center space-x-2 py-1 hover:bg-muted rounded cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedFilters.categories.includes(name)}
                        onCheckedChange={() => handleCategoryToggle(name)}
                      />
                      <span className="text-sm flex-1 truncate" title={name}>
                        {name}
                      </span>
                      {torrentCounts[`category:${name}`] !== undefined && (
                        <span className="text-xs text-muted-foreground">
                          {torrentCounts[`category:${name}`]}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Tags Filter */}
            <AccordionItem value="tags" className="border rounded-lg">
              <AccordionTrigger className="px-3 py-2 hover:no-underline">
                <div className="flex items-center justify-between w-full">
                  <span className="text-sm font-medium">Tags</span>
                  {selectedFilters.tags.length > 0 && (
                    <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                      {selectedFilters.tags.length}
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-2">
                <div className="space-y-1">
                  {/* Untagged option */}
                  <label className="flex items-center space-x-2 py-1 px-2 hover:bg-muted rounded cursor-pointer">
                    <Checkbox
                      checked={selectedFilters.tags.includes('')}
                      onCheckedChange={() => handleTagToggle('')}
                    />
                    <span className="text-sm flex-1 italic text-muted-foreground">
                      Untagged
                    </span>
                    {torrentCounts['tag:'] !== undefined && (
                      <span className="text-xs text-muted-foreground">
                        {torrentCounts['tag:']}
                      </span>
                    )}
                  </label>
                  
                  {/* Tag list */}
                  {tags.map((tag) => (
                    <label
                      key={tag}
                      className="flex items-center space-x-2 py-1 hover:bg-muted rounded cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedFilters.tags.includes(tag)}
                        onCheckedChange={() => handleTagToggle(tag)}
                      />
                      <span className="text-sm flex-1 truncate" title={tag}>
                        {tag}
                      </span>
                      {torrentCounts[`tag:${tag}`] !== undefined && (
                        <span className="text-xs text-muted-foreground">
                          {torrentCounts[`tag:${tag}`]}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Trackers Filter - Placeholder for future implementation */}
            {/* <AccordionItem value="trackers" className="border rounded-lg px-3">
              <AccordionTrigger className="py-2 hover:no-underline" disabled>
                <div className="flex items-center justify-between w-full">
                  <span className="text-sm font-medium text-muted-foreground">
                    Trackers (Coming Soon)
                  </span>
                </div>
              </AccordionTrigger>
            </AccordionItem> */}
          </Accordion>
        </div>
      </ScrollArea>
    </div>
  )
}