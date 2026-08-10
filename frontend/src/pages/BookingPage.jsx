import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useApp } from '../AppContext';
import SeatGrid from '../components/SeatGrid';

export default function BookingPage() {
  const { showId } = useParams();
  const navigate = useNavigate();
  const { user, pushToast, socket } = useApp();

  const [seats, setSeats] = useState([]);
  const [showInfo, setShowInfo] = useState(null);
  const [selectedSeatIds, setSelectedSeatIds] = useState([]);
  const [lockedByMe, setLockedByMe] = useState([]);
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastBooking, setLastBooking] = useState(null);
  const [viewerNotice, setViewerNotice] = useState('');

  useEffect(() => {
    loadSeats();
    api.getAllShows().then((res) => {
      const found = res.data.find((s) => String(s.show_id) === String(showId));
      if (found) setShowInfo(found);
    }).catch(() => {});
  }, [showId]);

  useEffect(() => {
    if (!socket) return;
    socket.emit('join_show', showId);

    const handleSeatUpdate = (payload) => {
      if (String(payload.show_id) !== String(showId)) return;
      if (payload.by_user_id === user.user_id) return;

      setSeats((prev) =>
        prev.map((seat) =>
          payload.seat_ids.includes(seat.seat_id)
            ? { ...seat, status: payload.status === 'BOOKED' ? 'BOOKED' : 'AVAILABLE' }
            : seat
        )
      );
      setSelectedSeatIds((prev) => prev.filter((id) => !payload.seat_ids.includes(id)));

      if (payload.status === 'LOCKED') setViewerNotice('Another user just selected a seat');
      else if (payload.status === 'BOOKED') setViewerNotice('A seat was just booked by another user');
      else setViewerNotice('A seat became available again');
      setTimeout(() => setViewerNotice(''), 3000);
    };

    socket.on('seat:update', handleSeatUpdate);
    return () => {
      socket.emit('leave_show', showId);
      socket.off('seat:update', handleSeatUpdate);
    };
  }, [socket, showId, user]);

  useEffect(() => {
    if (!selectedSeatIds.length || lockedByMe.length) {
      if (!selectedSeatIds.length) setQuote(null);
      return;
    }
    api.getPriceQuote(showId, selectedSeatIds).then(setQuote).catch(() => setQuote(null));
  }, [selectedSeatIds, showId, lockedByMe.length]);

  const loadSeats = async () => {
    try {
      const res = await api.getSeats(showId);
      setSeats(res.data);
    } catch (e) {
      setError(e.message);
    }
  };

  const toggleSeat = (seatId) => {
    if (lockedByMe.length) return;
    setSelectedSeatIds((prev) =>
      prev.includes(seatId) ? prev.filter((id) => id !== seatId) : [...prev, seatId]
    );
  };

  const handleLock = async () => {
    if (!selectedSeatIds.length) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.lockSeats(showId, selectedSeatIds);
      setLockedByMe(res.seatIds);
      const q = await api.getPriceQuote(showId, res.seatIds);
      setQuote(q);
      pushToast('Seats Locked 🔒', `You have ${res.ttlSeconds}s to confirm your booking`, 'info');
    } catch (e) {
      setError(e.message);
      pushToast('Lock Failed', e.message, 'error');
      loadSeats();
    } finally {
      setLoading(false);
    }
  };

  const handleBook = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.bookTickets(showId, lockedByMe);
      setLastBooking(res.data);
      setSelectedSeatIds([]);
      setLockedByMe([]);
      setQuote(null);
      loadSeats();
    } catch (e) {
      setError(e.message);
      pushToast('Booking Failed', e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <button className="back-link" onClick={() => navigate(-1)}>← Back</button>

      {showInfo && (
        <div className="booking-header">
          <h1>{showInfo.title}</h1>
          <p className="meta">
            {showInfo.theatre_name}, {showInfo.city} · {showInfo.screen_name} ·{' '}
            {new Date(showInfo.show_time).toLocaleString()}
          </p>
        </div>
      )}

      {error && <div className="error-banner">{error}</div>}
      {viewerNotice && <div className="live-notice">🔴 Live: {viewerNotice}</div>}

      <div className="panel booking-panel">
        <h2>Select Seats</h2>
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
          <span><i className="dot premium" /> Premium (×1.5)</span>
          <span><i className="dot recliner" /> Recliner (×2)</span>
          <span><i className="dot accessible" /> Accessible</span>
        </div>

        {quote && !lastBooking && (
          <div className="price-breakdown">
            <h3>Price Breakdown</h3>
            {quote.breakdown.map((item) => (
              <div key={item.seat_id} className="price-row">
                <span>{item.seat_number} <em>({item.seat_type.charAt(0) + item.seat_type.slice(1).toLowerCase()})</em></span>
                <span>₹{item.price}</span>
              </div>
            ))}
            <div className="price-row price-total">
              <span>Total</span>
              <span>₹{quote.total_amount}</span>
            </div>
          </div>
        )}

        {!lockedByMe.length && !lastBooking && (
          <button className="btn primary" disabled={!selectedSeatIds.length || loading} onClick={handleLock}>
            Lock {selectedSeatIds.length || ''} Seat(s)
          </button>
        )}

        {lockedByMe.length > 0 && !lastBooking && (
          <button className="btn success" disabled={loading} onClick={handleBook}>
            Confirm Booking (₹{quote?.total_amount ?? '...'})
          </button>
        )}

        {lastBooking && (
          <div className="booking-confirmation">
            <p>✅ Booking #{lastBooking.booking_id} confirmed — ₹{lastBooking.total_amount}</p>
            <button className="btn secondary" onClick={() => navigate('/my-bookings')}>
              View My Bookings
            </button>
          </div>
        )}
      </div>
    </div>
  );
}