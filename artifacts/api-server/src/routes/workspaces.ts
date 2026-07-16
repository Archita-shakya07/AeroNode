import { Router, type IRouter } from "express";
import { and, count, eq } from "drizzle-orm";
import {
  db,
  workspacesTable,
  workspaceMembersTable,
  usersTable,
  tasksTable,
  activityLogTable,
} from "@workspace/db";
import {
  CreateWorkspaceBody,
  CreateWorkspaceResponse,
  GetWorkspaceParams,
  GetWorkspaceResponse,
  ListWorkspacesResponse,
  UpdateWorkspaceParams,
  UpdateWorkspaceBody,
  UpdateWorkspaceResponse,
  DeleteWorkspaceParams,
  AddWorkspaceMemberParams,
  AddWorkspaceMemberBody,
  AddWorkspaceMemberResponse,
  UpdateMemberRoleParams,
  UpdateMemberRoleBody,
  UpdateMemberRoleResponse,
  RemoveMemberParams,
  ListActivityParams,
  ListActivityResponse,
  ExportWorkspaceParams,
  ExportWorkspaceResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/require-auth";
import { getMembership } from "../lib/workspace-access";
import { logActivity } from "../lib/activity";
import { emitToWorkspace } from "../lib/socket";

const router: IRouter = Router();
router.use(requireAuth);

async function loadWorkspaceDetail(workspaceId: number, userId: number) {
  const membership = await getMembership(workspaceId, userId);
  if (!membership) return null;

  const [workspace] = await db
    .select()
    .from(workspacesTable)
    .where(eq(workspacesTable.id, workspaceId));
  if (!workspace) return null;

  const members = await db
    .select({
      id: workspaceMembersTable.id,
      userId: workspaceMembersTable.userId,
      role: workspaceMembersTable.role,
      joinedAt: workspaceMembersTable.joinedAt,
      name: usersTable.name,
      email: usersTable.email,
      avatarColor: usersTable.avatarColor,
    })
    .from(workspaceMembersTable)
    .innerJoin(usersTable, eq(usersTable.id, workspaceMembersTable.userId))
    .where(eq(workspaceMembersTable.workspaceId, workspaceId));

  return {
    id: workspace.id,
    name: workspace.name,
    description: workspace.description,
    myRole: membership.role,
    members,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
  };
}

router.get("/workspaces", async (req, res): Promise<void> => {
  const memberships = await db
    .select({
      workspaceId: workspaceMembersTable.workspaceId,
      role: workspaceMembersTable.role,
    })
    .from(workspaceMembersTable)
    .where(eq(workspaceMembersTable.userId, req.userId!));

  const summaries = await Promise.all(
    memberships.map(async (m) => {
      const [workspace] = await db
        .select()
        .from(workspacesTable)
        .where(eq(workspacesTable.id, m.workspaceId));
      const [memberCountRow] = await db
        .select({ value: count() })
        .from(workspaceMembersTable)
        .where(eq(workspaceMembersTable.workspaceId, m.workspaceId));
      const [taskCountRow] = await db
        .select({ value: count() })
        .from(tasksTable)
        .where(eq(tasksTable.workspaceId, m.workspaceId));

      return {
        id: workspace!.id,
        name: workspace!.name,
        description: workspace!.description,
        role: m.role,
        memberCount: memberCountRow?.value ?? 0,
        taskCount: taskCountRow?.value ?? 0,
        createdAt: workspace!.createdAt,
        updatedAt: workspace!.updatedAt,
      };
    }),
  );

  summaries.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  res.json(ListWorkspacesResponse.parse(summaries));
});

router.post("/workspaces", async (req, res): Promise<void> => {
  const parsed = CreateWorkspaceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [workspace] = await db
    .insert(workspacesTable)
    .values({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      createdBy: req.userId!,
    })
    .returning();

  await db.insert(workspaceMembersTable).values({
    workspaceId: workspace!.id,
    userId: req.userId!,
    role: "owner",
  });

  res.status(201).json(
    CreateWorkspaceResponse.parse({
      id: workspace!.id,
      name: workspace!.name,
      description: workspace!.description,
      role: "owner",
      memberCount: 1,
      taskCount: 0,
      createdAt: workspace!.createdAt,
      updatedAt: workspace!.updatedAt,
    }),
  );
});

router.get("/workspaces/:id", async (req, res): Promise<void> => {
  const params = GetWorkspaceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const detail = await loadWorkspaceDetail(params.data.id, req.userId!);
  if (!detail) {
    res.status(403).json({ error: "Not a member of this workspace" });
    return;
  }
  res.json(GetWorkspaceResponse.parse(detail));
});

router.patch("/workspaces/:id", async (req, res): Promise<void> => {
  const params = UpdateWorkspaceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateWorkspaceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const membership = await getMembership(params.data.id, req.userId!);
  if (!membership || membership.role !== "owner") {
    res.status(403).json({ error: "Only the owner can update this workspace" });
    return;
  }

  const updates: Partial<{ name: string; description: string | null }> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.description !== undefined)
    updates.description = parsed.data.description ?? null;

  await db.update(workspacesTable).set(updates).where(eq(workspacesTable.id, params.data.id));

  const detail = await loadWorkspaceDetail(params.data.id, req.userId!);
  emitToWorkspace(params.data.id, "member:changed", {});
  res.json(UpdateWorkspaceResponse.parse(detail));
});

