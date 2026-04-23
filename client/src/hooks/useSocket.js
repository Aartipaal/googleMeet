import { io } from 'socket.io-client';
import { SOCKET_URL } from '../config';

let socketInstance = null;

export const initSocket = (token) => {
  if (socketInstance && socketInstance.connected) return socketInstance;
  if (socketInstance) { socketInstance.disconnect(); socketInstance = null; }
  socketInstance = io(SOCKET_URL, {
    auth: { token },
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 3000,
    timeout: 30000,
  });
  return socketInstance;
};

export const getSocket = () => socketInstance;

export const disconnectSocket = () => {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
};
