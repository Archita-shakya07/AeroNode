import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useUpdateProfile, useChangePassword } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, Layers, LogOut, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import TopbarActions from "@/components/topbar-actions";

const AVATAR_COLORS = ["#8b5cf6", "#6366f1", "#ec4899", "#22d3ee", "#f59e0b", "#10b981", "#ef4444", "#3b82f6"];

export default function Profile() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [name, setName] = useState(user?.name ?? "");
  const [avatarColor, setAvatarColor] = useState(user?.avatarColor ?? AVATAR_COLORS[0]);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile.mutate(
      { data: { name, avatarColor } },
      {
        onSuccess: () => {
          toast({ title: "Profile updated" });
          // Access token payload (name/avatarColor) is only refreshed on the
          // next silent refresh cycle; a full reload keeps the UI in sync now.
          setTimeout(() => window.location.reload(), 400);
        },
        onError: () => toast({ title: "Failed to update profile", variant: "destructive" }),
      },
    );
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast({ title: "New password must be at least 8 characters", variant: "destructive" });
      return;
    }
    changePassword.mutate(
      { data: { currentPassword, newPassword } },
      {
        onSuccess: () => {
          toast({ title: "Password changed" });
          setCurrentPassword("");
          setNewPassword("");
        },
        onError: () => toast({ title: "Current password is incorrect", variant: "destructive" }),
      },
    );
  };

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="h-16 border-b border-border flex items-center justify-between px-6 bg-background/70 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 text-sm">
            <ChevronLeft className="w-4 h-4" /> Dashboard
          </Link>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
              <Layers className="w-4 h-4 text-indigo-400" />
            </div>
            <span className="font-semibold tracking-tight text-sm">AeroNode</span>
          </div>
        </div>
        <TopbarActions />
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-6 py-12 space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Your Profile</h1>
          <p className="text-muted-foreground">Manage your identity and account security.</p>
        </div>

        <form onSubmit={handleSaveProfile} className="glass-surface p-6 rounded-xl border border-border bg-card space-y-5">
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white shrink-0"
              style={{ backgroundColor: avatarColor }}
            >
              {name.charAt(0).toUpperCase() || "?"}
            </div>
            <div className="flex-1">
              <Label className="text-muted-foreground mb-2 block">Avatar color</Label>
              <div className="flex gap-2 flex-wrap">
                {AVATAR_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setAvatarColor(c)}
                    className="w-7 h-7 rounded-full border-2 flex items-center justify-center transition-transform hover:scale-110"
                    style={{ backgroundColor: c, borderColor: avatarColor === c ? "hsl(var(--foreground))" : "transparent" }}
                    data-testid={`button-avatar-color-${c}`}
                  >
                    {avatarColor === c && <Check className="w-3.5 h-3.5 text-white" />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} data-testid="input-profile-name" />
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user?.email ?? ""} disabled className="opacity-60" />
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={updateProfile.isPending || !name.trim()} data-testid="button-save-profile">
              {updateProfile.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>

        <form onSubmit={handleChangePassword} className="glass-surface p-6 rounded-xl border border-border bg-card space-y-5">
          <h3 className="font-semibold">Change Password</h3>
          <div className="space-y-2">
            <Label htmlFor="current-password">Current password</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              data-testid="input-current-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              data-testid="input-new-password"
            />
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              variant="secondary"
              disabled={changePassword.isPending || !currentPassword || newPassword.length < 8}
              data-testid="button-change-password"
            >
              {changePassword.isPending ? "Updating..." : "Update Password"}
            </Button>
          </div>
        </form>

        <div className="flex justify-between items-center pt-2">
          <p className="text-xs text-muted-foreground">Member since {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : ""}</p>
          <Button variant="ghost" onClick={handleLogout} className="text-muted-foreground hover:text-foreground" data-testid="button-logout-profile">
            <LogOut className="w-4 h-4 mr-2" /> Log Out
          </Button>
        </div>
      </main>
    </div>
  );
}
