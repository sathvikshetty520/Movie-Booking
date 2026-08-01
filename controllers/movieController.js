const MovieModel = require('../models/movieModel');
const { getOrSetCache } = require('../services/cacheService');
const asyncHandler = require('../middleware/asyncHandler');
const logger = require('../utils/logger');

// GET /api/movies
// Fetches movies + shows, cached in Redis for 5 minutes
const getMoviesAndShows = asyncHandler(async (req, res) => {
  const cacheKey = 'movies:with_shows';

  const data = await getOrSetCache(cacheKey, () => MovieModel.getAllMoviesWithShows(), 300);

  logger.info(`Fetched ${data.length} movies (with shows)`);
  res.status(200).json({ success: true, count: data.length, data });
});

module.exports = { getMoviesAndShows };
