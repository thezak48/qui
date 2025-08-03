import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnResizeMode,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useTorrentsList } from '@/hooks/useTorrentsList'
import { useDebounce } from '@/hooks/useDebounce'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import { AddTorrentDialog } from './AddTorrentDialog'
import { TorrentActions } from './TorrentActions'
import { Loader2, Play, Pause, Trash2, CheckCircle, Copy, Tag, Folder } from 'lucide-react'
import type { Torrent } from '@/types'

interface TorrentTableOptimizedProps {
  instanceId: number
  filters?: {
    status: string[]
    categories: string[]
    tags: string[]
    trackers: string[]
  }
  selectedTorrent?: Torrent | null
  onTorrentSelect?: (torrent: Torrent | null) => void
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
    enableResizing: false,
  },
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => (
      <div className="truncate text-sm" title={row.original.name}>
        {row.original.name}
      </div>
    ),
    size: 300,
    minSize: 150,
  },
  {
    accessorKey: 'size',
    header: 'Size',
    cell: ({ row }) => <span className="text-sm">{formatBytes(row.original.size)}</span>,
    size: 100,
  },
  {
    accessorKey: 'progress',
    header: 'Progress',
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <Progress value={row.original.progress * 100} className="w-20" />
        <span className="text-xs text-muted-foreground">
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
      
      return <Badge variant={variant} className="text-xs">{state}</Badge>
    },
    size: 120,
  },
  {
    accessorKey: 'dlspeed',
    header: 'Down Speed',
    cell: ({ row }) => <span className="text-sm">{formatSpeed(row.original.dlspeed)}</span>,
    size: 110,
  },
  {
    accessorKey: 'upspeed',
    header: 'Up Speed',
    cell: ({ row }) => <span className="text-sm">{formatSpeed(row.original.upspeed)}</span>,
    size: 110,
  },
  {
    accessorKey: 'eta',
    header: 'ETA',
    cell: ({ row }) => <span className="text-sm">{formatEta(row.original.eta)}</span>,
    size: 80,
  },
  {
    accessorKey: 'ratio',
    header: 'Ratio',
    cell: ({ row }) => <span className="text-sm">{row.original.ratio.toFixed(2)}</span>,
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
      
      return (
        <div className="whitespace-nowrap text-sm">
          {month}/{day}/{year}, {displayHours}:{minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')} {ampm}
        </div>
      )
    },
    size: 200,
    minSize: 150,
  },
  {
    accessorKey: 'category',
    header: 'Category',
    cell: ({ row }) => (
      <div className="truncate text-sm" title={row.original.category || '-'}>
        {row.original.category || '-'}
      </div>
    ),
    size: 150,
    minSize: 100,
  },
  {
    accessorKey: 'tags',
    header: 'Tags',
    cell: ({ row }) => {
      const tags = row.original.tags
      return (
        <div className="truncate text-sm" title={Array.isArray(tags) ? tags.join(', ') : tags || '-'}>
          {Array.isArray(tags) ? tags.join(', ') : tags || '-'}
        </div>
      )
    },
    size: 200,
    minSize: 100,
  },
]

