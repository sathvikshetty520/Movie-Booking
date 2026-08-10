import { useEffect, useState } from 'react';
import { api } from '../api';

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.getMyBookings()
      .then((res) => setBookings(res.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCancel = async (bookingId) => {
    try {
      await api.cancelBooking(bookingId);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="page">
      <h1 className="page-title">My Bookings</h1>
      {error && <div className="error-banner">{error}</div>}
      {loading && <p className="hint">Loading…</p>}
      {!loading && !bookings.length && <p className="hint">No bookings yet — go book a show!</p>}

      <div className="bookings-list">
        {bookings.map((b) => (
          <div key={b.booking_id} className={`booking-card ${b.status === 'CANCELLED' ? 'cancelled' : ''}`}>
            <div className="booking-card-main">
              <strong>{b.movie_title}</strong>
              <span className={`status-badge ${b.status.toLowerCase()}`}>{b.status}</span>
            </div>
            <p className="meta">
              {b.theatre_name}, {b.city} · {b.screen_name} · {new Date(b.show_time).toLocaleString()}
            </p>
            <p className="meta">Seats: {b.seat_ids.length} · Total: ₹{b.total_amount}</p>
            <p className="meta booking-id">Booking #{b.booking_id} · Booked {new Date(b.created_at).toLocaleString()}</p>
            {b.status === 'CONFIRMED' && (
              <button className="btn danger" onClick={() => handleCancel(b.booking_id)}>
                Cancel Booking
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}