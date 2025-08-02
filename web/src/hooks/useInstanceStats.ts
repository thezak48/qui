import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useInstanceStats(instanceId: number, options?: { enabled?: boolean; pollingInterval?: number }) {
  const { enabled = true, pollingInterval = 5000 } = options || {}
  
  return useQuery({
    queryKey: ['instance-stats', instanceId],
    queryFn: () => api.getInstanceStats(instanceId),
    enabled,
    refetchInterval: pollingInterval,
    staleTime: 2000,
    retry: 1,
    retryDelay: 1000,
  })
}