export function TorrentTableOptimized({ instanceId, filters, selectedTorrent, onTorrentSelect }: TorrentTableOptimizedProps) {
  // State management
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [rowSelection, setRowSelection] = useState({})
  const [columnSizing, setColumnSizing] = useState({})
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteFiles, setDeleteFiles] = useState(false)
  const [contextMenuHashes, setContextMenuHashes] = useState<string[]>([])
  const [showTagsDialog, setShowTagsDialog] = useState(false)
  const [showCategoryDialog, setShowCategoryDialog] = useState(false)
  const [tagsInput, setTagsInput] = useState('')
  const [categoryInput, setCategoryInput] = useState('')
  
  // Progressive loading state
  const [loadedRows, setLoadedRows] = useState(100)
  
  // Query client for invalidating queries
  const queryClient = useQueryClient()

  // Debounce search to prevent excessive filtering
  const debouncedSearch = useDebounce(globalFilter, 300)

  // Fetch torrents data
  const { 
    torrents, 
    totalCount, 
    stats, 
    isLoading,
    isLoadingMore,
    hasLoadedAll,
    loadMore: loadMoreTorrents,
  } = useTorrentsList(instanceId, {
    search: debouncedSearch,
    filters,
  })

  // Sort torrents client-side
  const sortedTorrents = useMemo(() => {
    if (sorting.length === 0) return torrents
    
    const sorted = [...torrents]
    const sort = sorting[0]
    
    sorted.sort((a, b) => {
      const aValue = a[sort.id as keyof Torrent]
      const bValue = b[sort.id as keyof Torrent]
      
      if (aValue === null || aValue === undefined) return 1
      if (bValue === null || bValue === undefined) return -1
      
      if (aValue < bValue) return sort.desc ? 1 : -1
      if (aValue > bValue) return sort.desc ? -1 : 1
      return 0
    })
    
    return sorted
  }, [torrents, sorting])

  const table = useReactTable({
    data: sortedTorrents,
    columns,
    getCoreRowModel: getCoreRowModel(),
    // State management
    state: {
      sorting,
      globalFilter,
      rowSelection,
      columnSizing,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    onColumnSizingChange: setColumnSizing,
    // Enable row selection
    enableRowSelection: true,
    // Enable column resizing
    enableColumnResizing: true,
    columnResizeMode: 'onChange' as ColumnResizeMode,
  })

  // Get selected torrent hashes
  const selectedHashes = useMemo(() => {
    return Object.keys(rowSelection)
      .filter(key => rowSelection[key as keyof typeof rowSelection])
      .map(index => sortedTorrents[parseInt(index)]?.hash)
      .filter(Boolean)
  }, [rowSelection, sortedTorrents])

  // Load more rows as user scrolls (progressive loading)
  const loadMore = useCallback(() => {
    const newLoadedRows = Math.min(loadedRows + 100, sortedTorrents.length)
    setLoadedRows(newLoadedRows)
    
    // If we're near the end of loaded torrents and haven't loaded all from server
    if (newLoadedRows >= sortedTorrents.length - 50 && !hasLoadedAll && !isLoadingMore) {
      loadMoreTorrents()
    }
  }, [loadedRows, sortedTorrents.length, hasLoadedAll, isLoadingMore, loadMoreTorrents])

  // Virtualization setup with progressive loading
  const { rows } = table.getRowModel()
  const parentRef = useRef<HTMLDivElement>(null)

  // Only virtualize the loaded rows, not all rows
  const virtualizer = useVirtualizer({
    count: Math.min(loadedRows, rows.length),
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 20, // Increased for smoother scrolling
    onChange: (instance) => {
      const lastItem = instance.getVirtualItems().at(-1)
      if (lastItem && lastItem.index >= loadedRows - 50) {
        loadMore()
      }
    },
  })

  const virtualRows = virtualizer.getVirtualItems()

  // Calculate total table width
  const tableMinWidth = useMemo(() => {
    return columns.reduce((acc, col) => acc + (col.size || 100), 0)
  }, [])

  // Reset loaded rows when data changes
  useEffect(() => {
    if (sortedTorrents.length > 0) {
      // If we have torrents but loadedRows is 0, set initial load
      if (loadedRows === 0) {
        setLoadedRows(Math.min(100, sortedTorrents.length))
      }
      // If data reduced below loaded rows, adjust
      else if (sortedTorrents.length < loadedRows) {
        setLoadedRows(sortedTorrents.length)
      }
    }
  }, [sortedTorrents.length, loadedRows])

  // Debug logging
  useEffect(() => {
    console.log('TorrentTable Debug:', {
      torrentsCount: torrents.length,
      sortedTorrentsCount: sortedTorrents.length,
      rowsCount: rows.length,
      loadedRows,
      virtualRowsCount: virtualRows.length,
      virtualizerTotalSize: virtualizer.getTotalSize(),
      firstTorrent: sortedTorrents[0]?.name
    })
  }, [torrents, sortedTorrents, rows, loadedRows, virtualRows, virtualizer])

  // Mutation for bulk actions
  const mutation = useMutation({
    mutationFn: (data: {
      action: 'pause' | 'resume' | 'delete' | 'recheck' | 'addTags' | 'setCategory'
      deleteFiles?: boolean
      hashes: string[]
      tags?: string
      category?: string
    }) => {
      return api.bulkAction(instanceId, {
        hashes: data.hashes,
        action: data.action,
        deleteFiles: data.deleteFiles,
        tags: data.tags,
        category: data.category,
      })
    },
    onSuccess: () => {
      // Add small delay to allow qBittorrent to process the change
      setTimeout(() => {
        queryClient.invalidateQueries({ 
          queryKey: ['torrents-list', instanceId],
          exact: false 
        })
      }, 1000) // Give qBittorrent time to process
      setContextMenuHashes([])
    },
  })

  const handleDelete = async () => {
    await mutation.mutateAsync({ 
      action: 'delete', 
      deleteFiles,
      hashes: contextMenuHashes 
    })
    setShowDeleteDialog(false)
    setDeleteFiles(false)
    setContextMenuHashes([])
  }

  const handleContextMenuAction = (action: 'pause' | 'resume' | 'recheck', hashes: string[]) => {
    setContextMenuHashes(hashes)
    mutation.mutate({ action, hashes })
  }

  const handleAddTags = async () => {
    if (!tagsInput.trim()) return
    await mutation.mutateAsync({ 
      action: 'addTags', 
      hashes: contextMenuHashes, 
      tags: tagsInput.trim() 
    })
    setShowTagsDialog(false)
    setTagsInput('')
    setContextMenuHashes([])
  }

  const handleSetCategory = async () => {
    await mutation.mutateAsync({ 
      action: 'setCategory', 
      hashes: contextMenuHashes, 
      category: categoryInput 
    })
    setShowCategoryDialog(false)
    setCategoryInput('')
    setContextMenuHashes([])
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading torrents...</span>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Stats bar */}
      <div className="flex flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm flex-shrink-0">
        <div>Total: <strong>{stats.total}</strong></div>
        <div className="hidden sm:block">Downloading: <strong>{stats.downloading}</strong></div>
        <div className="hidden sm:block">Seeding: <strong>{stats.seeding}</strong></div>
        <div className="hidden sm:block">Paused: <strong>{stats.paused}</strong></div>
        <div className="hidden sm:block">Error: <strong className={stats.error > 0 ? "text-destructive" : ""}>{stats.error}</strong></div>
        <div className="ml-auto text-xs sm:text-sm">
          ↓ {formatSpeed(stats.totalDownloadSpeed || 0)} | ↑ {formatSpeed(stats.totalUploadSpeed || 0)}
        </div>
      </div>

      {/* Search and Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4 flex-shrink-0 mt-3">
        <Input
          placeholder="Search torrents..."
          value={globalFilter ?? ''}
          onChange={event => setGlobalFilter(event.target.value)}
          className="w-full sm:max-w-sm"
        />
        <div className="flex gap-2 w-full sm:w-auto">
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

      {/* Table container */}
      <div className="rounded-md border flex flex-col flex-1 min-h-0 mt-3">
        <div className="relative flex-1 overflow-auto" ref={parentRef}>
          <div style={{ minWidth: `${tableMinWidth}px` }}>
            {/* Header */}
            <div className="sticky top-0 bg-background z-10 border-b">
              {table.getHeaderGroups().map(headerGroup => (
                <div key={headerGroup.id} className="flex">
                  {headerGroup.headers.map(header => (
                    <div
                      key={header.id}
                      style={{ 
                        width: header.getSize(),
                        minWidth: header.getSize(),
                        position: 'relative',
                        flexShrink: 0
                      }}
                      className="group"
                    >
                      <div
                        className={`px-3 py-2 text-left text-sm font-medium text-muted-foreground overflow-hidden ${
                          header.column.getCanSort() ? 'cursor-pointer select-none hover:text-foreground' : ''
                        }`}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <div className="flex items-center gap-1 truncate">
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
                        </div>
                      </div>
                      {header.column.getCanResize() && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className={`absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none ${
                            header.column.getIsResizing() 
                              ? 'bg-primary opacity-100' 
                              : 'bg-border hover:bg-primary/50 opacity-0 group-hover:opacity-100'
                          }`}
                        />
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
            
            {/* Body */}
            <div
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {virtualRows.map(virtualRow => {
                  const row = rows[virtualRow.index]
                  const torrent = row.original
                  const isSelected = selectedTorrent?.hash === torrent.hash
                
                  return (
                    <ContextMenu key={row.id}>
                      <ContextMenuTrigger asChild>
                        <div
                          className={`flex border-b cursor-pointer hover:bg-muted/50 ${row.getIsSelected() ? 'bg-muted/50' : ''} ${isSelected ? 'bg-accent' : ''}`}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            minWidth: `${tableMinWidth}px`,
                            height: `${virtualRow.size}px`,
                            transform: `translateY(${virtualRow.start}px)`,
                          }}
                          onClick={(e) => {
                            // Don't select when clicking checkbox
                            const target = e.target as HTMLElement
                            const isCheckbox = (target as HTMLInputElement).type === 'checkbox' || target.closest('input[type="checkbox"]')
                            if (!isCheckbox) {
                              onTorrentSelect?.(torrent)
                            }
                          }}
                          onContextMenu={() => {
                            // Select this row if not already selected
                            if (!row.getIsSelected()) {
                              setRowSelection({ [row.id]: true })
                            }
                          }}
                        >
                          {row.getVisibleCells().map(cell => (
                            <div
                              key={cell.id}
                              style={{ 
                                width: cell.column.getSize(),
                                minWidth: cell.column.getSize(),
                                flexShrink: 0
                              }}
                              className="px-3 py-2 flex items-center overflow-hidden"
                            >
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext()
                              )}
                            </div>
                          ))}
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuItem onClick={() => onTorrentSelect?.(torrent)}>
                          View Details
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem 
                          onClick={() => {
                            const hashes = row.getIsSelected() ? selectedHashes : [torrent.hash]
                            handleContextMenuAction('resume', hashes)
                          }}
                          disabled={mutation.isPending}
                        >
                          <Play className="mr-2 h-4 w-4" />
                          Resume {row.getIsSelected() && selectedHashes.length > 1 ? `(${selectedHashes.length})` : ''}
                        </ContextMenuItem>
                        <ContextMenuItem 
                          onClick={() => {
                            const hashes = row.getIsSelected() ? selectedHashes : [torrent.hash]
                            handleContextMenuAction('pause', hashes)
                          }}
                          disabled={mutation.isPending}
                        >
                          <Pause className="mr-2 h-4 w-4" />
                          Pause {row.getIsSelected() && selectedHashes.length > 1 ? `(${selectedHashes.length})` : ''}
                        </ContextMenuItem>
                        <ContextMenuItem 
                          onClick={() => {
                            const hashes = row.getIsSelected() ? selectedHashes : [torrent.hash]
                            handleContextMenuAction('recheck', hashes)
                          }}
                          disabled={mutation.isPending}
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Force Recheck {row.getIsSelected() && selectedHashes.length > 1 ? `(${selectedHashes.length})` : ''}
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem 
                          onClick={() => {
                            const hashes = row.getIsSelected() ? selectedHashes : [torrent.hash]
                            setContextMenuHashes(hashes)
                            setShowTagsDialog(true)
                          }}
                          disabled={mutation.isPending}
                        >
                          <Tag className="mr-2 h-4 w-4" />
                          Add Tags {row.getIsSelected() && selectedHashes.length > 1 ? `(${selectedHashes.length})` : ''}
                        </ContextMenuItem>
                        <ContextMenuItem 
                          onClick={() => {
                            const hashes = row.getIsSelected() ? selectedHashes : [torrent.hash]
                            setContextMenuHashes(hashes)
                            setShowCategoryDialog(true)
                          }}
                          disabled={mutation.isPending}
                        >
                          <Folder className="mr-2 h-4 w-4" />
                          Set Category {row.getIsSelected() && selectedHashes.length > 1 ? `(${selectedHashes.length})` : ''}
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem onClick={() => copyToClipboard(torrent.name)}>
                          <Copy className="mr-2 h-4 w-4" />
                          Copy Name
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => copyToClipboard(torrent.hash)}>
                          <Copy className="mr-2 h-4 w-4" />
                          Copy Hash
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          onClick={() => {
                            const hashes = row.getIsSelected() ? selectedHashes : [torrent.hash]
                            setContextMenuHashes(hashes)
                            setShowDeleteDialog(true)
                          }}
                          disabled={mutation.isPending}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete {row.getIsSelected() && selectedHashes.length > 1 ? `(${selectedHashes.length})` : ''}
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  )
                })}
              </div>
          </div>
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-between p-2 border-t flex-shrink-0">
          <div className="text-sm text-muted-foreground">
            {totalCount === 0 ? (
              'No torrents found'
            ) : (
              <>
                Showing {Math.min(loadedRows, totalCount)} of {totalCount} torrents
                {loadedRows < totalCount && ' (scroll to load more)'}
                {isLoadingMore && ' • Loading more...'}
              </>
            )}
            {selectedHashes.length > 0 && (
              <span className="ml-2">
                ({selectedHashes.length} selected)
              </span>
            )}
          </div>
          
          {virtualRows.length > 0 && (
            <div className="text-sm text-muted-foreground">
              Rendering rows {virtualRows[0].index + 1} - {virtualRows[virtualRows.length - 1].index + 1}
            </div>
          )}
        </div>
      </div>
      
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {contextMenuHashes.length} torrent(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The torrents will be removed from qBittorrent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center space-x-2 py-4">
            <input
              type="checkbox"
              id="deleteFiles"
              checked={deleteFiles}
              onChange={(e) => setDeleteFiles(e.target.checked)}
              className="rounded border-gray-300"
            />
            <label htmlFor="deleteFiles" className="text-sm font-medium">
              Also delete files from disk
            </label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Tags Dialog */}
      <AlertDialog open={showTagsDialog} onOpenChange={setShowTagsDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add Tags to {contextMenuHashes.length} torrent(s)</AlertDialogTitle>
            <AlertDialogDescription>
              Enter tags separated by commas (e.g., "music, flac, 2024")
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="tagsInputContext">Tags</Label>
            <Input
              id="tagsInputContext"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="Enter tags separated by commas"
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAddTags}
              disabled={!tagsInput.trim() || mutation.isPending}
            >
              Add Tags
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Set Category Dialog */}
      <AlertDialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Set Category for {contextMenuHashes.length} torrent(s)</AlertDialogTitle>
            <AlertDialogDescription>
              Enter a category name or leave empty to remove category
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="categoryInputContext">Category</Label>
            <Input
              id="categoryInputContext"
              value={categoryInput}
              onChange={(e) => setCategoryInput(e.target.value)}
              placeholder="Enter category name (or leave empty)"
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSetCategory}
              disabled={mutation.isPending}
            >
              Set Category
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}