import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { jwtDecode } from 'jwt-decode';
import { SOCKET_URL, api } from './api';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [socket, setSocket] = useState(null);
  const [user, setUser] = useState(null); // { user_id, name, email }
  const [authLoading, setAuthLoading] = useState(true);
  const socketRef = useRef(null);

  const pushToast = (title, message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, title, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  };

  // On load, check for an existing token and validate it
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setAuthLoading(false);
      return;
    }
    try {
      const decoded = jwtDecode(token);
      if (decoded.exp * 1000 < Date.now()) {
        localStorage.removeItem('token');
        setAuthLoading(false);
        return;
      }
      api.getMe()
        .then((res) => setUser(res.user))
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setAuthLoading(false));
    } catch {
      localStorage.removeItem('token');
      setAuthLoading(false);
    }
  }, []);

  // Connect socket whenever we have a logged-in user
  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
      }
      return;
    }

    const s = io(SOCKET_URL);
    socketRef.current = s;
    setSocket(s);
    s.emit('join', user.user_id);

    s.on('booking:confirmed', (data) => {
      pushToast('Booking Confirmed ✅', `Booking #${data.booking_id} — ${data.seat_ids?.length} seat(s)`, 'success');
    });
    s.on('booking:cancelled', (data) => {
      pushToast('Booking Cancelled', `Booking #${data.booking_id}`, 'warning');
    });

    return () => s.disconnect();
  }, [user]);

  const login = useCallback(async (email, password) => {
    const res = await api.login(email, password);
    localStorage.setItem('token', res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const register = useCallback(async (name, email, password) => {
    const res = await api.register(name, email, password);
    localStorage.setItem('token', res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setUser(null);
  }, []);

  return (
    <AppContext.Provider
      value={{ toasts, pushToast, socket, user, authLoading, login, register, logout }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}