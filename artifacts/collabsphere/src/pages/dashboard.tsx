import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useListWorkspaces, useCreateWorkspace, getListWorkspacesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Layers, Plus, LogOut, ArrowRight, LayoutDashboard } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import TopbarActions from "@/components/topbar-actions";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: workspaces, isLoading } = useListWorkspaces();
  const createWorkspace = useCreateWorkspace();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [newWorkspaceDesc, setNewWorkspaceDesc] = useState("");

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;

    createWorkspace.mutate(
      { data: { name: newWorkspaceName, description: newWorkspaceDesc } },
      {
        onSuccess: (newWorkspace) => {
          queryClient.invalidateQueries({ queryKey: getListWorkspacesQueryKey() });
          toast({ title: "Workspace created", description: `Opened ${newWorkspace.name}` });
          setIsCreateOpen(false);
          setNewWorkspaceName("");
          setNewWorkspaceDesc("");
          setLocation(`/workspace/${newWorkspace.id}`);
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to create workspace", variant: "destructive" });
        }
      }
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Nav */}
      <header className="h-16 border-b border-border flex items-center justify-between px-6 bg-background/50 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
            <Layers className="w-5 h-5 text-indigo-400" />
          </div>
          <span className="font-semibold tracking-tight">AeroNode</span>
        </div>
        <div className="flex items-center gap-2">
          <TopbarActions />
          <div className="h-4 w-px bg-border mx-1" />
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-foreground" data-testid="button-logout">
            <LogOut className="w-4 h-4 mr-2" /> Logout
          </Button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-12">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">Your Workspaces</h1>
            <p className="text-muted-foreground">Select a workspace or create a new one to start collaborating.</p>
          </div>
          
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.2)]">
                <Plus className="w-4 h-4 mr-2" /> New Workspace
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Workspace</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Give your team a dedicated space for this project.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateWorkspace} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Workspace Name</Label>
                  <Input 
                    id="name" 
                    value={newWorkspaceName} 
                    onChange={(e) => setNewWorkspaceName(e.target.value)} 
                    placeholder="e.g. CS410 Final Project"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="desc">Description (Optional)</Label>
                  <Input 
                    id="desc" 
                    value={newWorkspaceDesc} 
                    onChange={(e) => setNewWorkspaceDesc(e.target.value)} 
                    placeholder="What is this workspace for?"
                  />
                </div>
                <DialogFooter className="pt-4">
                  <Button variant="ghost" type="button" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={!newWorkspaceName.trim() || createWorkspace.isPending} className="bg-indigo-600 hover:bg-indigo-500">
                    {createWorkspace.isPending ? "Creating..." : "Create Workspace"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-48 rounded-xl bg-muted border border-border" />
            ))}
          </div>
        ) : workspaces?.length === 0 ? (
          <div className="glass-surface flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-border bg-card/50">
            <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center mb-4">
              <LayoutDashboard className="w-8 h-8 text-indigo-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No workspaces yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md">You haven't joined any workspaces. Create one to start collaborating with your team.</p>
            <Button onClick={() => setIsCreateOpen(true)}>
              Create First Workspace
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workspaces?.map((ws) => (
              <Link key={ws.id} href={`/workspace/${ws.id}`}>
                <div className="glass-surface group relative p-6 rounded-xl bg-card border border-border hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all cursor-pointer h-full flex flex-col hover:shadow-[0_0_30px_rgba(99,102,241,0.1)]">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-lg font-semibold tracking-tight text-foreground group-hover:text-indigo-400 transition-colors line-clamp-1">{ws.name}</h3>
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium bg-muted text-muted-foreground capitalize">
                      {ws.role}
                    </div>
                  </div>
                  
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-6 flex-1">
                    {ws.description || "No description provided."}
                  </p>
                  
                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-border">
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" /> {ws.taskCount} tasks</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Updated {formatDistanceToNow(new Date(ws.updatedAt), { addSuffix: true })}
                    </div>
                  </div>
                  
                  {/* Hover effect arrow */}
                  <div className="absolute top-6 right-6 opacity-0 translate-x-[-10px] group-hover:opacity-100 group-hover:translate-x-0 transition-all text-indigo-400">
                    <ArrowRight className="w-5 h-5" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
