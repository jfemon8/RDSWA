import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from './config/env';
import { User } from './models';

let io: Server | null = null;

/**
 * Track online users across multiple sockets (a user may have N tabs open).
 * Map<userId, Set<socketId>> — a user is "online" as long as any socket is live.
 */
const onlineUsers = new Map<string, Set<string>>();

/** Update the lastSeenAt field on a user (fire-and-forget). */
function touchLastSeen(userId: string): void {
  User.findByIdAndUpdate(userId, { lastSeenAt: new Date() })
    .exec()
    .catch(() => { /* non-blocking */ });
}

/** Broadcast presence change to everyone listening on the presence room. */
function broadcastPresence(userId: string, online: boolean): void {
  if (!io) return;
  io.emit('presence:update', { userId, online, lastSeenAt: online ? null : new Date() });
}

export function initSocket(httpServer: HTTPServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: env.CLIENT_URL,
      credentials: true,
    },
    path: '/socket.io',
  });

  // Auth middleware — optional auth (allow anonymous watchers)
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as any;
        socket.data.userId = decoded.userId;
        socket.data.role = decoded.role;
      } catch {
        // Invalid token — allow connection but without auth
      }
    }
    next();
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId as string | undefined;

    // Auto-join user's personal room for notifications
    if (userId) {
      socket.join(`user:${userId}`);

      // Track presence — add this socket to the user's socket set.
      // First socket for a user → emit online event.
      const existing = onlineUsers.get(userId);
      if (existing) {
        existing.add(socket.id);
      } else {
        onlineUsers.set(userId, new Set([socket.id]));
        touchLastSeen(userId);
        broadcastPresence(userId, true);
      }
    }

    // ── Chat group rooms ──
    socket.on('chat:join', (groupId: string) => {
      if (groupId && typeof groupId === 'string') {
        socket.join(`chat:${groupId}`);
      }
    });

    socket.on('chat:leave', (groupId: string) => {
      if (groupId && typeof groupId === 'string') {
        socket.leave(`chat:${groupId}`);
      }
    });

    // ── Typing indicator (group or DM) ──
    // Clients emit `chat:typing` with { groupId? , recipientId?, isTyping }.
    // Server fans out to the corresponding room without hitting the DB.
    socket.on('chat:typing', (payload: { groupId?: string; recipientId?: string; isTyping: boolean }) => {
      if (!userId || !payload) return;
      const evt = {
        userId,
        isTyping: !!payload.isTyping,
        groupId: payload.groupId,
        recipientId: payload.recipientId,
      };
      if (payload.groupId) {
        socket.to(`chat:${payload.groupId}`).emit('chat:typing', evt);
      } else if (payload.recipientId) {
        io?.to(`user:${payload.recipientId}`).emit('chat:typing', evt);
      }
      if (payload.isTyping) touchLastSeen(userId);
    });

    // ── Presence snapshot request (get current state of N users) ──
    // Returns per-user { online, lastSeenAt? } — offline users get lastSeenAt
    // from the DB so the client can render "Last seen X ago" on first open.
    socket.on('presence:query', async (
      userIds: string[],
      ack?: (states: Record<string, { online: boolean; lastSeenAt?: string | null }>) => void,
    ) => {
      if (!Array.isArray(userIds) || typeof ack !== 'function') return;
      const states: Record<string, { online: boolean; lastSeenAt?: string | null }> = {};
      const offlineIds: string[] = [];
      for (const id of userIds) {
        const online = onlineUsers.has(id);
        states[id] = { online };
        if (!online) offlineIds.push(id);
      }
      if (offlineIds.length > 0) {
        try {
          const rows = await User.find({ _id: { $in: offlineIds } })
            .select('lastSeenAt')
            .lean();
          for (const u of rows) {
            const key = (u._id as any).toString();
            if (states[key]) states[key].lastSeenAt = u.lastSeenAt ? u.lastSeenAt.toISOString() : null;
          }
        } catch { /* non-blocking — fall back to no lastSeenAt */ }
      }
      ack(states);
    });

    // ── Vote rooms ──
    socket.on('vote:join', (voteId: string) => {
      if (voteId && typeof voteId === 'string') {
        socket.join(`vote:${voteId}`);
      }
    });

    socket.on('vote:leave', (voteId: string) => {
      if (voteId && typeof voteId === 'string') {
        socket.leave(`vote:${voteId}`);
      }
    });

    socket.on('disconnect', () => {
      if (!userId) return;
      const set = onlineUsers.get(userId);
      if (!set) return;
      set.delete(socket.id);
      if (set.size === 0) {
        onlineUsers.delete(userId);
        touchLastSeen(userId);
        broadcastPresence(userId, false);
      }
    });
  });

  return io;
}

export function getIO(): Server | null {
  return io;
}

/** Check whether a user currently has any live socket. */
export function isUserOnline(userId: string): boolean {
  return onlineUsers.has(userId);
}

/**
 * Broadcast a new group chat message to all clients in the group room.
 */
