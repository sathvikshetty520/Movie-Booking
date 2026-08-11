const { verifyToken } = require('../utils/jwt');
const AppError = require('../utils/AppError');

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new AppError('Authentication required. Missing or invalid Authorization header.', 401));
  }

  const token = header.split(' ')[1];
  try {
    const decoded = verifyToken(token);
    req.user = { userId: decoded.userId, email: decoded.email, isAdmin: decoded.isAdmin === true };
    next();
  } catch (err) {
    next(new AppError('Invalid or expired token. Please log in again.', 401));
  }
}

// Must be used AFTER requireAuth — checks the admin flag baked into the JWT
function requireAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) {
    return next(new AppError('Admin access required', 403));
  }
  next();
}

module.exports = { requireAuth, requireAdmin };