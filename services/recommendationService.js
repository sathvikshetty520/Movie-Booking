const BookingModel = require('../models/bookingModel');
const logger = require('../utils/logger');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

/**
 * AI Movie Recommendation (Groq-powered)
 *
 * Input: user_id
 * Logic:
 *   1. Pull booking trends from the database (genre affinity for this user +
 *      global popularity/seats-booked per movie).
 *   2. Send that trend data to the Groq API as context, and ask the model to
 *      rank / recommend movies with short natural-language reasons.
 *   3. Parse the model's JSON response and return it.
 *   4. If the Groq API key is missing or the call fails for any reason,
 *      fall back to a local trend-based ranking so the endpoint never breaks.
 */
async function recommendMoviesForUser(userId, topN = 5) {
  const [userGenreCounts, trends] = await Promise.all([
    BookingModel.getBookingCountsByMovieForUser(userId),
    BookingModel.getGlobalBookingTrends(),
  ]);

  if (!trends.length) {
    return [];
  }

  if (!process.env.GROQ_API_KEY) {
    logger.warn('GROQ_API_KEY not set — falling back to local trend-based recommendations');
    return localFallback(userGenreCounts, trends, topN);
  }

  try {
    return await getGroqRecommendations(userId, userGenreCounts, trends, topN);
  } catch (err) {
    logger.error(`Groq API call failed, using local fallback: ${err.message}`);
    return localFallback(userGenreCounts, trends, topN);
  }
}

async function getGroqRecommendations(userId, userGenreCounts, trends, topN) {
  const prompt = buildPrompt(userId, userGenreCounts, trends, topN);

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You are a movie recommendation engine for a ticket booking app. ' +
            'You must respond with ONLY valid JSON — no markdown, no code fences, no preamble.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.4,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq API returned ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content || '';
  const cleaned = raw.replace(/```json|```/g, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`Could not parse Groq response as JSON: ${cleaned.slice(0, 200)}`);
  }

  const recommendations = Array.isArray(parsed) ? parsed : parsed.recommendations;
  if (!Array.isArray(recommendations)) {
    throw new Error('Groq response did not contain a recommendations array');
  }

  return recommendations.slice(0, topN);
}

function buildPrompt(userId, userGenreCounts, trends, topN) {
  const userHistory = userGenreCounts.length
    ? userGenreCounts.map((g) => `${g.genre}: ${g.cnt} booking(s)`).join(', ')
    : 'no booking history (new user)';

  const trendLines = trends
    .map((t) => `- movie_id ${t.movie_id}: "${t.title}" (genre: ${t.genre}, rating: ${t.rating}, seats booked: ${t.seats_booked})`)
    .join('\n');

  return `User ${userId}'s booking history by genre: ${userHistory}

Current booking trends across all movies:
${trendLines}

Recommend the top ${topN} movies for this user. Prioritize genres the user has booked before,
then fall back to overall popularity (seats booked) and rating for ties or if the user has no history.

Respond with ONLY a JSON array (no other text), where each item has exactly these fields:
[
  { "movie_id": number, "title": string, "genre": string, "rating": number, "score": number (0-1), "reason": string (one short sentence) }
]`;
}

/**
 * Local fallback: same hybrid scoring approach used when Grok is unavailable,
 * so the API contract (response shape) stays identical either way.
 */
function localFallback(userGenreCounts, trends, topN) {
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