import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

export function formatSpeed(bytesPerSecond: number, compact: boolean = false): string {
  if (!bytesPerSecond || bytesPerSecond === 0) return compact ? '0' : '0 B/s'
  const k = 1024
  const sizes = compact ? ['B', 'K', 'M', 'G'] : ['B/s', 'KB/s', 'MB/s', 'GB/s']
  const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k))
  const value = parseFloat((bytesPerSecond / Math.pow(k, i)).toFixed(i > 0 ? 1 : 0))
  return `${value}${sizes[i]}`
}