import { useMemo, useState } from "react";
import {
  Task,
  TaskPriority,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  getListTasksQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format, isPast, isToday } from "date-fns";
import { Search, Plus, ArrowUpDown, Flag, Calendar, Trash2, CheckCircle2, Circle, CircleDot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const PRIORITIES: TaskPriority[] = ["urgent", "high", "medium", "low"];

const PRIORITY_STYLE: Record<TaskPriority, string> = {
  urgent: "text-red-400 bg-red-400/10 border-red-400/20",
  high: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  medium: "text-indigo-400 bg-indigo-400/10 border-indigo-400/20",
  low: "text-slate-400 bg-slate-400/10 border-slate-400/20",
};

const STATUS_ICON = { todo: Circle, in_progress: CircleDot, done: CheckCircle2 } as const;

type SortKey = "dueDate" | "priority" | "status";

const PRIORITY_RANK: Record<TaskPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

type FormState = { title: string; description: string; priority: TaskPriority; dueDate: string };
const emptyForm: FormState = { title: "", description: "", priority: "medium", dueDate: "" };

export default function TaskPlanner({ workspaceId, tasks, isLoading, canEdit }: { workspaceId: number; tasks: Task[]; isLoading: boolean; canEdit: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("dueDate");
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListTasksQueryKey(workspaceId) });

  const filtered = useMemo(() => {
    let list = tasks.filter((t) => t.title.toLowerCase().includes(search.toLowerCase()));
    if (statusFilter !== "all") list = list.filter((t) => t.status === statusFilter);
    if (priorityFilter !== "all") list = list.filter((t) => t.priority === priorityFilter);

    return [...list].sort((a, b) => {
      if (sortKey === "priority") return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (sortKey === "status") return a.status.localeCompare(b.status);
      // dueDate: nulls last
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
  }, [tasks, search, statusFilter, priorityFilter, sortKey]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    createTask.mutate(
      {
        id: workspaceId,
        data: {
          title: form.title,
          description: form.description || undefined,
          priority: form.priority,
          dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
        },
      },
      {
        onSuccess: () => {
          setIsCreating(false);
          setForm(emptyForm);
          invalidate();
          toast({ title: "Task added" });
        },
        onError: () => toast({ title: "Failed to create task", variant: "destructive" }),
      },
    );
  };

  const cyclePriority = (task: Task) => {
    if (!canEdit) return;
    const next = PRIORITIES[(PRIORITIES.indexOf(task.priority) + 1) % PRIORITIES.length];
    updateTask.mutate(
      { id: task.id, data: { priority: next, version: task.version } },
      { onSuccess: invalidate, onError: () => toast({ title: "Update failed", variant: "destructive" }) },
    );
  };

  const cycleStatus = (task: Task) => {
    if (!canEdit) return;
    const order = ["todo", "in_progress", "done"] as const;
    const next = order[(order.indexOf(task.status) + 1) % order.length];
    updateTask.mutate(
      { id: task.id, data: { status: next, version: task.version } },
      { onSuccess: invalidate, onError: () => toast({ title: "Update failed", variant: "destructive" }) },
    );
  };

  const setDueDate = (task: Task, value: string) => {
    updateTask.mutate(
      { id: task.id, data: { dueDate: value ? new Date(value).toISOString() : null, version: task.version } },
      { onSuccess: invalidate, onError: () => toast({ title: "Update failed", variant: "destructive" }) },
    );
  };

  const handleDelete = (task: Task) => {
    if (!confirm(`Delete "${task.title}"?`)) return;
    deleteTask.mutate({ id: task.id }, { onSuccess: invalidate, onError: () => toast({ title: "Failed to delete", variant: "destructive" }) });
  };

  return (
    <div className="h-full w-full p-6 overflow-y-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Task Planner</h2>
          <p className="text-sm text-muted-foreground">Search, filter, and prioritize every task in one list.</p>
        </div>
        {canEdit && (
          <Button onClick={() => { setForm(emptyForm); setIsCreating(true); }} data-testid="button-add-task-planner">
            <Plus className="w-4 h-4 mr-2" /> Add Task
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks..." className="pl-9" data-testid="input-search-tasks" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36" data-testid="select-status-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="todo">To Do</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="done">Done</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-36" data-testid="select-priority-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {PRIORITIES.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
          <SelectTrigger className="w-40" data-testid="select-sort-key">
            <ArrowUpDown className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dueDate">Sort by due date</SelectItem>
            <SelectItem value="priority">Sort by priority</SelectItem>
            <SelectItem value="status">Sort by status</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Loading tasks...</div>
      ) : filtered.length === 0 ? (
        <div className="glass-surface text-center py-16 rounded-xl border border-dashed border-border bg-card/50 text-muted-foreground">
          No tasks match these filters.
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden bg-card">
          {filtered.map((task, idx) => {
            const StatusIcon = STATUS_ICON[task.status];
            const overdue = task.dueDate && isPast(new Date(task.dueDate)) && task.status !== "done";
            const dueToday = task.dueDate && isToday(new Date(task.dueDate));
            return (
              <div
                key={task.id}
                className={`glass-surface flex items-center gap-3 p-3.5 ${idx !== 0 ? "border-t border-border" : ""} hover:bg-muted/40 transition-colors`}
                data-testid={`row-task-${task.id}`}
              >
                <button onClick={() => cycleStatus(task)} disabled={!canEdit} className="shrink-0 disabled:opacity-50" title="Cycle status">
                  <StatusIcon className={`w-5 h-5 ${task.status === "done" ? "text-emerald-400" : "text-muted-foreground"}`} />
                </button>

                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium text-foreground truncate ${task.status === "done" ? "line-through opacity-60" : ""}`}>{task.title}</p>
                  {task.description && <p className="text-xs text-muted-foreground truncate">{task.description}</p>}
                </div>

                <button
                  onClick={() => cyclePriority(task)}
                  disabled={!canEdit}
                  className={`hidden sm:flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide border shrink-0 disabled:opacity-70 ${PRIORITY_STYLE[task.priority]}`}
                  title="Cycle priority"
                >
                  <Flag className="w-3 h-3" /> {task.priority}
                </button>

                <div className="hidden md:flex items-center gap-1.5 shrink-0">
                  <Calendar className={`w-3.5 h-3.5 ${overdue ? "text-red-400" : dueToday ? "text-amber-400" : "text-muted-foreground"}`} />
                  <input
                    type="date"
                    disabled={!canEdit}
                    value={task.dueDate ? format(new Date(task.dueDate), "yyyy-MM-dd") : ""}
                    onChange={(e) => setDueDate(task, e.target.value)}
                    className={`bg-transparent text-xs outline-none disabled:opacity-70 ${overdue ? "text-red-400" : "text-muted-foreground"}`}
                  />
                </div>

                {canEdit && (
                  <button onClick={() => handleDelete(task)} className="p-1.5 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors shrink-0" data-testid={`button-delete-planner-task-${task.id}`}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={isCreating} onOpenChange={(open) => !open && setIsCreating(false)}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader><DialogTitle>Add Task</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} autoFocus data-testid="input-planner-task-title" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v as TaskPriority }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Due date</Label>
                <Input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsCreating(false)}>Cancel</Button>
              <Button type="submit" disabled={createTask.isPending || !form.title.trim()} data-testid="button-submit-planner-task">
                {createTask.isPending ? "Adding..." : "Add Task"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
