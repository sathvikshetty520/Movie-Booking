// Wraps async controller functions so thrown errors are forwarded to errorHandler
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
