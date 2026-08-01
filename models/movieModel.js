const pool = require('../config/db');

const MovieModel = {
  async getAllMoviesWithShows() {
    const query = `
      SELECT m.movie_id, m.title, m.genre, m.language, m.duration_mins, m.rating,
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
};

module.exports = MovieModel;
