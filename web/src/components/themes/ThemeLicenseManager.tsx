import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { 
  useHasPremiumAccess, 
  useValidateThemeLicense, 
  useDeleteThemeLicense,
  useRefreshThemeLicenses,
  useAllLicenses
} from '@/hooks/useThemeLicense'
import { themes, getPremiumThemes } from '@/config/themes'
import { Key, Trash2, RefreshCw, Crown, Palette, Check, Copy } from 'lucide-react'

export function ThemeLicenseManager() {
  const [showAddLicense, setShowAddLicense] = useState(false)
  const [selectedLicenseKey, setSelectedLicenseKey] = useState<string | null>(null)
  
  const { hasPremiumAccess, isLoading } = useHasPremiumAccess()
  const { data: licenses } = useAllLicenses()
  const premiumThemes = getPremiumThemes()
  const validateLicense = useValidateThemeLicense()
  const deleteLicense = useDeleteThemeLicense()
  const refreshLicenses = useRefreshThemeLicenses()

  const form = useForm({
    defaultValues: {
      licenseKey: '',
    },
    onSubmit: async ({ value }) => {
      await validateLicense.mutateAsync(value.licenseKey)
      form.reset()
      setShowAddLicense(false)
    },
  })

  const handleDeleteLicense = (licenseKey: string) => {
    setSelectedLicenseKey(licenseKey)
  }

  const confirmDeleteLicense = () => {
    if (selectedLicenseKey) {
      deleteLicense.mutate(selectedLicenseKey, {
        onSuccess: () => {
          setSelectedLicenseKey(null)
        }
      })
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5" />
            Premium Themes
          </CardTitle>
          <CardDescription>Loading theme licenses...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5" />
              Premium Themes
            </CardTitle>
            <CardDescription>
              Manage your premium theme licenses to unlock additional themes
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refreshLicenses.mutate()}
              disabled={refreshLicenses.isPending}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshLicenses.isPending ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => setShowAddLicense(!showAddLicense)}
            >
              <Key className="h-4 w-4 mr-2" />
              Add License
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {showAddLicense && (
          <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
            <div>
              <h4 className="font-medium mb-2">Add New License</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Enter your premium theme license key to unlock additional themes.
              </p>
            </div>
            
            <form
              onSubmit={(e) => {
                e.preventDefault()
                form.handleSubmit()
              }}
              className="space-y-4"
            >
              <form.Field
                name="licenseKey"
                validators={{
                  onChange: ({ value }) => 
                    !value ? 'License key is required' : undefined,
                }}
              >
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor="licenseKey">License Key</Label>
                    <Input
                      id="licenseKey"
                      placeholder="Enter your premium theme license key"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                    {field.state.meta.isTouched && field.state.meta.errors[0] && (
                      <p className="text-sm text-destructive">{field.state.meta.errors[0]}</p>
                    )}
                  </div>
                )}
              </form.Field>

              <div className="flex gap-2">
                <form.Subscribe
                  selector={(state) => [state.canSubmit, state.isSubmitting]}
                >
                  {([canSubmit, isSubmitting]) => (
                    <Button
                      type="submit"
                      disabled={!canSubmit || isSubmitting || validateLicense.isPending}
                    >
                      {isSubmitting || validateLicense.isPending ? 'Validating...' : 'Activate License'}
                    </Button>
                  )}
                </form.Subscribe>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddLicense(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}

        <div>
          <h4 className="font-medium mb-4 flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Licensed Themes
          </h4>
          
          {!hasPremiumAccess ? (
            <div className="text-center py-8 text-muted-foreground">
              <Crown className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No Premium Access</p>
              <p className="text-sm">
                You currently don't have premium access. Add a license key to unlock all premium themes.
              </p>
            </div>
          ) : (
            <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-primary" />
                <span className="font-medium">Premium Access Active</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                You have access to ALL premium themes!
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {premiumThemes.map((theme) => (
                  <div key={theme.id} className="flex items-center gap-2 text-sm">
                    <Check className="h-3 w-3 text-primary" />
                    <span>{theme.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Active Licenses */}
        {licenses && licenses.length > 0 && (
          <>
            <div>
              <h4 className="font-medium mb-4 flex items-center gap-2">
                <Key className="h-4 w-4" />
                Active Licenses
              </h4>
              <div className="space-y-2">
                {licenses.map((license) => (
                  <div key={license.licenseKey} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="flex-1">
                      <div className="font-mono text-sm">{license.licenseKey}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {license.themeName} • Added {new Date(license.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteLicense(license.licenseKey)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            <Separator />
          </>
        )}

        <div className="space-y-3">
          <h4 className="font-medium text-sm">Premium Theme Access</h4>
          
          {/* Check if user has premium access */}
          {hasPremiumAccess ? (
            <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-primary" />
                <span className="font-medium">Premium Access Active</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                You have access to ALL premium themes, including future releases!
              </p>
            </div>
          ) : (
            <div className="p-3 bg-muted/50 border border-border rounded-lg">
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Premium Access Available</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                One-time purchase unlocks ALL premium themes forever
              </p>
              <div className="flex gap-2 mt-2">
                <Button variant="outline" size="sm" asChild>
                  <a href="https://buy.polar.sh/polar_cl_yyXJesVM9pFVfAPIplspbfCukgVgXzXjXIc2N0I8WcL" target="_blank" rel="noopener noreferrer">
                    Get Premium Access - $9.99
                  </a>
                </Button>
              </div>
            </div>
          )}
          
          <div className="space-y-2 text-sm">
            <div>
              <span className="font-medium">Available Themes:</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">Free</Badge>
              <span>{themes.filter(t => !t.isPremium).length} themes</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                <Crown className="h-3 w-3 mr-1" />
                Premium
              </Badge>
              <span>{premiumThemes.length} themes + all future themes</span>
            </div>
          </div>
          
          <p className="text-xs text-muted-foreground">
            Premium access: One purchase unlocks everything forever.
          </p>
        </div>
      </CardContent>
    </Card>

    {/* Delete License Confirmation Dialog */}
    <Dialog open={!!selectedLicenseKey} onOpenChange={(open) => !open && setSelectedLicenseKey(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Release License Key</DialogTitle>
          <DialogDescription>
            Are you sure you want to release this license? This will remove it from your account and allow it to be used elsewhere.
          </DialogDescription>
        </DialogHeader>
        
        {selectedLicenseKey && (
          <div className="my-4 space-y-3">
            <div>
              <Label className="text-sm font-medium">License Key to Release:</Label>
              <div className="mt-2 p-3 bg-muted rounded-lg font-mono text-sm break-all">
                {selectedLicenseKey}
              </div>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                navigator.clipboard.writeText(selectedLicenseKey)
                toast.success('License key copied to clipboard')
              }}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy License Key
            </Button>
            
            <div className="text-sm text-muted-foreground">
              <strong>Important:</strong> Make sure to copy this license key before releasing it. Once released, you won't be able to see it again.
            </div>
          </div>
        )}
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setSelectedLicenseKey(null)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={confirmDeleteLicense}
            disabled={deleteLicense.isPending}
          >
            {deleteLicense.isPending ? 'Releasing...' : 'Release License'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}