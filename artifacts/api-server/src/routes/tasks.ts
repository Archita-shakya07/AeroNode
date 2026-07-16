import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, tasksTable, usersTable } from "@workspace/db";
import {
  ListTasksParams,
  ListTasksResponse,
  CreateTaskParams,
  CreateTaskBody,
  CreateTaskResponse,
  UpdateTaskParams,
  UpdateTaskBody,
  UpdateTaskResponse,
  DeleteTaskParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/require-auth";
import { getMembership, canEdit } from "../lib/workspace-access";
import { logActivity } from "../lib/activity";
import { emitToWorkspace } from "../lib/socket";

const router: IRouter = Router();
router.use(requireAuth);

async function nameOf(userId: number | null): Promise<string | null> {
  if (userId === null) return null;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  return user?.name ?? null;
}

async function toTaskResponse(task: typeof tasksTable.$inferSelect) {
  return {
    ...task,
    assigneeName: await nameOf(task.assigneeId),
    lockedByName: await nameOf(task.lockedBy),
  };
}

router.get("/workspaces/:id/tasks", async (req, res): Promise<void> => {
  const params = ListTasksParams.safeParse(req.params);
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
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.workspaceId, params.data.id))
    .orderBy(tasksTable.order);

  const withNames = await Promise.all(rows.map(toTaskResponse));
  res.json(ListTasksResponse.parse(withNames));
});

router.post("/workspaces/:id/tasks", async (req, res): Promise<void> => {
  const params = CreateTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const membership = await getMembership(params.data.id, req.userId!);
  if (!membership || !canEdit(membership.role as "owner" | "editor" | "viewer")) {
    res.status(403).json({ error: "You do not have permission to create tasks" });
    return;
  }

  const [task] = await db
    .insert(tasksTable)
    .values({
      workspaceId: params.data.id,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      status: parsed.data.status ?? "todo",
      priority: parsed.data.priority ?? "medium",
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      assigneeId: parsed.data.assigneeId ?? null,
      createdBy: req.userId!,
    })
    .returning();

  const response = await toTaskResponse(task!);
  const [actor] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  await logActivity(
    params.data.id,
    req.userId!,
    actor!.name,
    `${actor!.name} created task "${task!.title}"`,
  );
  emitToWorkspace(params.data.id, "task:created", { task: response });

  res.status(201).json(CreateTaskResponse.parse(response));
});

router.patch("/tasks/:id", async (req, res): Promise<void> => {
  const params = UpdateTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(tasksTable).where(eq(tasksTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const membership = await getMembership(existing.workspaceId, req.userId!);
  if (!membership || !canEdit(membership.role as "owner" | "editor" | "viewer")) {
    res.status(403).json({ error: "You do not have permission to edit tasks" });
    return;
  }

  if (parsed.data.version !== existing.version) {
    const current = await toTaskResponse(existing);
    res.status(409).json({
      error: "This task was already updated by someone else",
      task: current,
    });
    return;
  }

  const updates: Partial<typeof tasksTable.$inferInsert> = { version: existing.version + 1 };
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description ?? null;
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.order !== undefined) updates.order = parsed.data.order;
  if (parsed.data.assigneeId !== undefined) updates.assigneeId = parsed.data.assigneeId ?? null;
  if (parsed.data.priority !== undefined) updates.priority = parsed.data.priority;
  if (parsed.data.dueDate !== undefined) updates.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;

  const [updated] = await db
    .update(tasksTable)
    .set(updates)
    .where(eq(tasksTable.id, params.data.id))
    .returning();

  const response = await toTaskResponse(updated!);
  const [actor] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));

  const statusChanged = parsed.data.status && parsed.data.status !== existing.status;
  await logActivity(
    existing.workspaceId,
    req.userId!,
    actor!.name,
    statusChanged
      ? `${actor!.name} moved "${updated!.title}" to ${parsed.data.status}`
      : `${actor!.name} updated task "${updated!.title}"`,
  );
  emitToWorkspace(existing.workspaceId, "task:updated", { task: response });

  res.json(UpdateTaskResponse.parse(response));
});

router.delete("/tasks/:id", async (req, res): Promise<void> => {
  const params = DeleteTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db.select().from(tasksTable).where(eq(tasksTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const membership = await getMembership(existing.workspaceId, req.userId!);
  if (!membership || !canEdit(membership.role as "owner" | "editor" | "viewer")) {
    res.status(403).json({ error: "You do not have permission to delete tasks" });
    return;
  }

  await db.delete(tasksTable).where(eq(tasksTable.id, params.data.id));

  const [actor] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  await logActivity(
    existing.workspaceId,
    req.userId!,
    actor!.name,
    `${actor!.name} deleted task "${existing.title}"`,
  );
  emitToWorkspace(existing.workspaceId, "task:deleted", { taskId: existing.id });

  res.sendStatus(204);
});

export default router;
