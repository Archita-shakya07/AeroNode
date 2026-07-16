import { Link } from "wouter";
import { ChevronLeft, Layers, Check } from "lucide-react";
import { useTheme, THEME_META, type Theme } from "@/lib/theme-context";
import TopbarActions from "@/components/topbar-actions";

const THEME_ORDER: Theme[] = ["dark", "light", "sand", "glass"];

const SWATCHES: Record<Theme, string[]> = {
  dark: ["#0a0a0f", "#8b5cf6", "#f5f5f7"],
  light: ["#f3f5fb", "#7c3aed", "#111318"],
  sand: ["#ece0cb", "#c2542a", "#3d2b19"],
  glass: ["#1c1440", "#b76bff", "#3ddcf7"],
};

export default function Settings() {
  const { theme, setTheme } = useTheme();

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
          <h1 className="text-3xl font-bold tracking-tight mb-1">Settings</h1>
          <p className="text-muted-foreground">Personalize how AeroNode looks for you. Saved to this browser.</p>
        </div>

        <section className="space-y-4">
          <h2 className="font-semibold">Appearance</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {THEME_ORDER.map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`text-left p-4 rounded-xl border transition-all glass-surface ${
                  theme === t ? "border-primary ring-2 ring-primary/40 bg-card" : "border-border bg-card hover:border-primary/40"
                }`}
                data-testid={`card-theme-${t}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex gap-1.5">
                    {SWATCHES[t].map((c, i) => (
                      <span key={i} className="w-5 h-5 rounded-full border border-border/50" style={{ backgroundColor: c }} />
                    ))}
                  </div>
                  {theme === t && <Check className="w-4 h-4 text-primary" />}
                </div>
                <div className="font-medium text-sm">{THEME_META[t].label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{THEME_META[t].description}</div>
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
