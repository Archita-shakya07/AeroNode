import {
  useListTasks,
  useListFiles,
  useListMeetings,
} from "@workspace/api-client-react";
import {
  CheckCircle2,
  Clock,
  FolderOpen,
  CalendarClock,
  ListChecks,
  TrendingUp,
  AlertCircle,
  PlayCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

export default function WorkspaceAnalytics({
  workspaceId,
}: {
  workspaceId: number;
}) {
  const { data: tasks, isLoading: tasksLoading } = useListTasks(workspaceId);
  const { data: files, isLoading: filesLoading } = useListFiles(workspaceId);
  const { data: meetings, isLoading: meetingsLoading } =
    useListMeetings(workspaceId);

  const isLoading = tasksLoading || filesLoading || meetingsLoading;

  const totalTasks = tasks?.length || 0;
  const doneTasks =
    tasks?.filter((t) => t.status === "done").length || 0;
  const inProgressTasks =
    tasks?.filter((t) => t.status === "in_progress").length || 0;
  const todoTasks =
    tasks?.filter((t) => t.status === "todo").length || 0;
  const completionPercentage = totalTasks
    ? Math.round((doneTasks / totalTasks) * 100)
    : 0;

  const upcomingMeetings =
    meetings?.filter((m) => new Date(m.scheduledAt) > new Date()).length || 0;

  const highPriorityTasks =
    tasks?.filter((t) => t.priority === "high" || t.priority === "urgent")
      .length || 0;

  const statCards = [
    {
      label: "Total Tasks",
      value: totalTasks,
      icon: ListChecks,
      color: "text-indigo-400",
    },
    {
      label: "Completed",
      value: doneTasks,
      icon: CheckCircle2,
      color: "text-emerald-400",
    },
    {
      label: "In Progress",
      value: inProgressTasks,
      icon: PlayCircle,
      color: "text-amber-400",
    },
    {
      label: "Files Uploaded",
      value: files?.length || 0,
      icon: FolderOpen,
      color: "text-blue-400",
    },
    {
      label: "Upcoming Meetings",
      value: upcomingMeetings,
      icon: CalendarClock,
      color: "text-purple-400",
    },
    {
      label: "High Priority",
      value: highPriorityTasks,
      icon: AlertCircle,
      color: "text-red-400",
    },
  ];

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-6 overflow-y-auto w-full">
      <div className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight">Workspace Analytics</h2>
        <p className="text-muted-foreground mt-1">
          Real-time overview of tasks, files, meetings, and progress.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-3xl font-bold">{stat.value}</span>
                  <Icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-400" />
              Project Completion
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Overall Progress</span>
              <span className="font-semibold">{completionPercentage}%</span>
            </div>
            <Progress value={completionPercentage} className="h-3" />
            <div className="grid grid-cols-3 gap-4 text-center text-sm">
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="text-lg font-semibold">{todoTasks}</div>
                <div className="text-muted-foreground">To Do</div>
              </div>
              <div className="p-3 rounded-lg bg-indigo-500/10">
                <div className="text-lg font-semibold text-indigo-400">{inProgressTasks}</div>
                <div className="text-muted-foreground">In Progress</div>
              </div>
              <div className="p-3 rounded-lg bg-emerald-500/10">
                <div className="text-lg font-semibold text-emerald-400">{doneTasks}</div>
                <div className="text-muted-foreground">Done</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-purple-400" />
              Meetings & Files
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total Meetings</span>
              <span className="text-2xl font-semibold">{meetings?.length || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Files Uploaded</span>
              <span className="text-2xl font-semibold">{files?.length || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Storage Items</span>
              <span className="text-2xl font-semibold">
                {(files?.length || 0) + (meetings?.length || 0)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
