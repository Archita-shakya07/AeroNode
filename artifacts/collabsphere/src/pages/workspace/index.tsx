import { useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useWorkspaceSocket } from "@/lib/socket";
import {
  useGetWorkspace,
  useListTasks,
  useListActivity,
  useExportWorkspace,
  getGetWorkspaceQueryKey,
  getListTasksQueryKey,
  getListActivityQueryKey,
  getExportWorkspaceQueryKey,
} from "@workspace/api-client-react";
import { Link, useParams } from "wouter";
import {
  Layers,
  Users,
  Activity,
  Download,
  ChevronLeft,
  Loader2,
  ListChecks,
  FolderOpen,
  CalendarClock,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";

import KanbanBoard from "@/components/workspace/kanban-board";
import ActivityFeed from "@/components/workspace/activity-feed";
import MembersList from "@/components/workspace/members-list";
import PresenceOverlay from "@/components/workspace/presence-overlay";
import TaskPlanner from "@/components/workspace/task-planner";
import FilesHub from "@/components/workspace/files-hub";
import MeetingsPanel from "@/components/workspace/meetings-panel";
import WorkspaceAnalytics from "@/components/workspace/workspace-analytics";
import TopbarActions from "@/components/topbar-actions";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle } from "lucide-react";
import GroupChat from "@/components/workspace/group-chat";
type Tab =
  | "analytics"
  | "planner"
  | "files"
  | "meetings"
  | "activity"
  | "members"
  | "chat";

const TABS: { id: Tab; label: string; icon: typeof Layers }[] = [
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "planner", label: "Task Planner", icon: ListChecks },
  { id: "files", label: "Files Hub", icon: FolderOpen },
  { id: "meetings", label: "Meetings", icon: CalendarClock },
  { id: "activity", label: "Activity", icon: Activity },
  { id: "members", label: "Members", icon: Users },
  { id: "chat", label: "Group Chat", icon: MessageCircle },
];

