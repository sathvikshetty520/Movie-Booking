const SeatModel = require('../models/seatModel');
const { getOrSetCache, invalidate } = require('../services/cacheService');
const { lockSeats, releaseSeats } = require('../services/lockService');
const AppError = require('../utils/AppError');
const asyncHandler = require('../middleware/asyncHandler');
const logger = require('../utils/logger');

// GET /api/shows/:show_id/seats
const getAvailableSeats = asyncHandler(async (req, res) => {
  const showId = parseInt(req.params.show_id, 10);
  if (!showId || Number.isNaN(showId)) {
    throw new AppError('Valid show_id is required', 400);
  }

  const cacheKey = `seats:show:${showId}`;
  const seats = await getOrSetCache(cacheKey, () => SeatModel.getSeatsByShow(showId), 30);

  if (!seats.length) {
    throw new AppError('No seats found for this show', 404);
  }

  res.status(200).json({ success: true, show_id: showId, count: seats.length, data: seats });
});

// POST /api/shows/:show_id/lock-seats
// Body: { user_id, seat_ids: [1,2,3] }
const lockSeatsController = asyncHandler(async (req, res) => {
  const showId = parseInt(req.params.show_id, 10);
  const { user_id: userId, seat_ids: seatIds } = req.body;

  if (!showId) throw new AppError('Valid show_id is required', 400);
  if (!userId) throw new AppError('user_id is required', 400);
  if (!Array.isArray(seatIds) || seatIds.length === 0) {
    throw new AppError('seat_ids must be a non-empty array', 400);
  }

  // Verify seats exist and belong to this show and are AVAILABLE in DB
  const seatRows = await SeatModel.getSeatsByIds(seatIds);
  if (seatRows.length !== seatIds.length) {
    throw new AppError('One or more seat_ids are invalid', 400);
  }
  const invalidShow = seatRows.find((s) => s.show_id !== showId);
  if (invalidShow) throw new AppError('One or more seats do not belong to this show', 400);

  const alreadyBooked = seatRows.filter((s) => s.status === 'BOOKED');
  if (alreadyBooked.length > 0) {
    throw new AppError(
      `Seats already booked: ${alreadyBooked.map((s) => s.seat_number).join(', ')}`,
      409
    );
  }

  const result = await lockSeats(showId, seatIds, userId);
  logger.info(`User ${userId} locked seats [${seatIds}] for show ${showId}`);

  res.status(200).json({
    success: true,
    message: 'Seats locked successfully. Complete booking before lock expires.',
    ...result,
  });
});

// POST /api/shows/:show_id/unlock-seats  (optional helper endpoint)
const unlockSeatsController = asyncHandler(async (req, res) => {
  const showId = parseInt(req.params.show_id, 10);
  const { user_id: userId, seat_ids: seatIds } = req.body;

  if (!showId || !userId || !Array.isArray(seatIds)) {
    throw new AppError('show_id, user_id and seat_ids are required', 400);
  }

  await releaseSeats(showId, seatIds, userId);
  await invalidate(`seats:show:${showId}`);

  res.status(200).json({ success: true, message: 'Seats unlocked' });
});

module.exports = { getAvailableSeats, lockSeatsController, unlockSeatsController };
