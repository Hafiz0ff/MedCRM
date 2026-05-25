'use client';

import { io, Socket } from 'socket.io-client';
import { getAccessToken } from '@/shared/api/client-api';

let socket: Socket | undefined;

export function getRealtimeSocket(): Socket {
  if (!socket) {
    socket = io(`${process.env.NEXT_PUBLIC_REALTIME_URL ?? 'http://localhost:3000'}/realtime`, {
      auth: { token: getAccessToken() },
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}
