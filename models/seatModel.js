const pool = require('../config/db');

const SeatModel = {
  async getSeatsByShow(showId) {
  const { rows } = await pool.query(
    `SELECT seat_id, show_id, seat_number, status
     FROM seats WHERE show_id = $1 ORDER BY seat_number`,
    [showId]
  );
  return rows;
},

  async getSeatsByIds(seatIds) {
    const { rows } = await pool.query(
      `SELECT seat_id, show_id, seat_number, status FROM seats WHERE seat_id = ANY($1::int[])`,
      [seatIds]
    );
    return rows;
  },

  // Marks seats BOOKED only if they are currently AVAILABLE (atomic guard against double booking)
  async markSeatsBooked(seatIds, client) {
    const db = client || pool;
    const { rows } = await db.query(
      `UPDATE seats SET status = 'BOOKED'
       WHERE seat_id = ANY($1::int[]) AND status = 'AVAILABLE'
       RETURNING seat_id`,
      [seatIds]
    );
    return rows.map((r) => r.seat_id); // seats actually updated
  },

  async markSeatsAvailable(seatIds, client) {
    const db = client || pool;
    await db.query(
      `UPDATE seats SET status = 'AVAILABLE' WHERE seat_id = ANY($1::int[])`,
      [seatIds]
    );
  },
};

module.exports = SeatModel;
