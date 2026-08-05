import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_URL } from './api';

const AppContext = createContext(null);
export const USER_ID = 1; // demo user — no auth flow yet

export function AppProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const socketRef = useRef(null);

  const pushToast = (title, message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, title, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  };

  useEffect(() => {
    const socket = io(SOCKET_URL);
    socketRef.current = socket;
    socket.emit('join', USER_ID);

    socket.on('booking:confirmed', (data) => {
      pushToast('Booking Confirmed ✅', `Booking #${data.booking_id} — ${data.seat_ids?.length} seat(s)`, 'success');
    });
    socket.on('booking:cancelled', (data) => {
      pushToast('Booking Cancelled', `Booking #${data.booking_id}`, 'warning');
    });

    return () => socket.disconnect();
  }, []);

  return (
    <AppContext.Provider value={{ toasts, pushToast, userId: USER_ID }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}