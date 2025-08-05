import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

interface CreateTagDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  instanceId: number
}

export function CreateTagDialog({ open, onOpenChange, instanceId }: CreateTagDialogProps) {
  const [newTag, setNewTag] = useState('')
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (tags: string[]) => api.createTags(instanceId, tags),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags', instanceId] })
      toast.success('Tag created successfully')
      setNewTag('')
      onOpenChange(false)
    },
    onError: (error: Error) => {
      toast.error('Failed to create tag', {
        description: error.message
      })
    }
  })

  const handleCreate = () => {
    if (newTag.trim()) {
      mutation.mutate([newTag.trim()])
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Create New Tag</AlertDialogTitle>
          <AlertDialogDescription>
            Enter a name for the new tag
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4">
          <Label htmlFor="newTag">Tag Name</Label>
          <Input
            id="newTag"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder="Enter tag name"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCreate()
              }
            }}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setNewTag('')}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleCreate}
            disabled={!newTag.trim() || mutation.isPending}
          >
            Create
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

interface DeleteTagDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  instanceId: number
  tag: string
}

export function DeleteTagDialog({ open, onOpenChange, instanceId, tag }: DeleteTagDialogProps) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => api.deleteTags(instanceId, [tag]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags', instanceId] })
      toast.success('Tag deleted successfully')
      onOpenChange(false)
    },
    onError: (error: Error) => {
      toast.error('Failed to delete tag', {
        description: error.message
      })
    }
  })

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Tag</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete the tag "{tag}"? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

interface CreateCategoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  instanceId: number
}

export function CreateCategoryDialog({ open, onOpenChange, instanceId }: CreateCategoryDialogProps) {
  const [name, setName] = useState('')
  const [savePath, setSavePath] = useState('')
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: ({ name, savePath }: { name: string; savePath?: string }) => 
      api.createCategory(instanceId, name, savePath),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', instanceId] })
      toast.success('Category created successfully')
      setName('')
      setSavePath('')
      onOpenChange(false)
    },
    onError: (error: Error) => {
      toast.error('Failed to create category', {
        description: error.message
      })
    }
  })

  const handleCreate = () => {
    if (name.trim()) {
      mutation.mutate({ name: name.trim(), savePath: savePath.trim() || undefined })
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Create New Category</AlertDialogTitle>
          <AlertDialogDescription>
            Enter details for the new category
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4 space-y-4">
          <div>
            <Label htmlFor="categoryName">Category Name</Label>
            <Input
              id="categoryName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter category name"
            />
          </div>
          <div>
            <Label htmlFor="savePath">Save Path (optional)</Label>
            <Input
              id="savePath"
              value={savePath}
              onChange={(e) => setSavePath(e.target.value)}
              placeholder="e.g. /downloads/movies"
            />
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => {
            setName('')
            setSavePath('')
          }}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleCreate}
            disabled={!name.trim() || mutation.isPending}
          >
            Create
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

interface EditCategoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  instanceId: number
  category: { name: string; savePath: string }
}

export function EditCategoryDialog({ open, onOpenChange, instanceId, category }: EditCategoryDialogProps) {
  const [savePath, setSavePath] = useState(category.savePath)
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (savePath: string) => api.editCategory(instanceId, category.name, savePath),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', instanceId] })
      toast.success('Category updated successfully')
      onOpenChange(false)
    },
    onError: (error: Error) => {
      toast.error('Failed to update category', {
        description: error.message
      })
    }
  })

  const handleSave = () => {
    mutation.mutate(savePath.trim())
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Edit Category: {category.name}</AlertDialogTitle>
          <AlertDialogDescription>
            Update the save path for this category
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4">
          <Label htmlFor="editSavePath">Save Path</Label>
          <Input
            id="editSavePath"
            value={savePath}
            onChange={(e) => setSavePath(e.target.value)}
            placeholder="e.g. /downloads/movies"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSave()
              }
            }}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleSave}
            disabled={mutation.isPending}
          >
            Save
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

interface DeleteCategoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  instanceId: number
  categoryName: string
}

export function DeleteCategoryDialog({ open, onOpenChange, instanceId, categoryName }: DeleteCategoryDialogProps) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => api.removeCategories(instanceId, [categoryName]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', instanceId] })
      toast.success('Category deleted successfully')
      onOpenChange(false)
    },
    onError: (error: Error) => {
      toast.error('Failed to delete category', {
        description: error.message
      })
    }
  })

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Category</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete the category "{categoryName}"? 
            Torrents in this category will become uncategorized.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}