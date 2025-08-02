import { createFileRoute, Navigate } from '@tanstack/react-router'
import { Torrents } from '@/pages/Torrents'
import { useInstances } from '@/hooks/useInstances'

export const Route = createFileRoute('/_authenticated/instances/$instanceId')({
  component: InstanceTorrents,
})

function InstanceTorrents() {
  const { instanceId } = Route.useParams()
  const { instances, isLoading } = useInstances()
  
  if (isLoading) {
    return <div>Loading...</div>
  }
  
  const instance = instances?.find(i => i.id === parseInt(instanceId))
  
  if (!instance) {
    return <Navigate to="/instances" />
  }
  
  return <Torrents instanceId={parseInt(instanceId)} instanceName={instance.name} />
}