export function broadcastChatMessage(groupId: string, message: any): void {
  if (io) {
    io.to(`chat:${groupId}`).emit('chat:message', { groupId, message });
  }
}

/**
 * Broadcast a message edit to the group room.
 */
export function broadcastChatMessageEdit(groupId: string, message: any): void {
  if (io) {
    io.to(`chat:${groupId}`).emit('chat:message:edit', { groupId, message });
  }
}

/**
 * Broadcast a hard-deleted message (delete-for-everyone) to the group room.
 */
export function broadcastChatMessageDelete(groupId: string, messageId: string): void {
  if (io) {
    io.to(`chat:${groupId}`).emit('chat:message:delete', { groupId, messageId });
  }
}

/**
 * Broadcast a reaction add/remove to the group room.
 */
export function broadcastChatReaction(
  groupId: string,
  messageId: string,
  reactions: Array<{ user: string; emoji: string }>
): void {
  if (io) {
    io.to(`chat:${groupId}`).emit('chat:message:reaction', { groupId, messageId, reactions });
  }
}

/**
 * Broadcast a read-receipt update to the group room so every open client
 * updates its receipt ticks.
 */
export function broadcastChatRead(groupId: string, messageIds: string[], userId: string): void {
  if (io) {
    io.to(`chat:${groupId}`).emit('chat:message:read', { groupId, messageIds, userId });
  }
}

/**
 * Notify *every* member of a group that chat activity happened, so their
 * chat-list UIs (GroupsPage, ChatHubPage, MessageBell, etc.) can refresh
 * previews / unread counts / ordering even when they don't currently have
 * the group chat page open. The `chat:${groupId}` room only reaches users
 * actively viewing that chat, so this is the complement for everyone else.
 *
 * `kind`:
 *   - 'message' — new message posted (reorder list, bump unread)
 *   - 'edit' / 'delete' — preview text may have changed
 *   - 'read' — unread count for the reader should recompute
 */
export function broadcastGroupActivity(
  groupId: string,
  kind: 'message' | 'edit' | 'delete' | 'read',
  memberIds: Array<string | { toString(): string }>
): void {
  if (!io) return;
  const payload = { groupId, kind, at: Date.now() };
  const seen = new Set<string>();
  for (const raw of memberIds) {
    const id = typeof raw === 'string' ? raw : raw.toString();
    if (seen.has(id)) continue;
    seen.add(id);
    io.to(`user:${id}`).emit('chat:group:activity', payload);
  }
}

/**
 * Broadcast a DM to both sender and recipient personal rooms.
 */
export function broadcastDM(senderId: string, recipientId: string, message: any): void {
  if (io) {
    const data = { senderId, recipientId, message };
    io.to(`user:${senderId}`).emit('dm:message', data);
    io.to(`user:${recipientId}`).emit('dm:message', data);
  }
}

/** Broadcast a DM edit to both participants. */
export function broadcastDMEdit(senderId: string, recipientId: string, message: any): void {
  if (io) {
    const data = { senderId, recipientId, message };
    io.to(`user:${senderId}`).emit('dm:message:edit', data);
    io.to(`user:${recipientId}`).emit('dm:message:edit', data);
  }
}

/** Broadcast a DM delete-for-everyone to both participants. */
export function broadcastDMDelete(senderId: string, recipientId: string, messageId: string): void {
  if (io) {
    const data = { senderId, recipientId, messageId };
    io.to(`user:${senderId}`).emit('dm:message:delete', data);
    io.to(`user:${recipientId}`).emit('dm:message:delete', data);
  }
}

/** Broadcast a DM reaction to both participants. */
export function broadcastDMReaction(
  senderId: string,
  recipientId: string,
  messageId: string,
  reactions: Array<{ user: string; emoji: string }>
): void {
  if (io) {
    const data = { senderId, recipientId, messageId, reactions };
    io.to(`user:${senderId}`).emit('dm:message:reaction', data);
    io.to(`user:${recipientId}`).emit('dm:message:reaction', data);
  }
}

/** Broadcast a DM read-receipt update so the sender's ticks flip. */
export function broadcastDMRead(senderId: string, recipientId: string, messageIds: string[]): void {
  if (io) {
    const data = { senderId, recipientId, messageIds };
    io.to(`user:${senderId}`).emit('dm:message:read', data);
    io.to(`user:${recipientId}`).emit('dm:message:read', data);
  }
}

/**
 * Broadcast updated vote counts to all clients watching a specific vote.
 */
export function broadcastVoteUpdate(voteId: string, data: {
  totalVotes: number;
  options: Array<{ _id: string; text: string; voteCount: number }>;
}): void {
  if (io) {
    io.to(`vote:${voteId}`).emit('vote:updated', { voteId, ...data });
  }
}

/**
 * Broadcast vote status change (closed, published).
 */
export function broadcastVoteStatus(voteId: string, status: string): void {
  if (io) {
    io.to(`vote:${voteId}`).emit('vote:status', { voteId, status });
  }
}
