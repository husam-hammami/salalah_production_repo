import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Create socket connection for both development and production
    const socketUrl = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:5000' // Direct connection to Flask in development
      : window.location.origin; // Use nginx proxy in production/Docker
      
    const newSocket = io(socketUrl, {
        transports: ['websocket', 'polling'],
        autoConnect: false,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      newSocket.on('connect', () => {
        console.log('Socket connected');
        setIsConnected(true);
      });

      newSocket.on('disconnect', () => {
        console.log('Socket disconnected');
        setIsConnected(false);
      });

      newSocket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        setIsConnected(false);
      });

      newSocket.on('fcl_data', (data) => {
        console.log('FCL data received:', data);
      });

      newSocket.on('scl_data', (data) => {
        console.log('SCL data received:', data);
      });

    newSocket.on('mila_data', (data) => {
      console.log('MILA data received:', data);
    });

      setSocket(newSocket);

      // Connect to socket
      newSocket.connect();

      // Cleanup on unmount
      return () => {
        if (newSocket) {
          newSocket.disconnect();
        }
      };
  }, []);

  const value = {
    socket,
    isConnected,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}; 