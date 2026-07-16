import { WorkspaceDetail, useAddWorkspaceMember, useUpdateMemberRole, useRemoveMember, getGetWorkspaceQueryKey } from "@workspace/api-client-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Shield, ShieldAlert, User, Trash2 } from "lucide-react";

export default function MembersList({ workspace }: { workspace: WorkspaceDetail }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isOwner = workspace.myRole === "owner";

  const addMember = useAddWorkspaceMember();
  const updateRole = useUpdateMemberRole();
  const removeMember = useRemoveMember();

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetWorkspaceQueryKey(workspace.id) });
  };

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    addMember.mutate({
      id: workspace.id,
      data: { email: inviteEmail, role: inviteRole }
    }, {
      onSuccess: () => {
        toast({ title: "Member added", description: `${inviteEmail} joined the workspace.` });
        setInviteEmail("");
        invalidate();
      },
      onError: (err: any) => {
        toast({ title: "Failed to add member", description: err?.message || "User may not exist or is already in workspace.", variant: "destructive" });
      }
    });
  };

  const handleRoleChange = (userId: number, newRole: "owner" | "editor" | "viewer") => {
    updateRole.mutate({
      id: workspace.id,
      userId,
      data: { role: newRole }
    }, {
      onSuccess: () => invalidate(),
      onError: () => toast({ title: "Failed to update role", variant: "destructive" })
    });
  };

  const handleRemove = (userId: number) => {
    if (confirm("Remove this member from the workspace?")) {
      removeMember.mutate({ id: workspace.id, userId }, {
        onSuccess: () => invalidate(),
        onError: () => toast({ title: "Failed to remove member", variant: "destructive" })
      });
    }
  };

  return (
    <div className="space-y-8">
      {isOwner && (
        <div className="p-6 rounded-xl border border-white/10 bg-white/5">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-indigo-400" /> Invite Member
          </h3>
          <form onSubmit={handleInvite} className="flex flex-col sm:flex-row items-end gap-4">
            <div className="space-y-2 flex-1 w-full">
              <Label className="text-white/70">Email Address</Label>
              <Input 
                type="email" 
                value={inviteEmail} 
                onChange={e => setInviteEmail(e.target.value)} 
                placeholder="colleague@university.edu"
                className="bg-white/5 border-white/10 focus-visible:ring-indigo-500"
              />
            </div>
            <div className="space-y-2 w-full sm:w-48">
              <Label className="text-white/70">Role</Label>
              <Select value={inviteRole} onValueChange={(v: any) => setInviteRole(v)}>
                <SelectTrigger className="bg-white/5 border-white/10 focus:ring-indigo-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0f0f15] border-white/10 text-white">
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={!inviteEmail || addMember.isPending} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500">
              {addMember.isPending ? "Adding..." : "Add Member"}
            </Button>
          </form>
        </div>
      )}

      <div className="rounded-xl border border-white/10 overflow-hidden bg-white/5">
        <div className="divide-y divide-white/5">
          {workspace.members.map(member => (
            <div key={member.id} className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-4">
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-inner"
                  style={{ backgroundColor: member.avatarColor }}
                >
                  {member.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-medium text-white flex items-center gap-2">
                    {member.name}
                    {member.role === "owner" && <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />}
                    {member.role === "editor" && <Shield className="w-3.5 h-3.5 text-indigo-400" />}
                    {member.role === "viewer" && <User className="w-3.5 h-3.5 text-slate-400" />}
                  </div>
                  <div className="text-xs text-muted-foreground">{member.email}</div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {isOwner && member.role !== "owner" ? (
                  <div className="flex items-center gap-2">
                    <Select value={member.role} onValueChange={(v: any) => handleRoleChange(member.userId, v)}>
                      <SelectTrigger className="w-28 h-8 text-xs bg-transparent border-white/10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0f0f15] border-white/10 text-white">
                        <SelectItem value="editor">Editor</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-400/10" onClick={() => handleRemove(member.userId)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <span className="text-xs font-medium uppercase tracking-wider text-white/50 px-2 py-1 rounded bg-white/5">
                    {member.role}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
