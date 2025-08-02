import { TorrentTableSync } from '@/components/torrents/TorrentTableSync'

interface TorrentsProps {
  instanceId: number
  instanceName: string
}

export function Torrents({ instanceId, instanceName }: TorrentsProps) {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{instanceName}</h1>
        <p className="text-muted-foreground mt-2">
          Manage torrents for this qBittorrent instance
        </p>
      </div>
      <TorrentTableSync instanceId={instanceId} />
    </div>
  )
}