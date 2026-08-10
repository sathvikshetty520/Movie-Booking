// const { recommendMoviesForUser } = require('../services/recommendationService');
// const AppError = require('../utils/AppError');
// const asyncHandler = require('../middleware/asyncHandler');

// // GET /api/recommendations/:user_id
// const getRecommendations = asyncHandler(async (req, res) => {
//   const userId = parseInt(req.params.user_id, 10);
//   if (!userId) throw new AppError('Valid user_id is required', 400);

//   const recommendations = await recommendMoviesForUser(userId, 5);

//   res.status(200).json({ success: true, user_id: userId, data: recommendations });
// });

// module.exports = { getRecommendations };

const { recommendMoviesForUser } = require('../services/recommendationService');
const asyncHandler = require('../middleware/asyncHandler');

// GET /api/recommendations/me (protected)
const getRecommendations = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const recommendations = await recommendMoviesForUser(userId, 5);
  res.status(200).json({ success: true, user_id: userId, data: recommendations });
});

module.exports = { getRecommendations };
