import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, messagesTable, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/require-auth";
import { getMembership } from "../lib/workspace-access";
import { emitToWorkspace } from "../lib/socket";

const router: IRouter = Router();
router.use(requireAuth);

async function toMessageResponse(message: typeof messagesTable.$inferSelect) {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, message.userId));
  return {
    ...message,
    userName: user?.name ?? "Unknown",
    avatarColor: user?.avatarColor ?? "#6366f1",
  };
}

router.get("/workspaces/:id/messages", async (req, res): Promise<void> => {
  const workspaceId = parseInt(req.params.id, 10);
  if (Number.isNaN(workspaceId)) {
    res.status(400).json({ error: "Invalid workspace id" });
    return;
  }

  const membership = await getMembership(workspaceId, req.userId!);
  if (!membership) {
    res.status(403).json({ error: "Not a member of this workspace" });
    return;
  }

  const rows = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.workspaceId, workspaceId))
    .orderBy(desc(messagesTable.createdAt))
    .limit(200);

  const withUser = await Promise.all(rows.map(toMessageResponse));
  res.json(withUser.reverse());
});

router.post("/workspaces/:id/messages", async (req, res): Promise<void> => {
  const workspaceId = parseInt(req.params.id, 10);
  if (Number.isNaN(workspaceId)) {
    res.status(400).json({ error: "Invalid workspace id" });
    return;
  }

  const content =
    typeof req.body.content === "string" ? req.body.content.trim() : "";
  if (!content) {
    res.status(400).json({ error: "Message content is required" });
    return;
  }

  const membership = await getMembership(workspaceId, req.userId!);
  if (!membership) {
    res.status(403).json({ error: "Not a member of this workspace" });
    return;
  }

  const [message] = await db
    .insert(messagesTable)
    .values({
      workspaceId,
      userId: req.userId!,
      content,
    })
    .returning();

  const response = await toMessageResponse(message!);
  emitToWorkspace(workspaceId, "message:new", { message: response });

  res.status(201).json(response);
});

router.delete("/messages/:id", async (req, res): Promise<void> => {
  const messageId = parseInt(req.params.id, 10);
  if (Number.isNaN(messageId)) {
    res.status(400).json({ error: "Invalid message id" });
    return;
  }

  const [existing] = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.id, messageId));
  if (!existing) {
    res.sendStatus(204);
    return;
  }

  if (existing.userId !== req.userId) {
    res.status(403).json({ error: "You can only delete your own messages" });
    return;
  }

  const membership = await getMembership(existing.workspaceId, req.userId!);
  if (!membership) {
    res.status(403).json({ error: "Not a member of this workspace" });
    return;
  }

  await db.delete(messagesTable).where(eq(messagesTable.id, messageId));
  emitToWorkspace(existing.workspaceId, "message:deleted", {
    messageId: existing.id,
  });

  res.sendStatus(204);
});

export default router;