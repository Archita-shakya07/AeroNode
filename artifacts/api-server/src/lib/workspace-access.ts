import { and, eq } from "drizzle-orm";
import { db, workspaceMembersTable } from "@workspace/db";

export type Role = "owner" | "editor" | "viewer";

export async function getMembership(workspaceId: number, userId: number) {
  const [row] = await db
    .select()
    .from(workspaceMembersTable)
    .where(
      and(
        eq(workspaceMembersTable.workspaceId, workspaceId),
        eq(workspaceMembersTable.userId, userId),
      ),
    );
  return row ?? null;
}

export function canEdit(role: Role): boolean {
  return role === "owner" || role === "editor";
}
