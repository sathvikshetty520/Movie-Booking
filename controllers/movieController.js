const MovieModel = require('../models/movieModel');
const { getOrSetCache } = require('../services/cacheService');
const asyncHandler = require('../middleware/asyncHandler');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

const getMoviesAndShows = asyncHandler(async (req, res) => {
  const cacheKey = 'movies:with_shows';
  const data = await getOrSetCache(cacheKey, () => MovieModel.getAllMoviesWithShows(), 300);
  logger.info(`Fetched ${data.length} movies (with shows)`);
  res.status(200).json({ success: true, count: data.length, data });
});

const getMovieById = asyncHandler(async (req, res) => {
  const movieId = parseInt(req.params.movie_id, 10);
  if (!movieId) throw new AppError('Valid movie_id is required', 400);

  const cacheKey = `movie:${movieId}`;
  const data = await getOrSetCache(cacheKey, () => MovieModel.getMovieById(movieId), 120);

  if (!data) throw new AppError('Movie not found', 404);
  res.status(200).json({ success: true, data });
});

const getAllShows = asyncHandler(async (req, res) => {
  const cacheKey = 'shows:all';
  const data = await getOrSetCache(cacheKey, () => MovieModel.getAllShowsWithMovieInfo(), 60);
  res.status(200).json({ success: true, count: data.length, data });
});

module.exports = { getMoviesAndShows, getMovieById, getAllShows };