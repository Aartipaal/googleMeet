import { io } from 'socket.io-client';

let socketInstance = null;

export const initSocket = (token) => {
  if (socketInstance) return socketInstance;
  socketInstance = io(process.env.REACT_APP_SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
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