export default function Workspace() {
  const { id } = useParams<{ id: string }>();
  const workspaceId = parseInt(id || "0", 10);
  const { accessToken, user } = useAuth();
  const { toast } = useToast();

  const boardRef = useRef<HTMLDivElement>(null);

  // Queries
  const { data: workspace, isLoading: wsLoading, error: wsError } = useGetWorkspace(workspaceId, { query: { queryKey: getGetWorkspaceQueryKey(workspaceId), enabled: !!workspaceId }});
  const { data: tasks, isLoading: tasksLoading } = useListTasks(workspaceId, { query: { queryKey: getListTasksQueryKey(workspaceId), enabled: !!workspaceId }});
  const { data: activity, isLoading: actLoading } = useListActivity(workspaceId, { query: { queryKey: getListActivityQueryKey(workspaceId), enabled: !!workspaceId }});

  // Real-time socket
  const { connected, onlineUsers, cursors, locks, emitCursor, lockTask, unlockTask } = useWorkspaceSocket(workspaceId, accessToken);

  const [activeTab, setActiveTab] = useState<Tab>("analytics");

  const canEdit = workspace?.myRole === "owner" || workspace?.myRole === "editor";

  // Track cursor movement on board area
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const boundedX = Math.max(0, Math.min(100, x));
    const boundedY = Math.max(0, Math.min(100, y));
    emitCursor(boundedX, boundedY);
  };

  const { refetch: refetchExport, isFetching: isExporting } = useExportWorkspace(workspaceId, { query: { queryKey: getExportWorkspaceQueryKey(workspaceId), enabled: false }});

  const handleExport = async () => {
    try {
      const result = await refetchExport();
      if (result.data) {
        const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `aeronode-export-${workspaceId}-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast({ title: "Export complete", description: "Workspace data downloaded." });
      }
    } catch (e) {
      toast({ title: "Export failed", description: "Could not export workspace data.", variant: "destructive" });
    }
  };

  if (wsError) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <Layers className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-foreground mb-2">Workspace not found</h2>
        <p className="text-muted-foreground mb-6">It may have been deleted or you don't have access.</p>
        <Link href="/dashboard" className="px-4 py-2 bg-muted hover:bg-muted/70 rounded-md text-foreground transition-colors">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  if (wsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* Header */}
      <header className="h-14 border-b border-border bg-background/80 backdrop-blur-md flex items-center justify-between px-4 z-40 shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 text-sm">
            <ChevronLeft className="w-4 h-4" /> Dashboard
          </Link>
          <div className="h-4 w-[1px] bg-border" />
          <h1 className="font-semibold text-foreground tracking-tight flex items-center gap-2">
            {workspace?.name}
            <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-muted text-muted-foreground">
              {workspace?.myRole}
            </span>
          </h1>
          <div className="flex items-center gap-2 ml-4">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-red-500'}`} />
            <span className="text-xs text-muted-foreground">{connected ? 'Live' : 'Connecting...'}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Presence Avatars */}
          <div className="flex -space-x-2 mr-2">
            {onlineUsers.map(u => (
              <div
                key={u.userId}
                className="w-8 h-8 rounded-full border-2 border-background flex items-center justify-center text-xs font-bold text-white relative group"
                style={{ backgroundColor: u.avatarColor }}
              >
                {u.name.charAt(0).toUpperCase()}
                <div className="absolute -bottom-8 bg-popover border border-border text-foreground text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity z-50">
                  {u.name}
                </div>
              </div>
            ))}
          </div>

          {workspace?.myRole === 'owner' && (
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" onClick={handleExport}>
              {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              Export
            </Button>
          )}

          <div className="h-4 w-[1px] bg-border" />
          <TopbarActions />
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">

        {/* Sidebar Tabs Navigation */}
        <aside className="w-16 border-r border-border bg-sidebar flex flex-col items-center py-4 gap-3 shrink-0 z-30">
          {TABS.map(({ id: tabId, label, icon: Icon }) => (
            <button
              key={tabId}
              onClick={() => setActiveTab(tabId)}
              className={`p-3 rounded-xl transition-all ${activeTab === tabId ? "bg-indigo-600/20 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
              title={label}
              data-testid={`tab-${tabId}`}
            >
              <Icon className="w-5 h-5" />
            </button>
          ))}
        </aside>

        {/* Tab Content */}
        <main
          className="flex-1 relative overflow-hidden flex bg-background"
          ref={boardRef}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => {}}
        >
          {activeTab === "analytics" && workspace && (
            <WorkspaceAnalytics workspaceId={workspaceId} />
          )}

          {activeTab === "planner" && workspace && (
            <TaskPlanner workspaceId={workspaceId} tasks={tasks || []} isLoading={tasksLoading} canEdit={canEdit} />
          )}

          {activeTab === "files" && workspace && (
            <FilesHub workspaceId={workspaceId} canEdit={canEdit} />
          )}

          {activeTab === "meetings" && workspace && (
            <MeetingsPanel workspaceId={workspaceId} canEdit={canEdit} />
          )}

          {activeTab === "activity" && workspace && (
            <div className="p-6 w-full max-w-2xl mx-auto overflow-y-auto">
              <h2 className="text-2xl font-bold mb-6">Activity Feed</h2>
              <ActivityFeed activities={activity || []} isLoading={actLoading} />
            </div>
          )}

          {activeTab === "members" && workspace && (
            <div className="p-6 w-full max-w-4xl mx-auto overflow-y-auto">
              <h2 className="text-2xl font-bold mb-6">Workspace Members</h2>
              <MembersList workspace={workspace} />
            </div>
          )}

          {activeTab === "chat" && workspace && (
            <GroupChat workspaceId={workspaceId} />
          )}

          {/* Render cursors of other users on top of everything inside the main area */}
          <PresenceOverlay cursors={cursors} currentUserId={user?.id || 0} />
        </main>
      </div>
    </div>
  );
}
