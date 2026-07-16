import { useState, useCallback, useMemo } from "react";
import { Task, TaskStatus, useUpdateTask, useCreateTask, useDeleteTask, VersionConflict, getListTasksQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { TaskLock } from "@/lib/socket";
import { Plus, X, AlertTriangle, GripVertical, User2, MessageSquare, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

// Board Components
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type KanbanBoardProps = {
  workspaceId: number;
  tasks: Task[];
  isLoading: boolean;
  myRole: string;
  locks: Record<number, TaskLock>;
  lockTask: (taskId: number) => void;
  unlockTask: (taskId: number) => void;
  currentUserId?: number;
};

const STATUS_COLUMNS: { id: TaskStatus; label: string; color: string }[] = [
  { id: "todo", label: "To Do", color: "text-slate-400 bg-slate-400/10 border-slate-400/20" },
  { id: "in_progress", label: "In Progress", color: "text-indigo-400 bg-indigo-400/10 border-indigo-400/20" },
  { id: "done", label: "Done", color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" }
];

export default function KanbanBoard({ workspaceId, tasks, isLoading, myRole, locks, lockTask, unlockTask, currentUserId }: KanbanBoardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateTask = useUpdateTask();
  const createTask = useCreateTask();
  const deleteTask = useDeleteTask();

  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [creatingStatus, setCreatingStatus] = useState<TaskStatus | null>(null);
  
  // Local state for forms
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");

  const canEdit = myRole === "owner" || myRole === "editor";

  // Group tasks by status and sort by order
  const groupedTasks = useMemo(() => {
    const grouped = {
      todo: [] as Task[],
      in_progress: [] as Task[],
      done: [] as Task[]
    };
    tasks.forEach(t => {
      if (grouped[t.status]) grouped[t.status].push(t);
    });
    // Sort each group
    Object.values(grouped).forEach(arr => arr.sort((a, b) => a.order - b.order));
    return grouped;
  }, [tasks]);

  // Drag and Drop State
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    if (!canEdit) return;
    if (locks[task.id] && locks[task.id].userId !== currentUserId) {
      e.preventDefault();
      return;
    }
    setDraggedTask(task);
    e.dataTransfer.setData("text/plain", task.id.toString());
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, newStatus: TaskStatus) => {
    e.preventDefault();
    if (!draggedTask || !canEdit) return;
    if (draggedTask.status === newStatus) {
      setDraggedTask(null);
      return;
    }

    // Optimistically calculate new order (just append to end for simplicity in UI, server recalculates if needed)
    const targetColumn = groupedTasks[newStatus];
    const newOrder = targetColumn.length > 0 ? targetColumn[targetColumn.length - 1].order + 1000 : 1000;

    updateTask.mutate({ 
      id: draggedTask.id, 
      data: { status: newStatus, order: newOrder, version: draggedTask.version } 
    }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListTasksQueryKey(workspaceId) }),
      onError: (err: any) => handleConflict(err, draggedTask.id)
    });
    
    setDraggedTask(null);
  };

  const handleConflict = (err: any, taskId: number) => {
    // Detect 409 Conflict structure from our openapi shape
    const status = err?.response?.status;
    if (status === 409) {
      toast({
        title: "Version Conflict",
        description: "Someone else modified this task. We've refreshed it with their changes.",
        variant: "destructive"
      });
      // The socket event from the other user's change should have already invalidated the cache
      // We close the modal to prevent overwriting with old data
      if (editingTask?.id === taskId) {
        handleCloseEditor();
      }
    } else {
      toast({ title: "Update failed", description: "Could not update task.", variant: "destructive" });
    }
  };

  const handleOpenEditor = (task: Task) => {
    if (!canEdit) return;
    // Check lock
    const currentLock = locks[task.id];
    if (currentLock && currentLock.userId !== currentUserId) {
      toast({ title: "Task locked", description: `${currentLock.name} is currently editing this task.` });
      return;
    }
    
    setEditingTask(task);
    setFormTitle(task.title);
    setFormDesc(task.description || "");
    lockTask(task.id);
  };

  const handleCloseEditor = () => {
    if (editingTask) {
      unlockTask(editingTask.id);
    }
    setEditingTask(null);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask || !formTitle.trim()) return;

    updateTask.mutate({
      id: editingTask.id,
      data: {
        title: formTitle,
        description: formDesc,
        version: editingTask.version
      }
    }, {
      onSuccess: () => {
        handleCloseEditor();
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey(workspaceId) });
      },
      onError: (err: any) => handleConflict(err, editingTask.id)
    });
  };

  const handleCreateNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !creatingStatus) return;

    createTask.mutate({
      id: workspaceId,
      data: {
        title: formTitle,
        description: formDesc,
        status: creatingStatus
      }
    }, {
      onSuccess: () => {
        setCreatingStatus(null);
        setFormTitle("");
        setFormDesc("");
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey(workspaceId) });
      },
      onError: () => {
        toast({ title: "Failed to create", description: "An error occurred.", variant: "destructive" });
      }
    });
  };

  const handleDelete = () => {
    if (!editingTask) return;
    if (confirm("Are you sure you want to delete this task?")) {
      deleteTask.mutate({ id: editingTask.id }, {
        onSuccess: () => {
          handleCloseEditor();
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey(workspaceId) });
        }
      });
    }
  };

  return (
    <div className="h-full w-full p-6 overflow-x-auto overflow-y-hidden flex gap-6">
      {isLoading && tasks.length === 0 ? (
        <div className="text-foreground">Loading board...</div>
      ) : (
        STATUS_COLUMNS.map(col => (
          <div 
            key={col.id} 
            className="flex-shrink-0 w-80 h-full flex flex-col bg-muted/40 rounded-2xl border border-border glass-surface"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col.id)}
          >
            {/* Column Header */}
            <div className="p-4 flex items-center justify-between border-b border-border">
              <div className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${col.color} border`}>
                {col.label} <span className="opacity-60 ml-1">{groupedTasks[col.id].length}</span>
              </div>
              {canEdit && (
                <button 
                  onClick={() => { setCreatingStatus(col.id); setFormTitle(""); setFormDesc(""); }}
                  className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Column Body */}
            <div className="flex-1 p-3 overflow-y-auto space-y-3 custom-scrollbar">
              {groupedTasks[col.id].map(task => {
                const isLocked = locks[task.id];
                const isLockedByOther = isLocked && isLocked.userId !== currentUserId;

                return (
                  <div 
                    key={task.id}
                    draggable={canEdit && !isLockedByOther}
                    onDragStart={(e) => handleDragStart(e, task)}
                    onClick={() => handleOpenEditor(task)}
                    className={`
                      p-4 rounded-xl border transition-all cursor-pointer group
                      ${isLockedByOther ? 'bg-white/5 border-red-500/30 opacity-70 cursor-not-allowed' : 'bg-card border-border hover:border-indigo-500/50 hover:bg-indigo-500/10 hover:shadow-[0_4px_20px_rgba(99,102,241,0.15)] glass-surface'}
                    `}
                  >
                    {isLockedByOther && (
                      <div className="flex items-center gap-1.5 text-[10px] text-red-400 font-medium mb-2 uppercase tracking-wide">
                        <AlertTriangle className="w-3 h-3" /> Locked by {isLocked.name}
                      </div>
                    )}
                    
                    <div className="flex items-start gap-2">
                      {canEdit && !isLockedByOther && (
                        <div className="mt-1 opacity-0 group-hover:opacity-50 hover:opacity-100 cursor-grab active:cursor-grabbing">
                          <GripVertical className="w-4 h-4 text-foreground" />
                        </div>
                      )}
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-foreground leading-tight mb-2">{task.title}</h4>
                        {task.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                            {task.description}
                          </p>
                        )}
                        
                        <div className="flex items-center justify-between mt-3">
                          <div className="flex -space-x-1">
                            {task.assigneeId ? (
                              <div className="w-5 h-5 rounded-full bg-indigo-500 border border-background flex items-center justify-center text-[9px] font-bold text-foreground" title={task.assigneeName || "Assignee"}>
                                {task.assigneeName?.charAt(0).toUpperCase()}
                              </div>
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-white/10 border border-background flex items-center justify-center border-dashed">
                                <User2 className="w-3 h-3 text-foreground/30" />
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 text-muted-foreground/70 text-xs">
                            {task.description && <MessageSquare className="w-3 h-3" />}
                            <span title={`Updated ${formatDistanceToNow(new Date(task.updatedAt))}`}>
                              <Clock className="w-3 h-3" />
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
              
              {/* Quick create inline dropzone/button */}
              {canEdit && (
                <button 
                  onClick={() => { setCreatingStatus(col.id); setFormTitle(""); setFormDesc(""); }}
                  className="w-full p-3 rounded-xl border border-dashed border-border text-muted-foreground hover:text-foreground hover:bg-muted hover:border-border transition-all text-sm flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Add Task
                </button>
              )}
            </div>
          </div>
        ))
      )}

      {/* Editor Modal */}
      <Dialog open={!!editingTask} onOpenChange={(open) => !open && handleCloseEditor()}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveEdit} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground">Title</Label>
              <Input 
                value={formTitle} 
                onChange={e => setFormTitle(e.target.value)}
                className="focus-visible:ring-indigo-500 font-medium"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Description</Label>
              <Textarea 
                value={formDesc} 
                onChange={e => setFormDesc(e.target.value)}
                className="focus-visible:ring-indigo-500 min-h-[120px] resize-none"
                placeholder="Add more details..."
              />
            </div>
            <div className="flex items-center justify-between pt-4 mt-4 border-t border-border">
              <Button type="button" variant="destructive" size="sm" onClick={handleDelete} className="bg-red-500/20 text-red-400 hover:bg-red-500/30">
                Delete Task
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={handleCloseEditor}>Cancel</Button>
                <Button type="submit" disabled={updateTask.isPending || !formTitle.trim()} className="bg-indigo-600 hover:bg-indigo-500">
                  {updateTask.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Modal */}
      <Dialog open={!!creatingStatus} onOpenChange={(open) => !open && setCreatingStatus(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create Task in {STATUS_COLUMNS.find(c => c.id === creatingStatus)?.label}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateNew} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground">Title</Label>
              <Input 
                value={formTitle} 
                onChange={e => setFormTitle(e.target.value)}
                className="focus-visible:ring-indigo-500"
                placeholder="What needs to be done?"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Description</Label>
              <Textarea 
                value={formDesc} 
                onChange={e => setFormDesc(e.target.value)}
                className="focus-visible:ring-indigo-500 resize-none"
                placeholder="Optional details..."
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="ghost" onClick={() => setCreatingStatus(null)}>Cancel</Button>
              <Button type="submit" disabled={createTask.isPending || !formTitle.trim()} className="bg-indigo-600 hover:bg-indigo-500">
                {createTask.isPending ? "Creating..." : "Create Task"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
