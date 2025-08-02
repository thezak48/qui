import { useState, useRef, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table'
import { useTorrentsSync } from '@/hooks/useTorrentsSync'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
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
import type { Torrent } from '@/types'

interface TorrentTableSyncProps {
  instanceId: number
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
  if (seconds === 8640000) return '∞' // qBittorrent uses this value for infinity
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
        state === 'uploading' ? 'success' :
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

export function TorrentTableSync({ instanceId }: TorrentTableSyncProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [rowSelection, setRowSelection] = useState({})

  // Use sync hook for real-time updates
  const { torrents, stats, isLoading } = useTorrentsSync(instanceId)

  const table = useReactTable({
    data: torrents,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    // State management
    state: {
      sorting,
      columnFilters,
      globalFilter,
      rowSelection,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    // Enable row selection
    enableRowSelection: true,
  })

  // Virtualization
  const { rows } = table.getRowModel()
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 45,
    overscan: 10,
  })

  const virtualRows = virtualizer.getVirtualItems()

  // Get selected torrent hashes
  const selectedHashes = useMemo(() => {
    return Object.keys(rowSelection)
      .filter(key => rowSelection[key as keyof typeof rowSelection])
      .map(index => torrents[parseInt(index)]?.hash)
      .filter(Boolean)
  }, [rowSelection, torrents])

  if (isLoading) {
    return <div className="p-4">Loading torrents...</div>
  }

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="flex gap-4 text-sm">
        <div>Total: <strong>{stats.total}</strong></div>
        <div>Downloading: <strong className="text-blue-600">{stats.downloading}</strong></div>
        <div>Seeding: <strong className="text-green-600">{stats.seeding}</strong></div>
        <div>Paused: <strong className="text-yellow-600">{stats.paused}</strong></div>
        <div>Error: <strong className="text-red-600">{stats.error}</strong></div>
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
        <div ref={parentRef} className="relative h-[600px] overflow-auto">
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
            <TableBody
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualRows.map(virtualRow => {
                const row = rows[virtualRow.index]
                return (
                  <TableRow
                    key={row.id}
                    data-index={virtualRow.index}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
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
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Status */}
      <div className="text-sm text-muted-foreground">
        {rows.length === 0 ? (
          'No torrents found'
        ) : rows.length === 1 ? (
          '1 torrent'
        ) : (
          `${rows.length} torrents`
        )}
        {selectedHashes.length > 0 && (
          <span className="ml-2">
            ({selectedHashes.length} selected)
          </span>
        )}
      </div>
    </div>
  )
}