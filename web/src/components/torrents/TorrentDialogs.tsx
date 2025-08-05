import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { Plus } from 'lucide-react'

interface SetTagsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  availableTags: string[]
  hashCount: number
  onConfirm: (tags: string[]) => void
  isPending?: boolean
  initialTags?: string[]
}

export function SetTagsDialog({
  open,
  onOpenChange,
  availableTags,
  hashCount,
  onConfirm,
  isPending = false,
  initialTags = [],
}: SetTagsDialogProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const wasOpen = useRef(false)
  
  // Initialize selected tags only when dialog transitions from closed to open
  useEffect(() => {
    if (open && !wasOpen.current) {
      setSelectedTags(initialTags)
    }
    wasOpen.current = open
  }, [open, initialTags])

  const handleConfirm = () => {
    const allTags = [...selectedTags]
    if (newTag.trim() && !allTags.includes(newTag.trim())) {
      allTags.push(newTag.trim())
    }
    
    if (allTags.length > 0) {
      onConfirm(allTags)
      // Reset state
      setSelectedTags([])
      setNewTag('')
    }
  }

  const handleCancel = () => {
    setSelectedTags([])
    setNewTag('')
    onOpenChange(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Set Tags for {hashCount} torrent(s)</AlertDialogTitle>
          <AlertDialogDescription>
            Select tags from the list or add a new one. Selected tags will replace all existing tags on the torrents.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4 space-y-4">
          {/* Existing tags */}
          {availableTags && availableTags.length > 0 && (
            <div className="space-y-2">
              <Label>Available Tags</Label>
              <ScrollArea className="h-48 border rounded-md p-3">
                <div className="space-y-2">
                  {availableTags.map((tag) => (
                    <div key={tag} className="flex items-center space-x-2">
                      <Checkbox
                        id={`tag-${tag}`}
                        checked={selectedTags.includes(tag)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedTags([...selectedTags, tag])
                          } else {
                            setSelectedTags(selectedTags.filter(t => t !== tag))
                          }
                        }}
                      />
                      <label
                        htmlFor={`tag-${tag}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {tag}
                      </label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
          
          {/* Add new tag */}
          <div className="space-y-2">
            <Label htmlFor="newTag">Add New Tag</Label>
            <div className="flex gap-2">
              <Input
                id="newTag"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Enter new tag"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newTag.trim()) {
                    e.preventDefault()
                    if (!selectedTags.includes(newTag.trim())) {
                      setSelectedTags([...selectedTags, newTag.trim()])
                      setNewTag('')
                    }
                  }
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  if (newTag.trim() && !selectedTags.includes(newTag.trim())) {
                    setSelectedTags([...selectedTags, newTag.trim()])
                    setNewTag('')
                  }
                }}
                disabled={!newTag.trim() || selectedTags.includes(newTag.trim())}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Selected tags summary */}
          {selectedTags.length > 0 && (
            <div className="text-sm text-muted-foreground">
              Selected: {selectedTags.join(', ')}
            </div>
          )}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={(selectedTags.length === 0 && !newTag.trim()) || isPending}
          >
            Set Tags
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

interface SetCategoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  availableCategories: Record<string, any>
  hashCount: number
  onConfirm: (category: string) => void
  isPending?: boolean
  initialCategory?: string
}

export function SetCategoryDialog({
  open,
  onOpenChange,
  availableCategories,
  hashCount,
  onConfirm,
  isPending = false,
  initialCategory = '',
}: SetCategoryDialogProps) {
  const [categoryInput, setCategoryInput] = useState('')
  const wasOpen = useRef(false)
  
  // Initialize category only when dialog transitions from closed to open
  useEffect(() => {
    if (open && !wasOpen.current) {
      setCategoryInput(initialCategory)
    }
    wasOpen.current = open
  }, [open, initialCategory])

  const handleConfirm = () => {
    onConfirm(categoryInput)
    setCategoryInput('')
  }

  const handleCancel = () => {
    setCategoryInput('')
    onOpenChange(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Set Category for {hashCount} torrent(s)</AlertDialogTitle>
          <AlertDialogDescription>
            Select a category from the list or create a new one
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={categoryInput || "__none__"} onValueChange={(value) => setCategoryInput(value === "__none__" ? "" : value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  <span className="text-muted-foreground">(No category)</span>
                </SelectItem>
                {availableCategories && Object.keys(availableCategories).map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Option to enter new category */}
          <div className="space-y-2">
            <Label htmlFor="newCategory">Or create new category</Label>
            <Input
              id="newCategory"
              placeholder="Enter new category name"
              value={categoryInput && categoryInput !== "__none__" && (!availableCategories || !Object.keys(availableCategories).includes(categoryInput)) ? categoryInput : ''}
              onChange={(e) => setCategoryInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleConfirm()
                }
              }}
            />
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isPending}
          >
            Set Category
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}