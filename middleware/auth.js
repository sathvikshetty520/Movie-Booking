const { verifyToken } = require('../utils/jwt');
const AppError = require('../utils/AppError');

/**
 * Verifies the Bearer token on protected routes and attaches the decoded
 * user info to req.user. Downstream controllers read req.user.userId instead
 * of trusting a user_id passed in the request body — this is what actually
 * proves the caller is who they claim to be.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new AppError('Authentication required. Missing or invalid Authorization header.', 401));
  }

  const token = header.split(' ')[1];
  try {
    const decoded = verifyToken(token);
    req.user = { userId: decoded.userId, email: decoded.email };
    next();
  } catch (err) {
    next(new AppError('Invalid or expired token. Please log in again.', 401));
  }
}

module.exports = { requireAuth };