import { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';

export default function AdminPage() {
  const { socket } = useApp();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [liveFeed, setLiveFeed] = useState([]);

  const load = () => {
    api.getAdminStats()
      .then((res) => setStats(res.data))
      .catch((e) => setError(e.message));
  };

  useEffect(() => { load(); }, []);

  // Live bookings feed — pushes a new entry the instant ANY booking happens, anywhere
  useEffect(() => {
    if (!socket) return;
    const handleFeed = (payload) => {
      setLiveFeed((prev) => [{ ...payload, receivedAt: new Date() }, ...prev].slice(0, 10));
    };
    socket.on('bookings:feed', handleFeed);
    return () => socket.off('bookings:feed', handleFeed);
  }, [socket]);

  if (error) return <div className="page"><div className="error-banner">{error}</div></div>;
  if (!stats) return <div className="page"><p className="hint">Loading dashboard…</p></div>;

  const { overview, revenueByMovie, occupancy, recentBookings } = stats;

  return (
    <div className="page">
      <h1 className="page-title">Admin Dashboard</h1>

      <div className="stat-cards">
        <div className="stat-card">
          <span className="stat-value">{overview.total_bookings}</span>
          <span className="stat-label">Confirmed Bookings</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">₹{Number(overview.total_revenue).toLocaleString()}</span>
          <span className="stat-label">Total Revenue</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{overview.total_cancellations}</span>
          <span className="stat-label">Cancellations</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{overview.total_users}</span>
          <span className="stat-label">Registered Users</span>
        </div>
      </div>

      {liveFeed.length > 0 && (
        <>
          <h2 className="section-heading">🔴 Live Feed</h2>
          <div className="live-feed">
            {liveFeed.map((item, i) => (
              <div key={i} className="live-feed-item">
                Booking #{item.booking_id} — {item.seat_ids?.length || ''} seat(s) —{' '}
                {item.receivedAt.toLocaleTimeString()}
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="section-heading">Revenue by Movie</h2>
      <div className="admin-table">
        {revenueByMovie.map((m) => (
          <div key={m.movie_id} className="admin-table-row">
            <span>{m.title}</span>
            <span className="meta">{m.genre}</span>
            <span>{m.booking_count} bookings</span>
            <span className="price">₹{Number(m.revenue).toLocaleString()}</span>
          </div>
        ))}
      </div>

      <h2 className="section-heading">Seat Occupancy by Show</h2>
      <div className="admin-table">
        {occupancy.map((s) => {
          const pct = s.total_seats > 0 ? Math.round((s.booked_seats / s.total_seats) * 100) : 0;
          return (
            <div key={s.show_id} className="admin-table-row">
              <span>{s.title}</span>
              <span className="meta">{s.theatre_name} · {s.screen_name}</span>
              <span>{new Date(s.show_time).toLocaleString()}</span>
              <div className="occupancy-bar-wrap">
                <div className="occupancy-bar" style={{ width: `${pct}%` }} />
                <span className="occupancy-label">{s.booked_seats}/{s.total_seats} ({pct}%)</span>
              </div>
            </div>
          );
        })}
      </div>

      <h2 className="section-heading">Recent Bookings</h2>
      <div className="admin-table">
        {recentBookings.map((b) => (
          <div key={b.booking_id} className="admin-table-row">
            <span>#{b.booking_id}</span>
            <span>{b.user_name}</span>
            <span>{b.movie_title}</span>
            <span className={`status-badge ${b.status.toLowerCase()}`}>{b.status}</span>
            <span className="price">₹{b.total_amount}</span>
          </div>
        ))}
      </div>
    </div>
  );
}