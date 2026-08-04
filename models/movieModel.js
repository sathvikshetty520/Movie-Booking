const pool = require('../config/db');

const MovieModel = {
  async getAllMoviesWithShows() {
    const query = `
      SELECT m.movie_id, m.title, m.genre, m.language, m.duration_mins, m.rating,
             m.poster_url, m.is_now_showing,
             json_agg(
               json_build_object(
                 'show_id', s.show_id,
                 'theatre_id', s.theatre_id,
                 'theatre_name', t.name,
                 'city', t.city,
                 'screen_name', s.screen_name,
                 'show_time', s.show_time,
                 'price', s.price,
                 'total_seats', s.total_seats
               ) ORDER BY s.show_time
             ) AS shows
      FROM movies m
      JOIN shows s ON s.movie_id = m.movie_id
      JOIN theatres t ON t.theatre_id = s.theatre_id
      GROUP BY m.movie_id
      ORDER BY m.title;
    `;
    const { rows } = await pool.query(query);
    return rows;
  },

  async getMovieById(movieId) {
    const query = `
      SELECT m.movie_id, m.title, m.genre, m.language, m.duration_mins, m.rating,
             m.poster_url, m.is_now_showing,
             json_agg(
               json_build_object(
                 'show_id', s.show_id,
                 'theatre_id', s.theatre_id,
                 'theatre_name', t.name,
                 'city', t.city,
                 'screen_name', s.screen_name,
                 'show_time', s.show_time,
                 'price', s.price,
                 'total_seats', s.total_seats
               ) ORDER BY s.show_time
             ) AS shows
      FROM movies m
      LEFT JOIN shows s ON s.movie_id = m.movie_id
      LEFT JOIN theatres t ON t.theatre_id = s.theatre_id
      WHERE m.movie_id = $1
      GROUP BY m.movie_id;
    `;
    const { rows } = await pool.query(query, [movieId]);
    return rows[0];
  },

  async getAllShowsWithMovieInfo() {
    const query = `
      SELECT s.show_id, s.show_time, s.price, s.total_seats, s.screen_name,
             t.name AS theatre_name, t.city,
             m.movie_id, m.title, m.genre, m.poster_url, m.rating
      FROM shows s
      JOIN movies m ON m.movie_id = s.movie_id
      JOIN theatres t ON t.theatre_id = s.theatre_id
      ORDER BY s.show_time;
    `;
    const { rows } = await pool.query(query);
    return rows;
  },
};

module.exports = MovieModel;