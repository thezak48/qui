import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import type { Torrent } from '@/types'

interface TorrentDetailsPanelProps {
  instanceId: number
  torrent: Torrent | null
  isAnimating?: boolean
}

// Helper functions
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

function formatTimestamp(timestamp: number): string {
  if (!timestamp || timestamp === 0) return 'N/A'
  return new Date(timestamp * 1000).toLocaleString()
}

function formatDuration(seconds: number): string {
  if (seconds === 0) return '0s'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  
  const parts = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  if (secs > 0) parts.push(`${secs}s`)
  
  return parts.join(' ')
}

function getTrackerStatusBadge(status: number) {
  switch (status) {
    case 0:
      return <Badge variant="secondary">Disabled</Badge>
    case 1:
      return <Badge variant="secondary">Not contacted</Badge>
    case 2:
      return <Badge variant="default">Working</Badge>
    case 3:
      return <Badge variant="default">Updating</Badge>
    case 4:
      return <Badge variant="destructive">Error</Badge>
    default:
      return <Badge variant="outline">Unknown</Badge>
  }
}

export function TorrentDetailsPanel({ instanceId, torrent, isAnimating }: TorrentDetailsPanelProps) {
  const [activeTab, setActiveTab] = useState('general')

  // Reset tab when torrent changes
  useEffect(() => {
    setActiveTab('general')
  }, [torrent?.hash])

  // Fetch torrent properties (delayed during animation)
  const { data: properties, isLoading: loadingProperties } = useQuery({
    queryKey: ['torrent-properties', instanceId, torrent?.hash],
    queryFn: () => api.getTorrentProperties(instanceId, torrent!.hash),
    enabled: !!torrent && !isAnimating,
  })

  // Fetch torrent trackers (delayed during animation)
  const { data: trackers, isLoading: loadingTrackers } = useQuery({
    queryKey: ['torrent-trackers', instanceId, torrent?.hash],
    queryFn: () => api.getTorrentTrackers(instanceId, torrent!.hash),
    enabled: !!torrent && activeTab === 'trackers' && !isAnimating,
  })

  // Fetch torrent files (delayed during animation)
  const { data: files, isLoading: loadingFiles } = useQuery({
    queryKey: ['torrent-files', instanceId, torrent?.hash],
    queryFn: () => api.getTorrentFiles(instanceId, torrent!.hash),
    enabled: !!torrent && activeTab === 'content' && !isAnimating,
  })

  if (!torrent) return null

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-3 border-b">
        <h3 className="text-sm font-medium truncate flex-1" title={torrent.name}>
          {torrent.name}
        </h3>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="w-full justify-start rounded-none border-b h-9">
          <TabsTrigger value="general" className="text-xs">General</TabsTrigger>
          <TabsTrigger value="trackers" className="text-xs">Trackers</TabsTrigger>
          <TabsTrigger value="content" className="text-xs">Content</TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1">
          <TabsContent value="general" className="m-0 p-4">
            {loadingProperties ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : properties ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Total Size:</span>
                    <span className="ml-2">{formatBytes(properties.totalSize || torrent.size)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Pieces:</span>
                    <span className="ml-2">{properties.piecesHave || 0} / {properties.piecesNum || 0} ({formatBytes(properties.pieceSize || 0)})</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Downloaded:</span>
                    <span className="ml-2">{formatBytes(properties.totalDownloaded || 0)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Uploaded:</span>
                    <span className="ml-2">{formatBytes(properties.totalUploaded || 0)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Share Ratio:</span>
                    <span className="ml-2">{(properties.shareRatio || 0).toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Seeds:</span>
                    <span className="ml-2">{properties.seeds || 0} ({properties.seedsTotal || 0})</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Peers:</span>
                    <span className="ml-2">{properties.peers || 0} ({properties.peersTotal || 0})</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Wasted:</span>
                    <span className="ml-2">{formatBytes(properties.totalWasted || 0)}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div>
                    <span className="text-sm text-muted-foreground">Download Speed:</span>
                    <span className="ml-2 text-sm">{formatSpeed(properties.dlSpeed || 0)} (avg: {formatSpeed(properties.dlSpeedAvg || 0)})</span>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Upload Speed:</span>
                    <span className="ml-2 text-sm">{formatSpeed(properties.upSpeed || 0)} (avg: {formatSpeed(properties.upSpeedAvg || 0)})</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div>
                    <span className="text-sm text-muted-foreground">Time Active:</span>
                    <span className="ml-2 text-sm">{formatDuration(properties.timeElapsed || 0)}</span>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Seeding Time:</span>
                    <span className="ml-2 text-sm">{formatDuration(properties.seedingTime || 0)}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div>
                    <span className="text-sm text-muted-foreground">Save Path:</span>
                    <div className="text-sm mt-1 font-mono text-xs bg-muted p-2 rounded break-all">
                      {properties.savePath || 'N/A'}
                    </div>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Download Path:</span>
                    <div className="text-sm mt-1 font-mono text-xs bg-muted p-2 rounded break-all">
                      {properties.downloadPath || properties.savePath || 'N/A'}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div>
                    <span className="text-sm text-muted-foreground">Added On:</span>
                    <span className="ml-2 text-sm">{formatTimestamp(properties.additionDate)}</span>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Completed On:</span>
                    <span className="ml-2 text-sm">{formatTimestamp(properties.completionDate)}</span>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Created On:</span>
                    <span className="ml-2 text-sm">{formatTimestamp(properties.creationDate)}</span>
                  </div>
                </div>

                {properties.comment && (
                  <div>
                    <span className="text-sm text-muted-foreground">Comment:</span>
                    <div className="text-sm mt-1 bg-muted p-2 rounded">
                      {properties.comment}
                    </div>
                  </div>
                )}

                {properties.createdBy && (
                  <div>
                    <span className="text-sm text-muted-foreground">Created By:</span>
                    <span className="ml-2 text-sm">{properties.createdBy}</span>
                  </div>
                )}
              </div>
            ) : null}
          </TabsContent>

          <TabsContent value="trackers" className="m-0 p-4">
            {loadingTrackers ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : trackers && trackers.length > 0 ? (
              <div className="space-y-2">
                {trackers.map((tracker, index) => (
                  <div key={index} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-mono break-all">{tracker.url}</span>
                      {getTrackerStatusBadge(tracker.status)}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div>Seeds: {tracker.numSeeds}</div>
                      <div>Peers: {tracker.numPeers}</div>
                      <div>Leechers: {tracker.numLeechers}</div>
                      <div>Downloaded: {tracker.numDownloaded}</div>
                    </div>
                    {tracker.msg && (
                      <div className="text-xs text-muted-foreground">{tracker.msg}</div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground text-center p-4">
                No trackers found
              </div>
            )}
          </TabsContent>

          <TabsContent value="content" className="m-0 p-4">
            {loadingFiles ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : files && files.length > 0 ? (
              <div className="space-y-1">
                {files.map((file, index) => (
                  <div key={index} className="border rounded p-2 space-y-1">
                    <div className="text-sm font-mono break-all">{file.name}</div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatBytes(file.size)}</span>
                      <div className="flex items-center gap-2">
                        <Progress value={file.progress * 100} className="w-20 h-2" />
                        <span>{Math.round(file.progress * 100)}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground text-center p-4">
                No files found
              </div>
            )}
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  )
}