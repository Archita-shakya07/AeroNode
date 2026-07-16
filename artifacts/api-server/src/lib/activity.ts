import { db, activityLogTable } from "@workspace/db";
import { emitToWorkspace } from "./socket";

/** Logs an activity entry and broadcasts it to everyone viewing the workspace. */
export async function logActivity(
  workspaceId: number,
  userId: number,
  userName: string,
  message: string,
) {
  const [entry] = await db
    .insert(activityLogTable)
    .values({ workspaceId, userId, message })
    .returning();

  emitToWorkspace(workspaceId, "activity:new", {
    entry: {
      id: entry!.id,
      workspaceId: entry!.workspaceId,
      userId: entry!.userId,
      userName,
      message: entry!.message,
      createdAt: entry!.createdAt,
    },
  });
}
