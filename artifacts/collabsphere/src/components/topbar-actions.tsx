import { Link } from "wouter";
import { Settings, Palette, Check, Bell } from "lucide-react";
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
import React, { useState } from 'react';

const THEME_ORDER: Theme[] = ["dark", "light", "sand", "glass"];

/** Settings / theme-switcher / profile icons shared by every top-level header. */
export default function TopbarActions() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();

  // Notification States
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(3);
  const [notifications, setNotifications] = useState([
    { id: 1, text: "Someone updated the project schema", time: "2m ago", unread: true },
    { id: 2, text: "Export data request processed", time: "15m ago", unread: true },
    { id: 3, text: "New collaborator joined the active workspace", time: "1h ago", unread: true },
  ]);

  const handleMarkAllRead = () => {
    setUnreadCount(0);
    setNotifications(notifications.map(n => ({ ...n, unread: false })));
  };

  return (
    <div className="flex items-center gap-1.5">
      
      {/* 🔔 WORKING NOTIFICATION BELL DROPDOWN */}
      <div className="relative inline-block text-left">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Notifications"
        >
          <Bell className="w-4.5 h-4.5" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          )}
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
            <div className="absolute right-0 mt-2 w-72 rounded-xl border border-border bg-popover text-popover-foreground p-2 shadow-xl z-20 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between p-2 border-b border-border mb-1">
                <h3 className="text-xs font-semibold">Notifications</h3>
                {unreadCount > 0 && (
                  <button 
                    onClick={handleMarkAllRead}
                    className="text-[11px] text-emerald-500 hover:text-emerald-400 font-medium"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              
              <div className="max-h-60 overflow-y-auto space-y-1">
                {notifications.length === 0 ? (
                  <div className="text-center p-4 text-xs text-muted-foreground">No new updates</div>
                ) : (
                  notifications.map((item) => (
                    <div 
                      key={item.id} 
                      className={`p-2 rounded-lg transition-colors text-left flex flex-col gap-0.5 ${item.unread ? 'bg-muted/40' : 'hover:bg-muted/20'}`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <p className="text-xs text-foreground/90 leading-tight">{item.text}</p>
                        {item.unread && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-1 flex-shrink-0" />}
                      </div>
                      <span className="text-[10px] text-muted-foreground">{item.time}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* 🎨 THEME SWITCHER */}
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

      {/* ⚙️ SETTINGS */}
      <Link
        href="/settings"
        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        title="Settings"
        data-testid="link-settings"
      >
        <Settings className="w-4.5 h-4.5" />
      </Link>

      {/* 👤 PROFILE */}
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