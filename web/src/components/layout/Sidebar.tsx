import { Link, useLocation } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { 
  Home, 
  Server, 
  Settings, 
  LogOut,
  HardDrive
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/hooks/useAuth'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

const navigation: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: Home,
  },
  {
    title: 'Instances',
    href: '/instances',
    icon: Server,
  },
  {
    title: 'Settings',
    href: '/settings',
    icon: Settings,
  },
]

export function Sidebar() {
  const location = useLocation()
  const { logout } = useAuth()
  
  const { data: instances } = useQuery({
    queryKey: ['instances'],
    queryFn: () => api.getInstances(),
  })

  return (
    <div className="flex h-full w-64 flex-col border-r bg-muted/50">
      <div className="p-6">
        <h2 className="text-lg font-semibold">autobrr/qbitwebui</h2>
      </div>
      
      <nav className="flex-1 space-y-1 px-3">
        {navigation.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.href
          
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {item.title}
            </Link>
          )
        })}
        
        <Separator className="my-4" />
        
        <div className="space-y-1">
          <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Instances
          </p>
          {instances?.map((instance) => {
            const instancePath = `/instances/${instance.id}`
            const isActive = location.pathname === instancePath
            
            return (
              <Link
                key={instance.id}
                to="/instances/$instanceId"
                params={{ instanceId: instance.id.toString() }}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground'
                )}
              >
                <HardDrive className="h-4 w-4" />
                <span className="truncate">{instance.name}</span>
                <span
                  className={cn(
                    'ml-auto h-2 w-2 rounded-full',
                    instance.isActive ? 'bg-green-500' : 'bg-red-500'
                  )}
                />
              </Link>
            )
          })}
          {(!instances || instances.length === 0) && (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              No instances configured
            </p>
          )}
        </div>
      </nav>
      
      <div className="border-t p-3">
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={() => logout()}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  )
}