import { useEffect, useRef, useState, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import {
  getListTasksQueryKey,
  getListActivityQueryKey,
  getGetWorkspaceQueryKey,
  type Task,
  type ActivityEntry,
} from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';

// ---------------------------------------------------------------------------
// Real-time contract (Socket.IO, mounted at path "/api/socket.io/")
//
// Handshake: `io({ path: "/api/socket.io/", auth: { token: accessToken } })`
// The server verifies the JWT access token at connection time and rejects
// the socket if it's missing/invalid/expired.
//
// Client -> Server:
//   "workspace:join"   { workspaceId: number }
//   "workspace:leave"  { workspaceId: number }
//   "cursor:move"      { workspaceId: number, x: number, y: number }  // x,y are 0-100 percentages of the board container
//   "task:lock"        { workspaceId: number, taskId: number }
//   "task:unlock"      { workspaceId: number, taskId: number }
//
// Server -> Client (broadcast to everyone in the workspace room):
//   "presence:update"  { users: { userId: number, name: string, avatarColor: string }[] }
//   "cursor:update"     { userId: number, name: string, avatarColor: string, x: number, y: number }
//   "task:created"      { task: Task }
//   "task:updated"       { task: Task }
//   "task:deleted"       { taskId: number }
//   "task:locked"        { taskId: number, userId: number, name: string }
//   "task:unlocked"       { taskId: number }
//   "activity:new"        { entry: ActivityEntry }
//   "member:changed"       {}  // membership/role changed -- refetch workspace detail
// ---------------------------------------------------------------------------

export type PresenceUser = { userId: number; name: string; avatarColor: string };
export type CursorState = {
  userId: number;
  name: string;
  avatarColor: string;
  x: number;
  y: number;
};
export type TaskLock = { taskId: number; userId: number; name: string };

let sharedSocket: Socket | null = null;

function getSharedSocket(token: string): Socket {
  if (sharedSocket && sharedSocket.connected) return sharedSocket;
  if (sharedSocket) sharedSocket.disconnect();
  sharedSocket = io({
    path: '/api/socket.io/',
    auth: { token },
    transports: ['websocket', 'polling'],
  });
  return sharedSocket;
}

/**
 * Connects to the workspace's real-time room, keeps presence/cursor/lock
 * state, and automatically invalidates the relevant React Query caches when
 * another client's task/activity/membership mutation is broadcast -- so
 * every REST mutation (including the actor's own) is reflected everywhere
 * via a single code path instead of bespoke optimistic updates per screen.
 */
export function useWorkspaceSocket(workspaceId: number | null, accessToken: string | null) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const [cursors, setCursors] = useState<Record<number, CursorState>>({});
  const [locks, setLocks] = useState<Record<number, TaskLock>>({});
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!workspaceId || !accessToken) return;

    const socket = getSharedSocket(accessToken);
    socketRef.current = socket;

    const join = () => socket.emit('workspace:join', { workspaceId });
    if (socket.connected) join();
    socket.on('connect', () => {
      setConnected(true);
      join();
    });
    socket.on('disconnect', () => setConnected(false));

    const onPresence = (payload: { users: PresenceUser[] }) =>
      setOnlineUsers(payload.users);

    const onCursor = (payload: CursorState) =>
      setCursors((prev) => ({ ...prev, [payload.userId]: payload }));

    const onTaskLocked = (payload: TaskLock) =>
      setLocks((prev) => ({ ...prev, [payload.taskId]: payload }));

    const onTaskUnlocked = (payload: { taskId: number }) =>
      setLocks((prev) => {
        const next = { ...prev };
        delete next[payload.taskId];
        return next;
      });

    const invalidateTasks = () =>
      queryClient.invalidateQueries({ queryKey: getListTasksQueryKey(workspaceId) });
    const invalidateActivity = () =>
      queryClient.invalidateQueries({ queryKey: getListActivityQueryKey(workspaceId) });
    const invalidateWorkspace = () =>
      queryClient.invalidateQueries({ queryKey: getGetWorkspaceQueryKey(workspaceId) });

    const onTaskCreated = (payload: { task: Task }) => {
      invalidateTasks();
      toast({ title: 'New task', description: payload.task.title });
    };
    const onTaskUpdated = () => invalidateTasks();
    const onTaskDeleted = () => invalidateTasks();
    const onActivityNew = (payload: { entry: ActivityEntry }) => {
      invalidateActivity();
      toast({ description: payload.entry.message });
    };
    const onMemberChanged = () => {
      invalidateWorkspace();
      invalidateActivity();
    };

    socket.on('presence:update', onPresence);
    socket.on('cursor:update', onCursor);
    socket.on('task:locked', onTaskLocked);
    socket.on('task:unlocked', onTaskUnlocked);
    socket.on('task:created', onTaskCreated);
    socket.on('task:updated', onTaskUpdated);
    socket.on('task:deleted', onTaskDeleted);
    socket.on('activity:new', onActivityNew);
    socket.on('member:changed', onMemberChanged);

    return () => {
      socket.emit('workspace:leave', { workspaceId });
      socket.off('connect');
      socket.off('disconnect');
      socket.off('presence:update', onPresence);
      socket.off('cursor:update', onCursor);
      socket.off('task:locked', onTaskLocked);
      socket.off('task:unlocked', onTaskUnlocked);
      socket.off('task:created', onTaskCreated);
      socket.off('task:updated', onTaskUpdated);
      socket.off('task:deleted', onTaskDeleted);
      socket.off('activity:new', onActivityNew);
      socket.off('member:changed', onMemberChanged);
      setOnlineUsers([]);
      setCursors({});
      setLocks({});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, accessToken]);

  const emitCursor = useCallback(
    (x: number, y: number) => {
      if (!workspaceId || !socketRef.current) return;
      socketRef.current.emit('cursor:move', { workspaceId, x, y });
    },
    [workspaceId],
  );

  const lockTask = useCallback(
    (taskId: number) => {
      if (!workspaceId || !socketRef.current) return;
      socketRef.current.emit('task:lock', { workspaceId, taskId });
    },
    [workspaceId],
  );

  const unlockTask = useCallback(
    (taskId: number) => {
      if (!workspaceId || !socketRef.current) return;
      socketRef.current.emit('task:unlock', { workspaceId, taskId });
    },
    [workspaceId],
  );

  return { connected, onlineUsers, cursors, locks, emitCursor, lockTask, unlockTask };
}
