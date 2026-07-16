import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, filesTable, usersTable } from "@workspace/db";
import {
  ListFilesParams,
  ListFilesResponse,
  CreateFileParams,
  CreateFileBody,
  CreateFileResponse,
  DeleteFileParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/require-auth";
import { getMembership } from "../lib/workspace-access";
import { logActivity } from "../lib/activity";
import { emitToWorkspace } from "../lib/socket";

const router: IRouter = Router();
router.use(requireAuth);

async function toFileResponse(file: typeof filesTable.$inferSelect) {
  const [uploader] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, file.uploadedBy));
  return { ...file, uploadedByName: uploader?.name ?? "Unknown" };
}

router.get("/workspaces/:id/files", async (req, res): Promise<void> => {
  const params = ListFilesParams.safeParse(req.params);
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
    .from(filesTable)
    .where(eq(filesTable.workspaceId, params.data.id))
    .orderBy(filesTable.createdAt);

  const withNames = await Promise.all(rows.reverse().map(toFileResponse));
  res.json(ListFilesResponse.parse(withNames));
});

router.post("/workspaces/:id/files", async (req, res): Promise<void> => {
  const params = CreateFileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateFileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const membership = await getMembership(params.data.id, req.userId!);
  if (!membership) {
    res.status(403).json({ error: "Not a member of this workspace" });
    return;
  }

  const [file] = await db
    .insert(filesTable)
    .values({
      workspaceId: params.data.id,
      fileName: parsed.data.fileName,
      objectPath: parsed.data.objectPath,
      contentType: parsed.data.contentType,
      size: parsed.data.size,
      uploadedBy: req.userId!,
    })
    .returning();

  const response = await toFileResponse(file!);
  const [actor] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  await logActivity(
    params.data.id,
    req.userId!,
    actor!.name,
    `${actor!.name} uploaded "${file!.fileName}"`,
  );
  emitToWorkspace(params.data.id, "file:created", { file: response });

  res.status(201).json(CreateFileResponse.parse(response));
});

router.delete("/files/:id", async (req, res): Promise<void> => {
  const params = DeleteFileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db.select().from(filesTable).where(eq(filesTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  const membership = await getMembership(existing.workspaceId, req.userId!);
  if (!membership) {
    res.status(403).json({ error: "Not a member of this workspace" });
    return;
  }

  await db.delete(filesTable).where(eq(filesTable.id, params.data.id));

  const [actor] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  await logActivity(
    existing.workspaceId,
    req.userId!,
    actor!.name,
    `${actor!.name} deleted "${existing.fileName}"`,
  );
  emitToWorkspace(existing.workspaceId, "file:deleted", { fileId: existing.id });

  res.sendStatus(204);
});

export default router;
