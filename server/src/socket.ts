import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from './config/env';

let io: Server | null = null;

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
    // Auto-join user's personal room for notifications
    if (socket.data.userId) {
      socket.join(`user:${socket.data.userId}`);
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
      // Cleanup handled automatically by Socket.IO
    });
  });

  return io;
}

export function getIO(): Server | null {
  return io;
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
 * Broadcast a DM to both sender and recipient personal rooms.
 */
export function broadcastDM(senderId: string, recipientId: string, message: any): void {
  if (io) {
    const data = { senderId, recipientId, message };
    io.to(`user:${senderId}`).emit('dm:message', data);
    io.to(`user:${recipientId}`).emit('dm:message', data);
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
