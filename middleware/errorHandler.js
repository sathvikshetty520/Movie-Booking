const logger = require('../utils/logger');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const message = err.isOperational ? err.message : 'Internal server error';

  logger.error(`${req.method} ${req.originalUrl} -> ${statusCode}: ${err.message}`);

  res.status(statusCode).json({
    success: false,
    error: message,
  });
}

module.exports = errorHandler;
