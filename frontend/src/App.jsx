import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { api, SOCKET_URL } from './api';
import SeatGrid from './components/SeatGrid';
import Toast from './components/Toast';
import './App.css';

const USER_ID = 1; // demo user — in a real app this comes from auth/login

export default function App() {
  const [movies, setMovies] = useState([]);
  const [selectedShow, setSelectedShow] = useState(null);
  const [seats, setSeats] = useState([]);
  const [selectedSeatIds, setSelectedSeatIds] = useState([]);
  const [lockedByMe, setLockedByMe] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastBooking, setLastBooking] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
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

  useEffect(() => {
    api.getMovies().then((res) => setMovies(res.data)).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    api.getRecommendations(USER_ID).then((res) => setRecommendations(res.data)).catch(() => {});
  }, [lastBooking]);

  const openShow = async (show, movieTitle) => {
    setError('');
    setSelectedShow({ ...show, movie_title: movieTitle });
    setSelectedSeatIds([]);
    setLockedByMe([]);
    setLastBooking(null);
    try {
      const res = await api.getSeats(show.show_id);
      setSeats(res.data);
    } catch (e) {
      setError(e.message);
    }
  };

  const toggleSeat = (seatId) => {
    setSelectedSeatIds((prev) =>
      prev.includes(seatId) ? prev.filter((id) => id !== seatId) : [...prev, seatId]
    );
  };

  const handleLock = async () => {
    if (!selectedSeatIds.length) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.lockSeats(selectedShow.show_id, USER_ID, selectedSeatIds);
      setLockedByMe(res.seatIds);
      pushToast('Seats Locked 🔒', `You have ${res.ttlSeconds}s to confirm your booking`, 'info');
    } catch (e) {
      setError(e.message);
      pushToast('Lock Failed', e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleBook = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.bookTickets(USER_ID, selectedShow.show_id, lockedByMe);
      setLastBooking(res.data);
      setSelectedSeatIds([]);
      setLockedByMe([]);
      const seatRes = await api.getSeats(selectedShow.show_id);
      setSeats(seatRes.data);
    } catch (e) {
      setError(e.message);
      pushToast('Booking Failed', e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (bookingId) => {
    setLoading(true);
    try {
      await api.cancelBooking(bookingId);
      setLastBooking(null);
      if (selectedShow) {
        const seatRes = await api.getSeats(selectedShow.show_id);
        setSeats(seatRes.data);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <Toast toasts={toasts} />
      <header className="header">
        <h1>🎬 Movie Ticket Booking</h1>
        <span className="user-badge">User #{USER_ID}</span>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <div className="layout">
        <section className="panel">
          <h2>Movies & Shows</h2>
          {movies.map((m) => (
            <div key={m.movie_id} className="movie-card">
              <h3>{m.title}</h3>
              <p className="meta">{m.genre} · {m.language} · ⭐ {m.rating}</p>
              <div className="shows-list">
                {m.shows.map((s) => (
                  <button
                    key={s.show_id}
                    className={`show-chip ${selectedShow?.show_id === s.show_id ? 'active' : ''}`}
                    onClick={() => openShow(s, m.title)}
                  >
                    {s.screen_name} · {new Date(s.show_time).toLocaleString()} · ₹{s.price}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section className="panel">
          <h2>Select Seats</h2>
          {!selectedShow && <p className="hint">Pick a show to see seats</p>}
          {selectedShow && (
            <>
              <p className="hint">{selectedShow.movie_title} — {selectedShow.screen_name}</p>
              <SeatGrid
                seats={seats}
                selectedSeatIds={selectedSeatIds}
                onToggleSeat={toggleSeat}
                lockedByMe={lockedByMe}
              />
              <div className="legend">
                <span><i className="dot available" /> Available</span>
                <span><i className="dot selected" /> Selected</span>
                <span><i className="dot locked-mine" /> Locked by you</span>
                <span><i className="dot booked" /> Booked</span>
              </div>

              {!lockedByMe.length && (
                <button className="btn primary" disabled={!selectedSeatIds.length || loading} onClick={handleLock}>
                  Lock {selectedSeatIds.length || ''} Seat(s)
                </button>
              )}

              {lockedByMe.length > 0 && !lastBooking && (
                <button className="btn success" disabled={loading} onClick={handleBook}>
                  Confirm Booking ({lockedByMe.length} seats · ₹{lockedByMe.length * selectedShow.price})
                </button>
              )}

              {lastBooking && (
                <div className="booking-confirmation">
                  <p>✅ Booking #{lastBooking.booking_id} confirmed — ₹{lastBooking.total_amount}</p>
                  <button className="btn danger" onClick={() => handleCancel(lastBooking.booking_id)}>
                    Cancel This Booking
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        <section className="panel">
          <h2>Recommended For You</h2>
          {!recommendations.length && <p className="hint">No recommendations yet</p>}
          {recommendations.map((r) => (
            <div key={r.movie_id} className="rec-card">
              <strong>{r.title}</strong>
              <p className="meta">{r.genre} · ⭐ {r.rating} · score {r.score}</p>
              <p className="reason">{r.reason}</p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}