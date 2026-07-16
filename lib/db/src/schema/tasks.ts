import {
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { workspacesTable } from "./workspaces";

// status stored as free text validated by the Zod TaskStatus enum.
// lockedBy/lockedAt track a soft edit lock broadcast over Socket.IO (not
// persisted state the REST API otherwise relies on) so a crashed client
// doesn't permanently strand a lock -- lockedAt lets a cleanup job (or a
// simple staleness check) ignore locks older than a short TTL.
export const tasksTable = pgTable("tasks", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id")
    .notNull()
    .references(() => workspacesTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("todo"), // todo | in_progress | done
  priority: text("priority").notNull().default("medium"), // low | medium | high | urgent
  dueDate: timestamp("due_date", { withTimezone: true }),
  order: integer("order").notNull().default(0),
  assigneeId: integer("assignee_id").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  createdBy: integer("created_by")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  lockedBy: integer("locked_by").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertTaskSchema = createInsertSchema(tasksTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type TaskRow = typeof tasksTable.$inferSelect;
