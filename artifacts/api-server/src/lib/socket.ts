import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import { verifyAccessToken } from "./auth";
import { logger } from "./logger";

export type PresenceUser = { userId: number; name: string; avatarColor: string };

type SocketData = {
  userId: number;
  name: string;
  avatarColor: string;
};

// workspaceId -> userId -> set of socket ids (a user can have multiple tabs open)
const presence = new Map<number, Map<number, Set<string>>>();
// workspaceId -> taskId -> lock info (soft, in-memory only -- never persisted)
const locks = new Map<number, Map<number, { userId: number; name: string }>>();

let io: Server | null = null;

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    path: "/api/socket.io/",
    cors: { origin: true, credentials: true },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.["token"];
    if (typeof token !== "string" || !token) {
      next(new Error("Authentication required"));
      return;
    }
    try {
      const payload = verifyAccessToken(token);
      (socket.data as SocketData) = {
        userId: payload.sub,
        name: payload.name,
        avatarColor: payload.avatarColor,
      };
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const data = socket.data as SocketData;
    let joinedWorkspaceId: number | null = null;

    const leaveCurrentWorkspace = () => {
      if (joinedWorkspaceId === null) return;
      const workspaceId = joinedWorkspaceId;
      joinedWorkspaceId = null;

      const users = presence.get(workspaceId);
      const sockets = users?.get(data.userId);
      sockets?.delete(socket.id);
      if (sockets && sockets.size === 0) {
        users!.delete(data.userId);
      }

      const workspaceLocks = locks.get(workspaceId);
      for (const [taskId, lock] of workspaceLocks ?? []) {
        if (lock.userId === data.userId) {
          workspaceLocks!.delete(taskId);
          io!.to(roomName(workspaceId)).emit("task:unlocked", { taskId });
        }
      }

      socket.leave(roomName(workspaceId));
      broadcastPresence(workspaceId);
    };

    socket.on("workspace:join", ({ workspaceId }: { workspaceId: number }) => {
      if (typeof workspaceId !== "number") return;
      if (joinedWorkspaceId !== null && joinedWorkspaceId !== workspaceId) {
        leaveCurrentWorkspace();
      }
      joinedWorkspaceId = workspaceId;
      socket.join(roomName(workspaceId));

      if (!presence.has(workspaceId)) presence.set(workspaceId, new Map());
      const users = presence.get(workspaceId)!;
      if (!users.has(data.userId)) users.set(data.userId, new Set());
      users.get(data.userId)!.add(socket.id);

      broadcastPresence(workspaceId);

      // Replay current locks to the newly joined client.
      const workspaceLocks = locks.get(workspaceId);
      if (workspaceLocks) {
        for (const [taskId, lock] of workspaceLocks) {
          socket.emit("task:locked", { taskId, userId: lock.userId, name: lock.name });
        }
      }
    });

    socket.on("workspace:leave", () => leaveCurrentWorkspace());

    socket.on(
      "cursor:move",
      ({ workspaceId, x, y }: { workspaceId: number; x: number; y: number }) => {
        if (workspaceId !== joinedWorkspaceId) return;
        if (typeof x !== "number" || typeof y !== "number") return;
        socket.to(roomName(workspaceId)).emit("cursor:update", {
          userId: data.userId,
          name: data.name,
          avatarColor: data.avatarColor,
          x,
          y,
        });
      },
    );

    socket.on(
      "task:lock",
      ({ workspaceId, taskId }: { workspaceId: number; taskId: number }) => {
        if (workspaceId !== joinedWorkspaceId) return;
        if (!locks.has(workspaceId)) locks.set(workspaceId, new Map());
        const workspaceLocks = locks.get(workspaceId)!;
        const existing = workspaceLocks.get(taskId);
        if (existing && existing.userId !== data.userId) return; // already locked by someone else
        workspaceLocks.set(taskId, { userId: data.userId, name: data.name });
        io!.to(roomName(workspaceId)).emit("task:locked", {
          taskId,
          userId: data.userId,
          name: data.name,
        });
      },
    );

    socket.on(
      "task:unlock",
      ({ workspaceId, taskId }: { workspaceId: number; taskId: number }) => {
        if (workspaceId !== joinedWorkspaceId) return;
        const workspaceLocks = locks.get(workspaceId);
        const existing = workspaceLocks?.get(taskId);
        if (!existing || existing.userId !== data.userId) return;
        workspaceLocks!.delete(taskId);
        io!.to(roomName(workspaceId)).emit("task:unlocked", { taskId });
      },
    );

    socket.on("disconnect", () => leaveCurrentWorkspace());
  });

  logger.info("Socket.IO server initialized");
  return io;
}

function roomName(workspaceId: number): string {
  return `workspace:${workspaceId}`;
}

function broadcastPresence(workspaceId: number) {
  const users = presence.get(workspaceId);
  const socketsById = io!.sockets.sockets;
  const seen = new Map<number, PresenceUser>();
  for (const [userId, socketIds] of users ?? []) {
    for (const id of socketIds) {
      const s = socketsById.get(id);
      if (s) {
        const d = s.data as SocketData;
        seen.set(userId, { userId, name: d.name, avatarColor: d.avatarColor });
        break;
      }
    }
  }
  io!.to(roomName(workspaceId)).emit("presence:update", {
    users: Array.from(seen.values()),
  });
}

/** Broadcast a server-side REST mutation to every client viewing a workspace. */
export function emitToWorkspace(workspaceId: number, event: string, payload: unknown) {
  io?.to(roomName(workspaceId)).emit(event, payload);
}
