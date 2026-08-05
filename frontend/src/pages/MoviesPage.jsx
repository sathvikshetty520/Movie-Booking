import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import MovieCard from '../components/MovieCard';

export default function MoviesPage() {
  const [movies, setMovies] = useState([]);
  const [error, setError] = useState('');
  const [genreFilter, setGenreFilter] = useState('All');

  useEffect(() => {
    api.getMovies().then((res) => setMovies(res.data)).catch((e) => setError(e.message));
  }, []);

  const genres = useMemo(() => ['All', ...new Set(movies.map((m) => m.genre).filter(Boolean))], [movies]);
  const filtered = genreFilter === 'All' ? movies : movies.filter((m) => m.genre === genreFilter);

  return (
    <div className="page">
      <h1 className="page-title">All Movies</h1>
      {error && <div className="error-banner">{error}</div>}

      <div className="filter-chips">
        {genres.map((g) => (
          <button
            key={g}
            className={`filter-chip ${genreFilter === g ? 'active' : ''}`}
            onClick={() => setGenreFilter(g)}
          >
            {g}
          </button>
        ))}
      </div>

      <div className="poster-grid">
        {filtered.map((m) => (
          <MovieCard key={m.movie_id} movie={m} />
        ))}
      </div>
      {!filtered.length && <p className="hint">No movies in this genre.</p>}
    </div>
  );
}