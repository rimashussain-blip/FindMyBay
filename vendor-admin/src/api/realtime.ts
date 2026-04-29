// Singleton Socket.io client. The vendor admin uses this to subscribe to
// `bay:update` events for the signed-in vendor so the Bay Board reflects
// QR check-ins (and manual flips from any other tab) without polling.
//
// We hit the dev proxy at /api so Vite forwards to the backend HTTP server,
// which is the same server Socket.io is attached to.

import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getRealtimeSocket(): Socket {
  if (!socket) {
    socket = io('/', {
      path: '/socket.io', // matches default
      transports: ['websocket'],
      autoConnect: true,
    });
  }
  return socket;
}

export interface BayUpdate {
  vendorId: string;
  bayId: string;
  status: 'free' | 'busy' | 'closed';
}

export interface VendorFreeBays {
  vendorId: string;
  freeBays: number;
}
