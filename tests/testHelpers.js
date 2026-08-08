const pool = require('../config/db');
const redis = require('../config/redis');

/**
 * Creates a fully isolated movie/theatre/show/seats fixture for a test run,
 * so tests never touch or depend on the demo seed data. Returns IDs needed
 * by the tests, plus a teardown() function to clean everything up.
 */
async function createTestFixture({ seatCount = 4, price = 100 } = {}) {
  const movieRes = await pool.query(
    `INSERT INTO movies (title, genre, language, duration_mins, rating)
     VALUES ($1, 'Test', 'English', 100, 5.0) RETURNING movie_id`,
    [`__TEST_MOVIE_${Date.now()}_${Math.random().toString(36).slice(2)}__`]
  );
  const movieId = movieRes.rows[0].movie_id;

  const theatreRes = await pool.query(
    `INSERT INTO theatres (name, city) VALUES ('__TEST_THEATRE__', 'TestCity') RETURNING theatre_id`
  );
  const theatreId = theatreRes.rows[0].theatre_id;

  const showRes = await pool.query(
    `INSERT INTO shows (movie_id, theatre_id, screen_name, show_time, price, total_seats)
     VALUES ($1, $2, 'Test Screen', NOW() + interval '1 day', $3, $4) RETURNING show_id`,
    [movieId, theatreId, price, seatCount]
  );
  const showId = showRes.rows[0].show_id;

  const seatIds = [];
  for (let i = 1; i <= seatCount; i += 1) {
    const seatRes = await pool.query(
      `INSERT INTO seats (show_id, seat_number, row_label, seat_type, status)
       VALUES ($1, $2, 'A', 'REGULAR', 'AVAILABLE') RETURNING seat_id`,
      [showId, `A${i}`]
    );
    seatIds.push(seatRes.rows[0].seat_id);
  }

  const userRes = await pool.query(
    `INSERT INTO users (name, email) VALUES ('Test User', $1) RETURNING user_id`,
    [`test_${Date.now()}_${Math.random().toString(36).slice(2)}@example.com`]
  );
  const userId = userRes.rows[0].user_id;

  const teardown = async () => {
    for (const seatId of seatIds) {
      await redis.del(`lock:show:${showId}:seat:${seatId}`);
    }
    await redis.del(`seats:show:${showId}`);
    await pool.query('DELETE FROM movies WHERE movie_id = $1', [movieId]);
    await pool.query('DELETE FROM theatres WHERE theatre_id = $1', [theatreId]);
    await pool.query('DELETE FROM users WHERE user_id = $1', [userId]);
  };

  return { movieId, theatreId, showId, seatIds, userId, price, teardown };
}

async function closeConnections() {
  await pool.end();
  redis.disconnect();
}

module.exports = { createTestFixture, closeConnections };