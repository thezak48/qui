import { useState, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type PaginationState,
  type SortingState,
} from '@tanstack/react-table'
import { useTorrentsServerSide } from '@/hooks/useTorrentsServerSide'
import { useDebounce } from '@/hooks/useDebounce'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AddTorrentDialog } from './AddTorrentDialog'
import { TorrentActions } from './TorrentActions'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import type { Torrent } from '@/types'

interface TorrentTableOptimizedProps {
  instanceId: number
  filters?: {
    status: string[]
    categories: string[]
    tags: string[]
    trackers: string[]
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond === 0) return '0 B/s'
  return `${formatBytes(bytesPerSecond)}/s`
}

function formatEta(seconds: number): string {
  if (seconds === 8640000) return '∞'
  if (seconds < 0) return ''
  
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  
  if (hours > 24) {
    const days = Math.floor(hours / 24)
    return `${days}d ${hours % 24}h`
  }
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  
  return `${minutes}m`
}

const columns: ColumnDef<Torrent>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <input
        type="checkbox"
        checked={table.getIsAllPageRowsSelected()}
        onChange={(e) => table.toggleAllPageRowsSelected(e.target.checked)}
      />
    ),
    cell: ({ row }) => (
      <input
        type="checkbox"
        checked={row.getIsSelected()}
        onChange={(e) => row.toggleSelected(e.target.checked)}
      />
    ),
    size: 40,
  },
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => (
      <div className="truncate max-w-xs" title={row.original.name}>
        {row.original.name}
      </div>
    ),
  },
  {
    accessorKey: 'size',
    header: 'Size',
    cell: ({ row }) => formatBytes(row.original.size),
    size: 100,
  },
  {
    accessorKey: 'progress',
    header: 'Progress',
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <Progress value={row.original.progress * 100} className="w-20" />
        <span className="text-sm text-muted-foreground">
          {Math.round(row.original.progress * 100)}%
        </span>
      </div>
    ),
    size: 140,
  },
  {
    accessorKey: 'state',
    header: 'Status',
    cell: ({ row }) => {
      const state = row.original.state
      const variant = 
        state === 'downloading' ? 'default' :
        state === 'stalledDL' ? 'secondary' :
        state === 'uploading' ? 'default' :
        state === 'stalledUP' ? 'secondary' :
        state === 'pausedDL' || state === 'pausedUP' ? 'secondary' :
        state === 'error' || state === 'missingFiles' ? 'destructive' :
        'outline'
      
      return <Badge variant={variant as any}>{state}</Badge>
    },
    size: 120,
  },
  {
    accessorKey: 'dlspeed',
    header: 'Down Speed',
    cell: ({ row }) => formatSpeed(row.original.dlspeed),
    size: 110,
  },
  {
    accessorKey: 'upspeed',
    header: 'Up Speed',
    cell: ({ row }) => formatSpeed(row.original.upspeed),
    size: 110,
  },
  {
    accessorKey: 'eta',
    header: 'ETA',
    cell: ({ row }) => formatEta(row.original.eta),
    size: 80,
  },
  {
    accessorKey: 'ratio',
    header: 'Ratio',
    cell: ({ row }) => row.original.ratio.toFixed(2),
    size: 80,
  },
  {
    accessorKey: 'addedOn',
    header: 'Added',
    cell: ({ row }) => {
      const addedOn = row.original.addedOn
      if (!addedOn || addedOn === 0) {
        return '-'
      }
      const date = new Date(addedOn * 1000) // Convert from Unix timestamp
      
      // Format: M/D/YYYY, h:mm:ss AM/PM
      const month = date.getMonth() + 1 // getMonth() returns 0-11
      const day = date.getDate()
      const year = date.getFullYear()
      const hours = date.getHours()
      const minutes = date.getMinutes()
      const seconds = date.getSeconds()
      const ampm = hours >= 12 ? 'PM' : 'AM'
      const displayHours = hours % 12 || 12 // Convert to 12-hour format
      
      return `${month}/${day}/${year}, ${displayHours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} ${ampm}`
    },
    size: 150,
  },
  {
    accessorKey: 'category',
    header: 'Category',
    cell: ({ row }) => row.original.category || '-',
    size: 120,
  },
  {
    accessorKey: 'tags',
    header: 'Tags',
    cell: ({ row }) => {
      const tags = row.original.tags
      return Array.isArray(tags) ? tags.join(', ') : tags || '-'
    },
    size: 150,
  },
]

