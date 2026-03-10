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
    // Join a vote room to receive live updates
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
