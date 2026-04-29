// Socket.io transport for realtime bay-status updates.
//
// Topology:
//   - One server-side Socket.io attached to the same HTTP server as Express.
//   - Clients (vendor admin browser, customer Android app) connect with no
//     auth for the MVP (read-only stream of public bay status). When we
//     productionize this we'll add a JWT handshake for vendor-scoped rooms.
//   - Vendor admin clients join `vendor:{vendorId}` rooms to get only their
//     own bay events. Customer Android clients join `nearby` for global
//     vendor-card refresh hints.
//
// Events the server emits:
//   - `bay:update` { vendorId, bayId, status }   → into `vendor:{vendorId}`
//   - `vendor:freeBays` { vendorId, freeBays }   → into `nearby`
//
// Helper `emitBayUpdate()` is the single place backend code touches.

import type { Server as HttpServer } from 'node:http';
import { Server as IOServer } from 'socket.io';
import { logger } from '../lib/logger.js';
import { prisma } from '../config/db.js';

let io: IOServer | null = null;

export function initRealtime(httpServer: HttpServer): void {
  io = new IOServer(httpServer, {
    cors: { origin: '*', credentials: false },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    logger.debug({ id: socket.id }, 'realtime: client connected');

    socket.on('subscribe:vendor', (vendorId: string) => {
      if (typeof vendorId === 'string' && vendorId.length > 0) {
        socket.join(`vendor:${vendorId}`);
        logger.info({ socketId: socket.id, vendorId }, 'realtime: vendor subscribed');
      }
    });
    socket.on('subscribe:customer', (customerId: string) => {
      if (typeof customerId === 'string' && customerId.length > 0) {
        socket.join(`customer:${customerId}`);
        logger.info({ socketId: socket.id, customerId }, 'realtime: customer subscribed');
      }
    });
    socket.on('subscribe:nearby', () => {
      socket.join('nearby');
    });
    socket.on('disconnect', () => {
      logger.debug({ id: socket.id }, 'realtime: client disconnected');
    });
  });

  logger.info('realtime: socket.io initialised');
}

/**
 * Emit a bay-status change to:
 *   1) the vendor admin room (full bay record)
 *   2) the global nearby room (just the recomputed freeBays count)
 */
export async function emitBayUpdate(
  vendorId: string,
  bayId: string,
  status: 'free' | 'busy' | 'closed',
): Promise<void> {
  if (!io) return;

  io.to(`vendor:${vendorId}`).emit('bay:update', { vendorId, bayId, status });

  // Recompute the public freeBays counter and notify the nearby room so
  // customer apps can update vendor-card chips without polling.
  try {
    const freeBays = await prisma.bay.count({
      where: { vendorId, status: 'free', deletedAt: null },
    });
    io.to('nearby').emit('vendor:freeBays', { vendorId, freeBays });
  } catch (err) {
    logger.warn({ err }, 'realtime: freeBays recount failed');
  }
}

/**
 * Emit a booking-status change to the customer's private room so the app
 * can refresh My Bookings without polling.
 */
export function emitBookingStatus(
  customerId: string,
  bookingId: string,
  status: string,
): void {
  if (!io) return;
  const room = `customer:${customerId}`;
  const sockets = io.sockets.adapter.rooms.get(room);
  io.to(room).emit('booking:status', { bookingId, status });
  logger.info(
    { customerId, bookingId, status, listeners: sockets?.size ?? 0 },
    'realtime: booking:status emitted',
  );
}
