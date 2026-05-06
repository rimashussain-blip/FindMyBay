// Singleton Socket.io client. The vendor admin uses this to subscribe to
// `bay:update` events for the signed-in vendor so the Bay Board reflects
// QR check-ins (and manual flips from any other tab) without polling.
//
// In dev: hits Vite's proxy at /. In prod: VITE_API_BASE_URL points straight
// at the backend host where Socket.io is attached.

import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

const SOCKET_URL = import.meta.env.VITE_API_BASE_URL || '/';

export function getRealtimeSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
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
