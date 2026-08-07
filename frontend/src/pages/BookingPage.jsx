import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useApp } from '../AppContext';
import SeatGrid from '../components/SeatGrid';

export default function BookingPage() {
  const { showId } = useParams();
  const navigate = useNavigate();
  const { userId, pushToast } = useApp();

  const [seats, setSeats] = useState([]);
  const [showInfo, setShowInfo] = useState(null);
  const [selectedSeatIds, setSelectedSeatIds] = useState([]);
  const [lockedByMe, setLockedByMe] = useState([]);
  const [quote, setQuote] = useState(null); // { breakdown, total_amount }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastBooking, setLastBooking] = useState(null);

  useEffect(() => {
    loadSeats();
    api.getAllShows().then((res) => {
      const found = res.data.find((s) => String(s.show_id) === String(showId));
      if (found) setShowInfo(found);
    }).catch(() => {});
  }, [showId]);

  // fetch a live price breakdown whenever the selection changes (pre-lock preview)
  useEffect(() => {
    if (!selectedSeatIds.length || lockedByMe.length) {
      if (!selectedSeatIds.length) setQuote(null);
      return;
    }
    api.getPriceQuote(showId, selectedSeatIds)
      .then((res) => setQuote(res))
      .catch(() => setQuote(null));
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
      const res = await api.lockSeats(showId, userId, selectedSeatIds);
      setLockedByMe(res.seatIds);
      // refresh quote against the confirmed locked set
      const q = await api.getPriceQuote(showId, res.seatIds);
      setQuote(q);
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
      const res = await api.bookTickets(userId, showId, lockedByMe);
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
    <span>
      {item.seat_number}{" "}
      <em>
        ({typeof item.seat_type === "string"
          ? item.seat_type.charAt(0).toUpperCase() + item.seat_type.slice(1).toLowerCase()
          : "Unknown"})
      </em>
    </span>
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