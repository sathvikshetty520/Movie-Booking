import { Link } from 'react-router-dom';

const FALLBACK_POSTER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450"><rect width="100%" height="100%" fill="#2a2636"/><text x="50%" y="50%" fill="#a89fb3" font-size="16" text-anchor="middle" dy=".3em">No Poster</text></svg>`
  );

export default function MovieCard({ movie }) {
  return (
    <Link to={`/movies/${movie.movie_id}`} className="movie-poster-card">
      <div className="poster-wrap">
        <img
          src={movie.poster_url || FALLBACK_POSTER}
          alt={movie.title}
          loading="lazy"
          onError={(e) => { e.currentTarget.src = FALLBACK_POSTER; }}
        />
        <span className="rating-badge">⭐ {movie.rating}</span>
      </div>
      <h3>{movie.title}</h3>
      <p className="meta">{movie.genre} · {movie.language}</p>
    </Link>
  );
}