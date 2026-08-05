import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';

const FALLBACK_POSTER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450"><rect width="100%" height="100%" fill="#2a2636"/><text x="50%" y="50%" fill="#a89fb3" font-size="16" text-anchor="middle" dy=".3em">No Poster</text></svg>`
  );

export default function MovieDetailPage() {
  const { movieId } = useParams();
  const navigate = useNavigate();
  const [movie, setMovie] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .getMovieById(movieId)
      .then((res) => setMovie(res.data))
      .catch((e) => setError(e.message));
  }, [movieId]);

  if (error) return <div className="page"><div className="error-banner">{error}</div></div>;
  if (!movie) return <div className="page"><p className="hint">Loading…</p></div>;

  const showsByTheatre = {};
  (movie.shows || []).forEach((s) => {
    if (!s.show_id) return;
    const key = `${s.theatre_name} (${s.city})`;
    if (!showsByTheatre[key]) showsByTheatre[key] = [];
    showsByTheatre[key].push(s);
  });

  return (
    <div className="page">
      <div className="movie-detail">
        <img
          src={movie.poster_url || FALLBACK_POSTER}
          alt={movie.title}
          className="detail-poster"
          onError={(e) => { e.currentTarget.src = FALLBACK_POSTER; }}
        />
        <div className="detail-info">
          <h1>{movie.title}</h1>
          <p className="meta-line">
            {movie.genre} · {movie.language} · {movie.duration_mins} min · ⭐ {movie.rating}
          </p>

          <h2 className="section-heading">Showtimes</h2>
          {!Object.keys(showsByTheatre).length && <p className="hint">No shows scheduled currently.</p>}

          {Object.entries(showsByTheatre).map(([theatre, shows]) => (
            <div key={theatre} className="theatre-block">
              <h3>{theatre}</h3>
              <div className="shows-list">
                {shows.map((s) => (
                  <button
                    key={s.show_id}
                    className="show-chip"
                    onClick={() => navigate(`/book/${s.show_id}`)}
                  >
                    {s.screen_name} · {new Date(s.show_time).toLocaleString()} · ₹{s.price}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}