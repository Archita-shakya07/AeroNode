import {
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { workspacesTable } from "./workspaces";

// role is stored as free text validated by the Zod Role enum at the API
// boundary rather than a Postgres enum, so adding a role never needs a
// migration.
export const workspaceMembersTable = pgTable(
  "workspace_members",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspacesTable.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // owner | editor | viewer
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [unique().on(table.workspaceId, table.userId)],
);

export const insertWorkspaceMemberSchema = createInsertSchema(
  workspaceMembersTable,
).omit({ id: true, joinedAt: true });
export type InsertWorkspaceMember = z.infer<
  typeof insertWorkspaceMemberSchema
>;
export type WorkspaceMemberRow = typeof workspaceMembersTable.$inferSelect;
