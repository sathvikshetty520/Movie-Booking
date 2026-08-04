const pool = require('../config/db');

const BookingModel = {
  async createBooking({ userId, showId, seatIds, totalAmount }, client) {
    const db = client || pool;
    const { rows } = await db.query(
      `INSERT INTO bookings (user_id, show_id, seat_ids, total_amount, status)
       VALUES ($1, $2, $3, $4, 'CONFIRMED')
       RETURNING booking_id, user_id, show_id, seat_ids, total_amount, status, created_at`,
      [userId, showId, seatIds, totalAmount]
    );
    return rows[0];
  },

  async getBookingById(bookingId) {
    const { rows } = await pool.query(`SELECT * FROM bookings WHERE booking_id = $1`, [bookingId]);
    return rows[0];
  },

  async cancelBooking(bookingId, client) {
    const db = client || pool;
    const { rows } = await db.query(
      `UPDATE bookings SET status = 'CANCELLED'
       WHERE booking_id = $1 AND status = 'CONFIRMED'
       RETURNING booking_id, seat_ids, show_id, user_id`,
      [bookingId]
    );
    return rows[0];
  },

  async getBookingCountsByMovieForUser(userId) {
    // Used as a simple signal for AI recommendations: genres/movies the user has booked before
    const { rows } = await pool.query(
      `SELECT mv.genre, COUNT(*) as cnt
       FROM bookings b
       JOIN shows s ON s.show_id = b.show_id
       JOIN movies mv ON mv.movie_id = s.movie_id
       WHERE b.user_id = $1 AND b.status = 'CONFIRMED'
       GROUP BY mv.genre`,
      [userId]
    );
    return rows;
  },

  async getGlobalBookingTrends() {
    // Popularity ranking across all users - used as fallback / trend signal
    const { rows } = await pool.query(
      `SELECT mv.movie_id, mv.title, mv.genre, mv.rating,
              COALESCE(SUM(array_length(b.seat_ids, 1)), 0) AS seats_booked
       FROM movies mv
       LEFT JOIN shows s ON s.movie_id = mv.movie_id
       LEFT JOIN bookings b ON b.show_id = s.show_id AND b.status = 'CONFIRMED'
       GROUP BY mv.movie_id
       ORDER BY seats_booked DESC, mv.rating DESC`
    );
    return rows;
  },
  async getBookingsByUser(userId) {
    const { rows } = await pool.query(
      `SELECT b.booking_id, b.show_id, b.seat_ids, b.total_amount, b.status, b.created_at,
              m.title AS movie_title, m.poster_url, s.show_time, s.screen_name,
              t.name AS theatre_name, t.city
       FROM bookings b
       JOIN shows s ON s.show_id = b.show_id
       JOIN movies m ON m.movie_id = s.movie_id
       JOIN theatres t ON t.theatre_id = s.theatre_id
       WHERE b.user_id = $1
       ORDER BY b.created_at DESC`,
      [userId]
    );
    return rows;
  },
};

module.exports = BookingModel;
