import { useState, useEffect, useCallback } from "react";
import {
  getCurrentThemeMode,
  getCurrentTheme,
  setTheme,
  setThemeMode,
  themes,
  type ThemeMode,
} from "@/utils/theme";
import { Sun, Moon, Monitor, Check, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// Constants
const THEME_CHANGE_EVENT = "themechange";

// Custom hook for theme change detection
const useThemeChange = () => {
  const [currentMode, setCurrentMode] = useState<ThemeMode>(getCurrentThemeMode());
  const [currentTheme, setCurrentTheme] = useState(getCurrentTheme());

  const checkTheme = useCallback(() => {
    setCurrentMode(getCurrentThemeMode());
    setCurrentTheme(getCurrentTheme());
  }, []);

  useEffect(() => {
    const handleThemeChange = () => {
      checkTheme();
    };

    window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);
    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange);
    };
  }, [checkTheme]);

  return { currentMode, currentTheme };
};

export const ThemeToggle: React.FC = () => {
  const { currentMode, currentTheme } = useThemeChange();
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleModeSelect = useCallback(async (mode: ThemeMode) => {
    setIsTransitioning(true);
    await setThemeMode(mode);
    setTimeout(() => setIsTransitioning(false), 400);
  }, []);

  const handleThemeSelect = useCallback(async (themeId: string) => {
    setIsTransitioning(true);
    await setTheme(themeId);
    setTimeout(() => setIsTransitioning(false), 400);
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "text-muted-foreground hover:text-foreground transition-transform duration-300",
            isTransitioning && "animate-spin-slow"
          )}
        >
          <Palette className="h-5 w-5" />
          <span className="sr-only">Change theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* Mode Selection */}
        <div className="px-2 py-1.5 text-sm font-medium">Mode</div>
        <DropdownMenuItem
          onClick={() => handleModeSelect("light")}
          className="flex items-center gap-2"
        >
          <Sun className="h-4 w-4" />
          <span className="flex-1">Light</span>
          {currentMode === "light" && <Check className="h-4 w-4" />}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleModeSelect("dark")}
          className="flex items-center gap-2"
        >
          <Moon className="h-4 w-4" />
          <span className="flex-1">Dark</span>
          {currentMode === "dark" && <Check className="h-4 w-4" />}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleModeSelect("auto")}
          className="flex items-center gap-2"
        >
          <Monitor className="h-4 w-4" />
          <span className="flex-1">System</span>
          {currentMode === "auto" && <Check className="h-4 w-4" />}
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {/* Theme Selection */}
        <div className="px-2 py-1.5 text-sm font-medium">Theme</div>
        {themes.map((theme) => (
          <DropdownMenuItem
            key={theme.id}
            onClick={() => handleThemeSelect(theme.id)}
            className="flex items-center gap-2"
          >
            <div className="flex items-center gap-2 flex-1">
              <div
                className={cn(
                  "h-4 w-4 rounded-full ring-2 ring-offset-2 ring-offset-background transition-all duration-200",
                  theme.id === "default" && "bg-indigo-400 ring-indigo-400",
                  theme.id === "purple" && "bg-purple-500 ring-purple-500",
                  theme.id === "amber-minimal" && "bg-amber-500 ring-amber-500",
                  theme.id === "bubblegum" && "bg-pink-500 ring-pink-500",
                  theme.id === "perpetuity" && "bg-cyan-500 ring-cyan-500",
                  currentTheme.id === theme.id && "scale-110"
                )}
              />
              <span>{theme.name}</span>
            </div>
            {currentTheme.id === theme.id && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};