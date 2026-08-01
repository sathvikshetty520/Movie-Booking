const BookingModel = require('../models/bookingModel');

/**
 * Lightweight AI-style recommendation engine.
 *
 * Approach (content-based + popularity hybrid):
 * 1. Look at the user's past bookings to infer preferred genres.
 * 2. Look at global booking trends (seats booked per movie) as a popularity signal.
 * 3. Score each movie = (genre affinity weight) + (normalized popularity) + (rating weight).
 * 4. Return top-N sorted recommendations.
 *
 * This simulates an AI recommendation without requiring an external ML service,
 * while being structured so a real model (e.g. a collaborative-filtering service
 * or an LLM-based ranker) could be swapped in behind the same interface.
 */
async function recommendMoviesForUser(userId, topN = 5) {
  const [userGenreCounts, trends] = await Promise.all([
    BookingModel.getBookingCountsByMovieForUser(userId),
    BookingModel.getGlobalBookingTrends(),
  ]);

  const genreAffinity = {};
  let totalUserBookings = 0;
  userGenreCounts.forEach((row) => {
    genreAffinity[row.genre] = parseInt(row.cnt, 10);
    totalUserBookings += parseInt(row.cnt, 10);
  });

  const maxSeatsBooked = Math.max(1, ...trends.map((t) => parseInt(t.seats_booked, 10)));

  const scored = trends.map((movie) => {
    const affinity = totalUserBookings > 0
      ? (genreAffinity[movie.genre] || 0) / totalUserBookings
      : 0;
    const popularity = parseInt(movie.seats_booked, 10) / maxSeatsBooked;
    const ratingScore = (parseFloat(movie.rating) || 0) / 5;

    // Weighted hybrid score: personalization matters most, then popularity, then rating
    const score = affinity * 0.5 + popularity * 0.35 + ratingScore * 0.15;

    return {
      movie_id: movie.movie_id,
      title: movie.title,
      genre: movie.genre,
      rating: movie.rating,
      score: Number(score.toFixed(4)),
      reason: totalUserBookings > 0
        ? `Based on your interest in ${Object.keys(genreAffinity).join(', ') || 'similar movies'} and current trends`
        : 'Trending now among all users',
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN);
}

module.exports = { recommendMoviesForUser };
