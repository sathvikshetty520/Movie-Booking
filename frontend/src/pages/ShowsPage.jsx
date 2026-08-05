import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function ShowsPage() {
  const [shows, setShows] = useState([]);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.getAllShows().then((res) => setShows(res.data)).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="page">
      <h1 className="page-title">All Shows</h1>
      {error && <div className="error-banner">{error}</div>}

      <div className="shows-table">
        {shows.map((s) => (
          <div key={s.show_id} className="show-row" onClick={() => navigate(`/book/${s.show_id}`)}>
            <div className="show-row-main">
              <strong>{s.title}</strong>
              <span className="meta">{s.genre} · ⭐ {s.rating}</span>
            </div>
            <div className="show-row-details">
              <span>{s.theatre_name}, {s.city}</span>
              <span>{s.screen_name}</span>
              <span>{new Date(s.show_time).toLocaleString()}</span>
              <span className="price">₹{s.price}</span>
            </div>
          </div>
        ))}
      </div>
      {!shows.length && !error && <p className="hint">No shows scheduled.</p>}
    </div>
  );
}