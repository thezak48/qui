import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { ChevronDown, Play, Pause, Trash2, CheckCircle } from 'lucide-react'

interface TorrentActionsProps {
  instanceId: number
  selectedHashes: string[]
  onComplete?: () => void
}

export function TorrentActions({ instanceId, selectedHashes, onComplete }: TorrentActionsProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteFiles, setDeleteFiles] = useState(false)
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (data: {
      action: 'pause' | 'resume' | 'delete' | 'recheck'
      deleteFiles?: boolean
    }) => {
      return api.bulkAction(instanceId, {
        hashes: selectedHashes,
        action: data.action,
        deleteFiles: data.deleteFiles,
      })
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['torrents', instanceId] })
      onComplete?.()
      
      // Show success toast
      const count = selectedHashes.length
      const torrentText = count === 1 ? 'torrent' : 'torrents'
      
      switch (variables.action) {
        case 'resume':
          toast.success(`Resumed ${count} ${torrentText}`)
          break
        case 'pause':
          toast.success(`Paused ${count} ${torrentText}`)
          break
        case 'delete':
          toast.success(`Deleted ${count} ${torrentText}${variables.deleteFiles ? ' and files' : ''}`)
          break
        case 'recheck':
          toast.success(`Started recheck for ${count} ${torrentText}`)
          break
      }
    },
    onError: (error, variables) => {
      const count = selectedHashes.length
      const torrentText = count === 1 ? 'torrent' : 'torrents'
      const actionText = variables.action === 'recheck' ? 'recheck' : variables.action
      
      toast.error(`Failed to ${actionText} ${count} ${torrentText}`, {
        description: error.message || 'An unexpected error occurred'
      })
    },
  })

  const handleDelete = async () => {
    await mutation.mutateAsync({ action: 'delete', deleteFiles })
    setShowDeleteDialog(false)
    setDeleteFiles(false)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" disabled={selectedHashes.length === 0}>
            Actions ({selectedHashes.length})
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => mutation.mutate({ action: 'resume' })}
            disabled={mutation.isPending}
          >
            <Play className="mr-2 h-4 w-4" />
            Resume
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => mutation.mutate({ action: 'pause' })}
            disabled={mutation.isPending}
          >
            <Pause className="mr-2 h-4 w-4" />
            Pause
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => mutation.mutate({ action: 'recheck' })}
            disabled={mutation.isPending}
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            Force Recheck
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setShowDeleteDialog(true)}
            disabled={mutation.isPending}
            className="text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedHashes.length} torrent(s)?</AlertDialogTitle>
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
    </>
  )
}