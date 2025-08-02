import { useState } from 'react'
import { useInstances } from '@/hooks/useInstances'
import { InstanceCard } from '@/components/instances/InstanceCard'
import { InstanceForm } from '@/components/instances/InstanceForm'
import { Button } from '@/components/ui/button'
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Plus } from 'lucide-react'
import type { Instance } from '@/types'

export function Instances() {
  const { instances, isLoading } = useInstances()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingInstance, setEditingInstance] = useState<Instance | undefined>()

  const handleOpenDialog = (instance?: Instance) => {
    setEditingInstance(instance)
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingInstance(undefined)
  }

  if (isLoading) {
    return <div className="p-6">Loading instances...</div>
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Instances</h1>
          <p className="text-muted-foreground mt-2">
            Manage your qBittorrent instances
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Add Instance
        </Button>
      </div>

      {instances && instances.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {instances.map((instance) => (
            <InstanceCard
              key={instance.id}
              instance={instance}
              onEdit={() => handleOpenDialog(instance)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">No instances configured</p>
          <Button 
            onClick={() => handleOpenDialog()} 
            className="mt-4"
            variant="outline"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add your first instance
          </Button>
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingInstance ? 'Edit Instance' : 'Add Instance'}
            </DialogTitle>
            <DialogDescription>
              {editingInstance 
                ? 'Update your qBittorrent instance configuration'
                : 'Add a new qBittorrent instance to manage'
              }
            </DialogDescription>
          </DialogHeader>
          <InstanceForm
            instance={editingInstance}
            onSuccess={handleCloseDialog}
            onCancel={handleCloseDialog}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}