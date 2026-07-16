import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, meetingsTable, usersTable } from "@workspace/db";
import {
  ListMeetingsParams,
  ListMeetingsResponse,
  CreateMeetingParams,
  CreateMeetingBody,
  CreateMeetingResponse,
  UpdateMeetingParams,
  UpdateMeetingBody,
  UpdateMeetingResponse,
  DeleteMeetingParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/require-auth";
import { getMembership, canEdit } from "../lib/workspace-access";
import { logActivity } from "../lib/activity";
import { emitToWorkspace } from "../lib/socket";

const router: IRouter = Router();
router.use(requireAuth);

async function toMeetingResponse(meeting: typeof meetingsTable.$inferSelect) {
  const [creator] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, meeting.createdBy));
  return { ...meeting, createdByName: creator?.name ?? "Unknown" };
}

router.get("/workspaces/:id/meetings", async (req, res): Promise<void> => {
  const params = ListMeetingsParams.safeParse(req.params);
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
    .from(meetingsTable)
    .where(eq(meetingsTable.workspaceId, params.data.id))
    .orderBy(meetingsTable.scheduledAt);

  const withNames = await Promise.all(rows.map(toMeetingResponse));
  res.json(ListMeetingsResponse.parse(withNames));
});

router.post("/workspaces/:id/meetings", async (req, res): Promise<void> => {
  const params = CreateMeetingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateMeetingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const membership = await getMembership(params.data.id, req.userId!);
  if (!membership || !canEdit(membership.role as "owner" | "editor" | "viewer")) {
    res.status(403).json({ error: "You do not have permission to schedule meetings" });
    return;
  }

  const [meeting] = await db
    .insert(meetingsTable)
    .values({
      workspaceId: params.data.id,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      scheduledAt: new Date(parsed.data.scheduledAt),
      durationMinutes: parsed.data.durationMinutes ?? 30,
      meetingLink: parsed.data.meetingLink ?? null,
      createdBy: req.userId!,
    })
    .returning();

  const response = await toMeetingResponse(meeting!);
  const [actor] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  await logActivity(
    params.data.id,
    req.userId!,
    actor!.name,
    `${actor!.name} scheduled meeting "${meeting!.title}"`,
  );
  emitToWorkspace(params.data.id, "meeting:created", { meeting: response });

  res.status(201).json(CreateMeetingResponse.parse(response));
});

router.patch("/meetings/:id", async (req, res): Promise<void> => {
  const params = UpdateMeetingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateMeetingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(meetingsTable)
    .where(eq(meetingsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Meeting not found" });
    return;
  }

  const membership = await getMembership(existing.workspaceId, req.userId!);
  if (!membership || !canEdit(membership.role as "owner" | "editor" | "viewer")) {
    res.status(403).json({ error: "You do not have permission to edit meetings" });
    return;
  }

  const updates: Partial<typeof meetingsTable.$inferInsert> = {};
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description ?? null;
  if (parsed.data.scheduledAt !== undefined) updates.scheduledAt = new Date(parsed.data.scheduledAt);
  if (parsed.data.durationMinutes !== undefined) updates.durationMinutes = parsed.data.durationMinutes;
  if (parsed.data.meetingLink !== undefined) updates.meetingLink = parsed.data.meetingLink ?? null;

  const [updated] = await db
    .update(meetingsTable)
    .set(updates)
    .where(eq(meetingsTable.id, params.data.id))
    .returning();

  const response = await toMeetingResponse(updated!);
  const [actor] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  await logActivity(
    existing.workspaceId,
    req.userId!,
    actor!.name,
    `${actor!.name} updated meeting "${updated!.title}"`,
  );
  emitToWorkspace(existing.workspaceId, "meeting:updated", { meeting: response });

  res.json(UpdateMeetingResponse.parse(response));
});

router.delete("/meetings/:id", async (req, res): Promise<void> => {
  const params = DeleteMeetingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(meetingsTable)
    .where(eq(meetingsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Meeting not found" });
    return;
  }

  const membership = await getMembership(existing.workspaceId, req.userId!);
  if (!membership || !canEdit(membership.role as "owner" | "editor" | "viewer")) {
    res.status(403).json({ error: "You do not have permission to delete meetings" });
    return;
  }

  await db.delete(meetingsTable).where(eq(meetingsTable.id, params.data.id));

  const [actor] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  await logActivity(
    existing.workspaceId,
    req.userId!,
    actor!.name,
    `${actor!.name} deleted meeting "${existing.title}"`,
  );
  emitToWorkspace(existing.workspaceId, "meeting:deleted", { meetingId: existing.id });

  res.sendStatus(204);
});

export default router;
