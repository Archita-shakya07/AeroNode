import { ActivityEntry } from "@workspace/api-client-react";
import { formatDistanceToNow } from "date-fns";
import { Layers, User, CheckCircle, Edit, Trash, Plus } from "lucide-react";

export default function ActivityFeed({ activities, isLoading }: { activities: ActivityEntry[], isLoading: boolean }) {
  if (isLoading) {
    return <div className="text-muted-foreground animate-pulse">Loading activity...</div>;
  }

  if (activities.length === 0) {
    return <div className="text-muted-foreground text-center py-10">No activity yet. Start collaborating!</div>;
  }

  const getIcon = (message: string) => {
    const lower = message.toLowerCase();
    if (lower.includes("created") || lower.includes("added")) return <Plus className="w-4 h-4 text-emerald-400" />;
    if (lower.includes("deleted") || lower.includes("removed")) return <Trash className="w-4 h-4 text-red-400" />;
    if (lower.includes("moved to done") || lower.includes("completed")) return <CheckCircle className="w-4 h-4 text-emerald-400" />;
    if (lower.includes("updated") || lower.includes("changed")) return <Edit className="w-4 h-4 text-indigo-400" />;
    return <Layers className="w-4 h-4 text-purple-400" />;
  };

  return (
    <div className="space-y-6 relative before:absolute before:inset-0 before:ml-[15px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent">
      {activities.map((entry, idx) => (
        <div key={entry.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
          <div className="flex items-center justify-center w-8 h-8 rounded-full border border-[#0a0a0f] bg-[#0f0f15] shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 text-white/50 group-hover:text-indigo-400 group-hover:border-indigo-500/50 transition-colors">
            {getIcon(entry.message)}
          </div>
          <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-white/5 bg-white/5 backdrop-blur-sm hover:bg-white/10 transition-colors">
            <div className="flex items-center justify-between space-x-2 mb-1">
              <div className="font-bold text-white text-sm flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-[10px]">
                  {entry.userName.charAt(0).toUpperCase()}
                </div>
                {entry.userName}
              </div>
              <time className="text-xs text-muted-foreground font-mono">
                {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
              </time>
            </div>
            <div className="text-sm text-muted-foreground/80 leading-relaxed">
              {entry.message}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
