import { useInstances } from '@/hooks/useInstances'
import { useTorrentsSync } from '@/hooks/useTorrentsSync'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { HardDrive, Download, Upload, AlertCircle } from 'lucide-react'
import { Link } from '@tanstack/react-router'

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

function InstanceCard({ instance }: { instance: any }) {
  const { stats } = useTorrentsSync(instance.id, { 
    pollingInterval: 5000 // Slower polling for dashboard
  })
  
  const downloadSpeed = stats.totalDownloadSpeed
  const uploadSpeed = stats.totalUploadSpeed
  
  return (
    <Link to="/instances/$instanceId" params={{ instanceId: instance.id.toString() }}>
      <Card className="hover:shadow-lg transition-shadow cursor-pointer">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{instance.name}</CardTitle>
            <Badge variant={instance.isActive ? 'default' : 'destructive'}>
              {instance.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <CardDescription>{instance.host}:{instance.port}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Total</p>
                <p className="font-semibold">{stats.total}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Active</p>
                <p className="font-semibold">{stats.downloading + stats.seeding}</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1">
                  <Download className="h-3 w-3" />
                  Download
                </span>
                <span className="font-mono">{formatSpeed(downloadSpeed)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1">
                  <Upload className="h-3 w-3" />
                  Upload
                </span>
                <span className="font-mono">{formatSpeed(uploadSpeed)}</span>
              </div>
            </div>
            
            {stats.error > 0 && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="h-4 w-4" />
                {stats.error} torrents with errors
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

export function Dashboard() {
  const { instances, isLoading } = useInstances()
  
  if (isLoading) {
    return <div className="p-6">Loading...</div>
  }
  
  const activeInstances = instances?.filter(i => i.isActive) || []
  const inactiveInstances = instances?.filter(i => !i.isActive) || []
  
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Overview of all your qBittorrent instances
        </p>
      </div>
      
      {instances && instances.length > 0 ? (
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Instances</CardTitle>
                <HardDrive className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{instances.length}</div>
                <p className="text-xs text-muted-foreground">
                  {activeInstances.length} active, {inactiveInstances.length} inactive
                </p>
              </CardContent>
            </Card>
          </div>
          
          {/* Active Instances */}
          {activeInstances.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Active Instances</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {activeInstances.map(instance => (
                  <InstanceCard key={instance.id} instance={instance} />
                ))}
              </div>
            </div>
          )}
          
          {/* Inactive Instances */}
          {inactiveInstances.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4 text-muted-foreground">Inactive Instances</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 opacity-60">
                {inactiveInstances.map(instance => (
                  <InstanceCard key={instance.id} instance={instance} />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground mb-4">No instances configured</p>
          <Link to="/instances">
            <Badge variant="outline" className="cursor-pointer">
              Go to Instances
            </Badge>
          </Link>
        </Card>
      )}
    </div>
  )
}