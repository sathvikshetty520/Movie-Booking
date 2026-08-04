require('dotenv').config();
const pool = require('../config/db');

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_SEARCH_URL = 'https://api.themoviedb.org/3/search/movie';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

async function fetchPosterForTitle(title) {
  const url = `${TMDB_SEARCH_URL}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB search failed for "${title}": ${res.status}`);

  const data = await res.json();
  const best = data.results?.[0];
  if (!best || !best.poster_path) {
    console.warn(`No poster found on TMDB for "${title}" — skipping`);
    return null;
  }

  return {
    poster_url: `${TMDB_IMAGE_BASE}${best.poster_path}`,
    tmdb_rating: best.vote_average,
  };
}

async function run() {
  if (!TMDB_API_KEY) {
    console.error('TMDB_API_KEY is not set in .env. Get a free key at https://www.themoviedb.org/settings/api');
    process.exit(1);
  }

  const { rows: movies } = await pool.query('SELECT movie_id, title FROM movies');
  console.log(`Fetching posters for ${movies.length} movies...`);

  for (const movie of movies) {
    try {
      const result = await fetchPosterForTitle(movie.title);
      if (result) {
        await pool.query(
          'UPDATE movies SET poster_url = $1, rating = $2 WHERE movie_id = $3',
          [result.poster_url, Number(result.tmdb_rating.toFixed(1)), movie.movie_id]
        );
        console.log(`✓ ${movie.title} -> ${result.poster_url}`);
      }
    } catch (err) {
      console.error(`✗ ${movie.title}: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  console.log('Done.');
  await pool.end();
}

run();