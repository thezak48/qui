export interface User {
  id: number
  username: string
  createdAt: string
  updatedAt: string
}

export interface AuthResponse {
  user: User
  message?: string
}

export interface Instance {
  id: number
  name: string
  host: string
  port: number
  username: string
  isActive: boolean
  lastConnectedAt?: string
  createdAt: string
  updatedAt: string
}

export interface Torrent {
  hash: string
  name: string
  size: number
  progress: number
  dlspeed: number
  upspeed: number
  priority: number
  numSeeds: number
  numLeechs: number
  ratio: number
  eta: number
  state: string
  category: string
  tags: string[]
  addedOn: number
  completionOn: number
  tracker: string
  dlLimit: number
  upLimit: number
  downloaded: number
  uploaded: number
  downloadedSession: number
  uploadedSession: number
  amountLeft: number
  saveLocation: string
  completed: number
  ratioLimit: number
  seenComplete: number
  lastActivity: number
  timeActive: number
  autoTmm: boolean
  totalSize: number
  maxRatio: number
  maxSeedingTime: number
  seedingTimeLimit: number
}

export interface TorrentStats {
  total: number
  downloading: number
  seeding: number
  paused: number
  error: number
  totalDownloadSpeed?: number
  totalUploadSpeed?: number
}

export interface TorrentResponse {
  torrents: Torrent[]
  total: number
  stats?: TorrentStats
}

export interface MainData {
  rid: number
  fullUpdate: boolean
  torrents?: Record<string, Torrent>
  torrentsRemoved?: string[]
  categories?: Record<string, Category>
  categoriesRemoved?: string[]
  tags?: string[]
  tagsRemoved?: string[]
  serverState?: ServerState
}

export interface Category {
  name: string
  savePath: string
}

export interface ServerState {
  connectionStatus: string
  dhtNodes: number
  dlInfoData: number
  dlInfoSpeed: number
  dlRateLimit: number
  upInfoData: number
  upInfoSpeed: number
  upRateLimit: number
  queueing: boolean
  useAltSpeedLimits: boolean
  refreshInterval: number
}