export function TorrentTableOptimized({ instanceId, filters }: TorrentTableOptimizedProps) {
  // Server-side state management
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 50,
  })
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [rowSelection, setRowSelection] = useState({})

  // Debounce search to prevent excessive API calls
  const debouncedSearch = useDebounce(globalFilter, 500)

  // Reset to first page when search changes
  const [lastSearch, setLastSearch] = useState(debouncedSearch)
  if (debouncedSearch !== lastSearch) {
    setLastSearch(debouncedSearch)
    setPagination(prev => ({ ...prev, pageIndex: 0 }))
  }

  // Reset to first page when filters change
  const [lastFilters, setLastFilters] = useState(filters)
  if (JSON.stringify(filters) !== JSON.stringify(lastFilters)) {
    setLastFilters(filters)
    setPagination(prev => ({ ...prev, pageIndex: 0 }))
  }

  // Server-side data fetching
  const { 
    torrents, 
    totalCount, 
    stats, 
    isLoading,
    hasNextPage,
    hasPreviousPage,
  } = useTorrentsServerSide(instanceId, {
    page: pagination.pageIndex,
    limit: pagination.pageSize,
    sort: sorting[0]?.id,
    order: sorting[0]?.desc ? 'desc' : 'asc',
    search: debouncedSearch,
    filters,
  })

  const table = useReactTable({
    data: torrents,
    columns,
    getCoreRowModel: getCoreRowModel(),
    // Disable client-side operations for performance
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    // Provide total count for pagination
    rowCount: totalCount,
    // State management
    state: {
      pagination,
      sorting,
      globalFilter,
      rowSelection,
    },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    // Enable row selection
    enableRowSelection: true,
  })

  // Get selected torrent hashes
  const selectedHashes = useMemo(() => {
    return Object.keys(rowSelection)
      .filter(key => rowSelection[key as keyof typeof rowSelection])
      .map(index => torrents[parseInt(index)]?.hash)
      .filter(Boolean)
  }, [rowSelection, torrents])

  if (isLoading && torrents.length === 0) {
    return <div className="p-4">Loading torrents...</div>
  }

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="flex gap-4 text-sm">
        <div>Total: <strong>{stats.total}</strong></div>
        <div>Downloading: <strong className="text-chart-1">{stats.downloading}</strong></div>
        <div>Seeding: <strong className="text-chart-3">{stats.seeding}</strong></div>
        <div>Paused: <strong className="text-chart-4">{stats.paused}</strong></div>
        <div>Error: <strong className="text-destructive">{stats.error}</strong></div>
        <div className="ml-auto">
          ↓ {formatSpeed(stats.totalDownloadSpeed)} | ↑ {formatSpeed(stats.totalUploadSpeed)}
        </div>
      </div>

      {/* Search and Actions */}
      <div className="flex items-center justify-between gap-4">
        <Input
          placeholder="Search torrents..."
          value={globalFilter ?? ''}
          onChange={event => setGlobalFilter(event.target.value)}
          className="max-w-sm"
        />
        <div className="flex gap-2">
          {selectedHashes.length > 0 && (
            <TorrentActions 
              instanceId={instanceId} 
              selectedHashes={selectedHashes}
              onComplete={() => setRowSelection({})}
            />
          )}
          <AddTorrentDialog instanceId={instanceId} />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <div className="h-[600px] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              {table.getHeaderGroups().map(headerGroup => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <TableHead 
                      key={header.id}
                      style={{ width: header.getSize() }}
                      className={header.column.getCanSort() ? 'cursor-pointer select-none' : ''}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                      {{
                        asc: ' ↑',
                        desc: ' ↓',
                      }[header.column.getIsSorted() as string] ?? null}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map(row => (
                <TableRow
                  key={row.id}
                  className={row.getIsSelected() ? 'bg-muted/50' : ''}
                >
                  {row.getVisibleCells().map(cell => (
                    <TableCell 
                      key={cell.id}
                      style={{ width: cell.column.getSize() }}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {totalCount === 0 ? (
            'No torrents found'
          ) : (
            <>
              Showing {pagination.pageIndex * pagination.pageSize + 1} to{' '}
              {Math.min((pagination.pageIndex + 1) * pagination.pageSize, totalCount)} of{' '}
              {totalCount} torrents
            </>
          )}
          {selectedHashes.length > 0 && (
            <span className="ml-2">
              ({selectedHashes.length} selected)
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.setPageIndex(0)}
            disabled={!hasPreviousPage}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!hasPreviousPage}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-sm">
            Page {pagination.pageIndex + 1} of {Math.ceil(totalCount / pagination.pageSize)}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!hasNextPage}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.setPageIndex(Math.ceil(totalCount / pagination.pageSize) - 1)}
            disabled={!hasNextPage}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}