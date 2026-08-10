const bcrypt = require('bcrypt');
const UserModel = require('../models/userModel');
const { signToken } = require('../utils/jwt');
const AppError = require('../utils/AppError');
const asyncHandler = require('../middleware/asyncHandler');
const logger = require('../utils/logger');

const SALT_ROUNDS = 10;

// POST /api/auth/register
// Body: { name, email, password }
const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    throw new AppError('name, email and password are required', 400);
  }
  if (password.length < 6) {
    throw new AppError('Password must be at least 6 characters', 400);
  }

  const existing = await UserModel.findByEmail(email);
  if (existing) {
    throw new AppError('An account with this email already exists', 409);
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await UserModel.createUser({ name, email, passwordHash });

  const token = signToken({ userId: user.user_id, email: user.email });

  logger.info(`New user registered: ${user.email} (id ${user.user_id})`);

  res.status(201).json({
    success: true,
    message: 'Account created',
    token,
    user: { user_id: user.user_id, name: user.name, email: user.email },
  });
});

// POST /api/auth/login
// Body: { email, password }
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new AppError('email and password are required', 400);
  }

  const user = await UserModel.findByEmail(email);
  if (!user) {
    throw new AppError('Invalid email or password', 401);
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw new AppError('Invalid email or password', 401);
  }

  const token = signToken({ userId: user.user_id, email: user.email });

  logger.info(`User logged in: ${user.email} (id ${user.user_id})`);

  res.status(200).json({
    success: true,
    message: 'Login successful',
    token,
    user: { user_id: user.user_id, name: user.name, email: user.email },
  });
});

// GET /api/auth/me  (verify token + get current user info)
const getMe = asyncHandler(async (req, res) => {
  const user = await UserModel.findById(req.user.userId);
  if (!user) throw new AppError('User not found', 404);
  res.status(200).json({ success: true, user });
});

module.exports = { register, login, getMe };