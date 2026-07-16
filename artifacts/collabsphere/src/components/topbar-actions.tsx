import { Link } from "wouter";
import { Settings, Palette, Check } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useTheme, THEME_META, type Theme } from "@/lib/theme-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const THEME_ORDER: Theme[] = ["dark", "light", "sand", "glass"];

/** Settings / theme-switcher / profile icons shared by every top-level header. */
export default function TopbarActions() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center gap-1.5">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Change theme"
            data-testid="button-theme-switcher"
          >
            <Palette className="w-4.5 h-4.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Appearance</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {THEME_ORDER.map((t) => (
            <DropdownMenuItem
              key={t}
              onClick={() => setTheme(t)}
              className="flex items-center justify-between cursor-pointer"
              data-testid={`option-theme-${t}`}
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium">{THEME_META[t].label}</span>
                <span className="text-xs text-muted-foreground">{THEME_META[t].description}</span>
              </div>
              {theme === t && <Check className="w-4 h-4 text-primary shrink-0 ml-2" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Link
        href="/settings"
        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        title="Settings"
        data-testid="link-settings"
      >
        <Settings className="w-4.5 h-4.5" />
      </Link>

      <Link
        href="/profile"
        className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-muted transition-colors"
        title="Your profile"
        data-testid="link-profile"
      >
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border border-border text-white shrink-0"
          style={{ backgroundColor: user?.avatarColor || "#4f46e5" }}
        >
          {user?.name?.charAt(0).toUpperCase()}
        </div>
      </Link>
    </div>
  );
}
