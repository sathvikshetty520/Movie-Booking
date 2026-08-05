import { useEffect, useState } from 'react';
import { api } from '../api';
import MovieCard from '../components/MovieCard';

export default function HomePage() {
  const [movies, setMovies] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getMovies()
      .then((res) => setMovies(res.data.filter((m) => m.is_now_showing !== false)))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <section className="hero">
        <h1>Now Showing in Your City</h1>
        <p>Book tickets for the latest movies — pick your seats in real time.</p>
      </section>

      {error && <div className="error-banner">{error}</div>}
      {loading && <p className="hint">Loading movies…</p>}

      <div className="poster-grid">
        {movies.map((m) => (
          <MovieCard key={m.movie_id} movie={m} />
        ))}
      </div>
    </div>
  );
}