router.delete("/workspaces/:id", async (req, res): Promise<void> => {
  const params = DeleteWorkspaceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const membership = await getMembership(params.data.id, req.userId!);
  if (!membership || membership.role !== "owner") {
    res.status(403).json({ error: "Only the owner can delete this workspace" });
    return;
  }

  await db.delete(workspacesTable).where(eq(workspacesTable.id, params.data.id));
  res.sendStatus(204);
});

router.post("/workspaces/:id/members", async (req, res): Promise<void> => {
  const params = AddWorkspaceMemberParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = AddWorkspaceMemberBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const membership = await getMembership(params.data.id, req.userId!);
  if (!membership || membership.role !== "owner") {
    res.status(403).json({ error: "Only the owner can add members" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, parsed.data.email));
  if (!user) {
    res.status(404).json({ error: "No registered user with that email" });
    return;
  }

  const existing = await getMembership(params.data.id, user.id);
  if (existing) {
    res.status(409).json({ error: "User is already a member" });
    return;
  }

  const [member] = await db
    .insert(workspaceMembersTable)
    .values({ workspaceId: params.data.id, userId: user.id, role: parsed.data.role })
    .returning();

  await logActivity(
    params.data.id,
    req.userId!,
    "",
    `${user.name} joined the workspace as ${parsed.data.role}`,
  );
  emitToWorkspace(params.data.id, "member:changed", {});

  res.status(201).json(
    AddWorkspaceMemberResponse.parse({
      id: member!.id,
      userId: user.id,
      name: user.name,
      email: user.email,
      avatarColor: user.avatarColor,
      role: member!.role,
      joinedAt: member!.joinedAt,
    }),
  );
});

router.patch("/workspaces/:id/members/:userId", async (req, res): Promise<void> => {
  const params = UpdateMemberRoleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateMemberRoleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const membership = await getMembership(params.data.id, req.userId!);
  if (!membership || membership.role !== "owner") {
    res.status(403).json({ error: "Only the owner can change roles" });
    return;
  }

  const [updated] = await db
    .update(workspaceMembersTable)
    .set({ role: parsed.data.role })
    .where(
      and(
        eq(workspaceMembersTable.workspaceId, params.data.id),
        eq(workspaceMembersTable.userId, params.data.userId),
      ),
    )
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Member not found" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, params.data.userId));
  emitToWorkspace(params.data.id, "member:changed", {});

  res.json(
    UpdateMemberRoleResponse.parse({
      id: updated.id,
      userId: updated.userId,
      name: user!.name,
      email: user!.email,
      avatarColor: user!.avatarColor,
      role: updated.role,
      joinedAt: updated.joinedAt,
    }),
  );
});

router.delete("/workspaces/:id/members/:userId", async (req, res): Promise<void> => {
  const params = RemoveMemberParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const membership = await getMembership(params.data.id, req.userId!);
  if (!membership || membership.role !== "owner") {
    res.status(403).json({ error: "Only the owner can remove members" });
    return;
  }

  await db
    .delete(workspaceMembersTable)
    .where(
      and(
        eq(workspaceMembersTable.workspaceId, params.data.id),
        eq(workspaceMembersTable.userId, params.data.userId),
      ),
    );

  emitToWorkspace(params.data.id, "member:changed", {});
  res.sendStatus(204);
});

router.get("/workspaces/:id/activity", async (req, res): Promise<void> => {
  const params = ListActivityParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const membership = await getMembership(params.data.id, req.userId!);
  if (!membership) {
    res.status(403).json({ error: "Not a member of this workspace" });
    return;
  }

  const rows = await db
    .select({
      id: activityLogTable.id,
      workspaceId: activityLogTable.workspaceId,
      userId: activityLogTable.userId,
      message: activityLogTable.message,
      createdAt: activityLogTable.createdAt,
      userName: usersTable.name,
    })
    .from(activityLogTable)
    .innerJoin(usersTable, eq(usersTable.id, activityLogTable.userId))
    .where(eq(activityLogTable.workspaceId, params.data.id))
    .orderBy(activityLogTable.createdAt)
    .limit(100);

  res.json(ListActivityResponse.parse(rows.reverse()));
});

router.get("/workspaces/:id/export", async (req, res): Promise<void> => {
  const params = ExportWorkspaceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const workspace = await loadWorkspaceDetail(params.data.id, req.userId!);
  if (!workspace) {
    res.status(403).json({ error: "Not a member of this workspace" });
    return;
  }

  const memberUsers = await db
    .select({ id: usersTable.id, name: usersTable.name })
    .from(usersTable)
    .innerJoin(workspaceMembersTable, eq(workspaceMembersTable.userId, usersTable.id))
    .where(eq(workspaceMembersTable.workspaceId, params.data.id));
  const nameById = new Map(memberUsers.map((u) => [u.id, u.name]));

  const rawTasks = await db
    .select({
      id: tasksTable.id,
      workspaceId: tasksTable.workspaceId,
      title: tasksTable.title,
      description: tasksTable.description,
      status: tasksTable.status,
      order: tasksTable.order,
      assigneeId: tasksTable.assigneeId,
      createdBy: tasksTable.createdBy,
      lockedBy: tasksTable.lockedBy,
      version: tasksTable.version,
      createdAt: tasksTable.createdAt,
      updatedAt: tasksTable.updatedAt,
    })
    .from(tasksTable)
    .where(eq(tasksTable.workspaceId, params.data.id));

  const taskRows = rawTasks.map((t) => ({
    ...t,
    assigneeName: t.assigneeId ? nameById.get(t.assigneeId) ?? null : null,
    lockedByName: t.lockedBy ? nameById.get(t.lockedBy) ?? null : null,
  }));

  const activityRows = await db
    .select({
      id: activityLogTable.id,
      workspaceId: activityLogTable.workspaceId,
      userId: activityLogTable.userId,
      message: activityLogTable.message,
      createdAt: activityLogTable.createdAt,
      userName: usersTable.name,
    })
    .from(activityLogTable)
    .innerJoin(usersTable, eq(usersTable.id, activityLogTable.userId))
    .where(eq(activityLogTable.workspaceId, params.data.id))
    .orderBy(activityLogTable.createdAt);

  res.json(
    ExportWorkspaceResponse.parse({
      workspace,
      tasks: taskRows,
      activity: activityRows,
      exportedAt: new Date(),
    }),
  );
});

export default router;
