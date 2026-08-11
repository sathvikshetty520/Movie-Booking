const pool = require('../config/db');

const AdminModel = {
  async getOverviewStats() {
    const { rows } = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM bookings WHERE status = 'CONFIRMED') AS total_bookings,
        (SELECT COUNT(*) FROM bookings WHERE status = 'CANCELLED') AS total_cancellations,
        (SELECT COALESCE(SUM(total_amount), 0) FROM bookings WHERE status = 'CONFIRMED') AS total_revenue,
        (SELECT COUNT(*) FROM users) AS total_users,
        (SELECT COUNT(*) FROM movies) AS total_movies,
        (SELECT COUNT(*) FROM shows) AS total_shows
    `);
    return rows[0];
  },

  async getRevenueByMovie() {
    const { rows } = await pool.query(`
      SELECT m.movie_id, m.title, m.genre,
             COALESCE(SUM(b.total_amount), 0) AS revenue,
             COUNT(b.booking_id) AS booking_count
      FROM movies m
      LEFT JOIN shows s ON s.movie_id = m.movie_id
      LEFT JOIN bookings b ON b.show_id = s.show_id AND b.status = 'CONFIRMED'
      GROUP BY m.movie_id
      ORDER BY revenue DESC
    `);
    return rows;
  },

  async getSeatOccupancyByShow() {
    const { rows } = await pool.query(`
      SELECT s.show_id, m.title, s.show_time, s.screen_name, t.name AS theatre_name,
             COUNT(seat.seat_id) AS total_seats,
             COUNT(seat.seat_id) FILTER (WHERE seat.status = 'BOOKED') AS booked_seats
      FROM shows s
      JOIN movies m ON m.movie_id = s.movie_id
      JOIN theatres t ON t.theatre_id = s.theatre_id
      LEFT JOIN seats seat ON seat.show_id = s.show_id
      GROUP BY s.show_id, m.title, s.show_time, s.screen_name, t.name
      ORDER BY s.show_time
    `);
    return rows;
  },

  async getRecentBookings(limit = 20) {
    const { rows } = await pool.query(
      `SELECT b.booking_id, b.total_amount, b.status, b.created_at,
              u.name AS user_name, m.title AS movie_title
       FROM bookings b
       JOIN users u ON u.user_id = b.user_id
       JOIN shows s ON s.show_id = b.show_id
       JOIN movies m ON m.movie_id = s.movie_id
       ORDER BY b.created_at DESC
       LIMIT $1`,
      [limit]
    );
    return rows;
  },
};

module.exports = AdminModel;