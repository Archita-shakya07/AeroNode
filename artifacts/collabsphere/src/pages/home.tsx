import { Link } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Layers, Activity, Users, ArrowRight } from "lucide-react";

export default function Home() {
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen w-full bg-background text-foreground overflow-hidden selection:bg-primary/30">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 h-20 z-50 flex items-center justify-between px-6 md:px-12 backdrop-blur-md bg-background/50 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight text-white">AeroNode</span>
        </div>
        <div className="flex items-center gap-4">
          {!loading && user ? (
            <Link href="/dashboard" className="px-5 py-2.5 rounded-full bg-white text-black font-medium hover:bg-white/90 transition-colors">
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="text-muted-foreground hover:text-white transition-colors font-medium text-sm hidden md:block">
                Log in
              </Link>
              <Link href="/signup" className="px-5 py-2.5 rounded-full bg-white text-black font-medium hover:bg-white/90 transition-colors text-sm">
                Get Started
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative pt-32 pb-20 md:pt-48 md:pb-32 px-6 md:px-12 max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-16">
        
        {/* Left: Copy & CTAs */}
        <div className="flex-1 flex flex-col items-start z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-indigo-300 mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            Now with AI-powered workspace insights
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter leading-[1.1] text-white mb-6">
            One Workspace. <br />
            Every Team. <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-600">AeroNode.</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-xl mb-10 leading-relaxed">
            Plan tasks, schedule meetings, share files, and track project progress — all in a real-time collaborative workspace built for professionals who ship fast.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            <Link href="/signup" className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-white text-black font-medium text-lg hover:bg-white/90 transition-all hover:scale-105 active:scale-95 shadow-[0_0_40px_rgba(99,102,241,0.3)]">
              Start for Free <ArrowRight className="w-5 h-5" />
            </Link>
            <Link href="/login" className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-white/5 text-white font-medium text-lg border border-white/10 hover:bg-white/10 transition-colors">
              Sign In
            </Link>
          </div>
        </div>

        {/* Right: Abstract Glassmorphic Visuals */}
        <div className="flex-1 w-full relative h-[400px] md:h-[500px] perspective-[1000px]">
          {/* Decorative Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-indigo-600/30 rounded-full blur-[100px] pointer-events-none"></div>
          <div className="absolute top-1/3 right-1/4 w-[200px] h-[200px] bg-purple-600/20 rounded-full blur-[80px] pointer-events-none"></div>

          {/* Floating Card 1 */}
          <div className="absolute top-[10%] left-[10%] w-64 p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl shadow-2xl animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-150 transform hover:scale-105 transition-transform">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-medium text-xs border border-emerald-500/30">JD</div>
              <div className="flex flex-col">
                <div className="h-2 w-20 bg-white/20 rounded-full mb-1"></div>
                <div className="h-1.5 w-12 bg-white/10 rounded-full"></div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-8 w-full bg-white/10 rounded-md"></div>
              <div className="h-8 w-4/5 bg-white/5 rounded-md"></div>
            </div>
          </div>

          {/* Floating Card 2 */}
          <div className="absolute bottom-[10%] right-[10%] w-72 p-5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 backdrop-blur-xl shadow-2xl animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300 transform hover:scale-105 transition-transform z-20">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-400" />
                <span className="text-sm font-medium text-indigo-200">Live Activity</span>
              </div>
              <div className="flex -space-x-2">
                <div className="w-6 h-6 rounded-full bg-red-500 border-2 border-[#0a0a0f] z-10"></div>
                <div className="w-6 h-6 rounded-full bg-blue-500 border-2 border-[#0a0a0f] z-20"></div>
                <div className="w-6 h-6 rounded-full bg-green-500 border-2 border-[#0a0a0f] z-30"></div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                <div className="h-2 w-full bg-white/20 rounded-full"></div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                <div className="h-2 w-3/4 bg-white/10 rounded-full"></div>
              </div>
            </div>
          </div>

          {/* Floating Card 3 */}
          <div className="absolute top-[40%] left-[40%] w-56 p-4 rounded-2xl bg-black/40 border border-white/5 backdrop-blur-2xl shadow-2xl animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-500 transform hover:scale-105 transition-transform z-10">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-white/50" />
              <span className="text-xs font-medium text-white/50">Team Presence</span>
            </div>
            <div className="p-3 rounded-xl bg-white/5 border border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-sm text-white">Everyone is typing...</span>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
