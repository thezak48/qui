import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { themes, isThemePremium, type Theme } from '@/config/themes'
import { useHasPremiumAccess } from '@/hooks/useThemeLicense'
import { useTheme } from '@/hooks/useTheme'
import { Sparkles, Lock, Check, Palette } from 'lucide-react'

interface ThemeCardProps {
  theme: Theme
  isSelected: boolean
  isLocked: boolean
  onSelect: () => void
}

function ThemeCard({ theme, isSelected, isLocked, onSelect }: ThemeCardProps) {
  return (
    <Card 
      className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
        isSelected ? 'ring-2 ring-primary' : ''
      } ${isLocked ? 'opacity-60' : ''}`}
      onClick={!isLocked ? onSelect : undefined}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {theme.name}
            {isSelected && (
              <Check className="h-4 w-4 text-green-500" />
            )}
          </CardTitle>
          {isLocked && (
            <Lock className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        {theme.description && (
          <CardDescription className="text-xs">
            {theme.description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          {theme.isPremium ? (
            <Badge variant="secondary" className="text-xs">
              <Sparkles className="h-3 w-3 mr-1" />
              Premium
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs">
              Free
            </Badge>
          )}
          
          {isLocked && (
            <Badge variant="destructive" className="text-xs">
              <Lock className="h-3 w-3 mr-1" />
              Locked
            </Badge>
          )}
        </div>
        
        {/* Theme preview colors */}
        <div className="mt-3 flex gap-1">
          <div 
            className="w-4 h-4 rounded-full border"
            style={{ backgroundColor: 'hsl(var(--primary))' }}
          />
          <div 
            className="w-4 h-4 rounded-full border"
            style={{ backgroundColor: 'hsl(var(--secondary))' }}
          />
          <div 
            className="w-4 h-4 rounded-full border"
            style={{ backgroundColor: 'hsl(var(--accent))' }}
          />
        </div>
      </CardContent>
    </Card>
  )
}

export function ThemeSelector() {
  const { theme: currentTheme, setTheme } = useTheme()
  const { hasPremiumAccess, isLoading } = useHasPremiumAccess()
  
  const isThemeLicensed = (themeId: string) => {
    if (!isThemePremium(themeId)) return true // Free themes are always available
    return hasPremiumAccess // Premium themes require premium access
  }
  
  const freeThemes = themes.filter(theme => !theme.isPremium)
  const premiumThemes = themes.filter(theme => theme.isPremium)
  
  const handleThemeSelect = (themeId: string) => {
    if (isThemeLicensed(themeId)) {
      setTheme(themeId)
    }
  }
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Theme Selection
          </CardTitle>
          <CardDescription>Loading available themes...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-24 bg-muted rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Theme Selection
        </CardTitle>
        <CardDescription>
          Choose from available themes. Premium themes require a valid license.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Free Themes */}
        <div>
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <Badge variant="outline" className="text-xs">Free</Badge>
            Available Themes
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {freeThemes.map((theme) => (
              <ThemeCard
                key={theme.id}
                theme={theme}
                isSelected={currentTheme === theme.id}
                isLocked={false}
                onSelect={() => handleThemeSelect(theme.id)}
              />
            ))}
          </div>
        </div>
        
        <Separator />
        
        {/* Premium Themes */}
        <div>
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              <Sparkles className="h-3 w-3 mr-1" />
              Premium
            </Badge>
            Premium Themes
          </h4>
          
          {premiumThemes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No premium themes available yet. Check back later for new themes!
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {premiumThemes.map((theme) => {
                const isLicensed = isThemeLicensed(theme.id)
                return (
                  <ThemeCard
                    key={theme.id}
                    theme={theme}
                    isSelected={currentTheme === theme.id}
                    isLocked={!isLicensed}
                    onSelect={() => handleThemeSelect(theme.id)}
                  />
                )
              })}
            </div>
          )}
        </div>
        
        
        {/* Current theme info */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Current theme: <span className="font-medium">{themes.find(t => t.id === currentTheme)?.name || 'Unknown'}</span>
          </p>
        </div>
      </CardContent>
    </Card>
  )
}