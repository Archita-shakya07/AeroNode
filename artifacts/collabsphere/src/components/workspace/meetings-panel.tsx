import { useMemo, useState } from "react";
import {
  Meeting,
  useListMeetings,
  useCreateMeeting,
  useUpdateMeeting,
  useDeleteMeeting,
  getListMeetingsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format, isPast } from "date-fns";
import { CalendarClock, Plus, Link2, Trash2, Pencil, Video } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type FormState = {
  title: string;
  description: string;
  date: string;
  time: string;
  durationMinutes: string;
  meetingLink: string;
};

const emptyForm: FormState = { title: "", description: "", date: "", time: "", durationMinutes: "30", meetingLink: "" };

function toLocalDateTimeParts(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const date = format(d, "yyyy-MM-dd");
  const time = format(d, "HH:mm");
  return { date, time };
}

export default function MeetingsPanel({ workspaceId, canEdit }: { workspaceId: number; canEdit: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: meetings = [], isLoading } = useListMeetings(workspaceId);
  const createMeeting = useCreateMeeting();
  const updateMeeting = useUpdateMeeting();
  const deleteMeeting = useDeleteMeeting();

  const [editing, setEditing] = useState<Meeting | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListMeetingsQueryKey(workspaceId) });

  const sorted = useMemo(
    () => [...meetings].sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()),
    [meetings],
  );

  const openCreate = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 30 - (now.getMinutes() % 30));
    setForm({ ...emptyForm, ...toLocalDateTimeParts(now.toISOString()) });
    setIsCreating(true);
  };

  const openEdit = (meeting: Meeting) => {
    setForm({
      title: meeting.title,
      description: meeting.description ?? "",
      durationMinutes: String(meeting.durationMinutes),
      meetingLink: meeting.meetingLink ?? "",
      ...toLocalDateTimeParts(meeting.scheduledAt),
    });
    setEditing(meeting);
  };

  const closeDialogs = () => {
    setIsCreating(false);
    setEditing(null);
  };

  const buildPayload = () => ({
    title: form.title,
    description: form.description || null,
    scheduledAt: new Date(`${form.date}T${form.time}`).toISOString(),
    durationMinutes: Number(form.durationMinutes) || 30,
    meetingLink: form.meetingLink || null,
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.date || !form.time) return;
    createMeeting.mutate({ id: workspaceId, data: buildPayload() }, {
      onSuccess: () => {
        closeDialogs();
        invalidate();
        toast({ title: "Meeting scheduled" });
      },
      onError: () => toast({ title: "Failed to schedule meeting", variant: "destructive" }),
    });
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !form.title.trim() || !form.date || !form.time) return;
    updateMeeting.mutate({ id: editing.id, data: buildPayload() }, {
      onSuccess: () => {
        closeDialogs();
        invalidate();
      },
      onError: () => toast({ title: "Failed to update meeting", variant: "destructive" }),
    });
  };

  const handleDelete = (meeting: Meeting) => {
    if (!confirm(`Cancel "${meeting.title}"?`)) return;
    deleteMeeting.mutate({ id: meeting.id }, {
      onSuccess: invalidate,
      onError: () => toast({ title: "Failed to cancel meeting", variant: "destructive" }),
    });
  };

  const formFields = (onSubmit: (e: React.FormEvent) => void, submitLabel: string, pending: boolean) => (
    <form onSubmit={onSubmit} className="space-y-4 pt-2">
      <div className="space-y-2">
        <Label>Title</Label>
        <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} autoFocus data-testid="input-meeting-title" />
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="resize-none" placeholder="Agenda, notes..." />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Date</Label>
          <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} data-testid="input-meeting-date" />
        </div>
        <div className="space-y-2">
          <Label>Time</Label>
          <Input type="time" value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} data-testid="input-meeting-time" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Duration (min)</Label>
          <Input type="number" min={5} step={5} value={form.durationMinutes} onChange={(e) => setForm((f) => ({ ...f, durationMinutes: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>Meeting link</Label>
          <Input value={form.meetingLink} onChange={(e) => setForm((f) => ({ ...f, meetingLink: e.target.value }))} placeholder="https://meet.google.com/..." />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={closeDialogs}>Cancel</Button>
        <Button type="submit" disabled={pending || !form.title.trim() || !form.date || !form.time} data-testid="button-submit-meeting">
          {pending ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );

  return (
    <div className="h-full w-full p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Meetings</h2>
          <p className="text-sm text-muted-foreground">Schedule and track this workspace's calls.</p>
        </div>
        {canEdit && (
          <Button onClick={openCreate} data-testid="button-schedule-meeting">
            <Plus className="w-4 h-4 mr-2" /> Schedule Meeting
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Loading meetings...</div>
      ) : sorted.length === 0 ? (
        <div className="glass-surface flex flex-col items-center justify-center text-center py-16 rounded-xl border border-dashed border-border bg-card/50">
          <CalendarClock className="w-8 h-8 text-muted-foreground mb-3" />
          <p className="text-foreground font-medium">No meetings scheduled</p>
          <p className="text-sm text-muted-foreground mt-1">{canEdit ? "Schedule one to align the team." : "Meetings will appear here once scheduled."}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((meeting) => {
            const past = isPast(new Date(meeting.scheduledAt));
            return (
              <div
                key={meeting.id}
                className={`glass-surface p-4 rounded-xl border border-border bg-card flex items-start justify-between gap-4 ${past ? "opacity-60" : ""}`}
                data-testid={`card-meeting-${meeting.id}`}
              >
                <div className="flex items-start gap-3 flex-1">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex flex-col items-center justify-center shrink-0 text-emerald-400">
                    <Video className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-foreground">{meeting.title}</h4>
                    {meeting.description && <p className="text-sm text-muted-foreground mt-0.5">{meeting.description}</p>}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2 flex-wrap">
                      <span>{format(new Date(meeting.scheduledAt), "EEE, MMM d 'at' h:mm a")}</span>
                      <span>&middot; {meeting.durationMinutes} min</span>
                      <span>&middot; scheduled by {meeting.createdByName}</span>
                      {meeting.meetingLink && (
                        <a href={meeting.meetingLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300">
                          <Link2 className="w-3 h-3" /> Join
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                {canEdit && (
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEdit(meeting)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" data-testid={`button-edit-meeting-${meeting.id}`}>
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(meeting)} className="p-1.5 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors" data-testid={`button-delete-meeting-${meeting.id}`}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={isCreating} onOpenChange={(open) => !open && closeDialogs()}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader><DialogTitle>Schedule Meeting</DialogTitle></DialogHeader>
          {formFields(handleCreate, "Schedule", createMeeting.isPending)}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(open) => !open && closeDialogs()}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader><DialogTitle>Edit Meeting</DialogTitle></DialogHeader>
          {formFields(handleUpdate, "Save Changes", updateMeeting.isPending)}
        </DialogContent>
      </Dialog>
    </div>
  );
}
