const pool = require('../config/db');
const SeatModel = require('../models/seatModel');
const BookingModel = require('../models/bookingModel');
const { validateLocks, releaseSeats } = require('../services/lockService');
const { invalidate } = require('../services/cacheService');
const { emitBookingConfirmed, emitBookingCancelled, emitSeatUpdate } = require('../services/eventService');
const { calculateTotal, priceForSeat } = require('../utils/pricing');
const AppError = require('../utils/AppError');
const asyncHandler = require('../middleware/asyncHandler');
const logger = require('../utils/logger');

// POST /api/bookings (protected)
// Body: { show_id, seat_ids: [1,2,3] }  -- user_id from JWT
const bookTickets = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { show_id: showId, seat_ids: seatIds } = req.body;

  if (!showId || !Array.isArray(seatIds) || seatIds.length === 0) {
    throw new AppError('show_id and non-empty seat_ids are required', 400);
  }

  await validateLocks(showId, seatIds, userId);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const bookedSeatIds = await SeatModel.markSeatsBooked(seatIds, client);

    if (bookedSeatIds.length !== seatIds.length) {
      await client.query('ROLLBACK');
      throw new AppError('One or more seats were already booked. Please pick different seats.', 409);
    }

    const priceRes = await client.query('SELECT price FROM shows WHERE show_id = $1', [showId]);
    if (!priceRes.rows.length) {
      await client.query('ROLLBACK');
      throw new AppError('Show not found', 404);
    }
    const basePrice = parseFloat(priceRes.rows[0].price);

    const seatDetails = await SeatModel.getSeatsByIds(seatIds);
    const totalAmount = calculateTotal(basePrice, seatDetails);

    const booking = await BookingModel.createBooking(
      { userId, showId, seatIds, totalAmount },
      client
    );

    await client.query('COMMIT');

    await releaseSeats(showId, seatIds, userId);
    await invalidate(`seats:show:${showId}`);

    emitBookingConfirmed(userId, booking);
    emitSeatUpdate(showId, seatIds, 'BOOKED', userId);

    logger.info(`Booking ${booking.booking_id} confirmed for user ${userId}, show ${showId}`);

    res.status(201).json({ success: true, message: 'Booking confirmed', data: booking });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
});

// PATCH /api/bookings/:booking_id/cancel (protected)
const cancelBooking = asyncHandler(async (req, res) => {
  const bookingId = parseInt(req.params.booking_id, 10);
  if (!bookingId) throw new AppError('Valid booking_id is required', 400);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const cancelled = await BookingModel.cancelBooking(bookingId, client);
    if (!cancelled) {
      await client.query('ROLLBACK');
      throw new AppError('Booking not found or already cancelled', 404);
    }

    // Ownership check: only the booking's own user can cancel it
    if (cancelled.user_id !== req.user.userId) {
      await client.query('ROLLBACK');
      throw new AppError('You do not have permission to cancel this booking', 403);
    }

    await SeatModel.markSeatsAvailable(cancelled.seat_ids, client);
    await client.query('COMMIT');

    await invalidate(`seats:show:${cancelled.show_id}`);

    emitBookingCancelled(cancelled.user_id, { booking_id: bookingId, show_id: cancelled.show_id });
    emitSeatUpdate(cancelled.show_id, cancelled.seat_ids, 'AVAILABLE', cancelled.user_id);

    logger.info(`Booking ${bookingId} cancelled`);
    res.status(200).json({ success: true, message: 'Booking cancelled', data: cancelled });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
});

// GET /api/bookings/:booking_id/confirmation (protected)
const getBookingConfirmation = asyncHandler(async (req, res) => {
  const bookingId = parseInt(req.params.booking_id, 10);
  const booking = await BookingModel.getBookingById(bookingId);

  if (!booking) throw new AppError('Booking not found', 404);
  if (booking.user_id !== req.user.userId) {
    throw new AppError('You do not have permission to view this booking', 403);
  }

  emitBookingConfirmed(booking.user_id, booking);

  res.status(200).json({ success: true, data: booking });
});

// GET /api/users/me/bookings (protected — always the logged-in user's own bookings)
const getMyBookings = asyncHandler(async (req, res) => {
  const bookings = await BookingModel.getBookingsByUser(req.user.userId);
  res.status(200).json({ success: true, count: bookings.length, data: bookings });
});

// POST /api/shows/:show_id/quote (public — no auth needed, it's just a price preview)
const getPriceQuote = asyncHandler(async (req, res) => {
  const showId = parseInt(req.params.show_id, 10);
  const { seat_ids: seatIds } = req.body;

  if (!showId) throw new AppError('Valid show_id is required', 400);
  if (!Array.isArray(seatIds) || seatIds.length === 0) {
    throw new AppError('seat_ids must be a non-empty array', 400);
  }

  const priceRes = await pool.query('SELECT price FROM shows WHERE show_id = $1', [showId]);
  if (!priceRes.rows.length) throw new AppError('Show not found', 404);
  const basePrice = parseFloat(priceRes.rows[0].price);

  const seatDetails = await SeatModel.getSeatsByIds(seatIds);
  if (seatDetails.length !== seatIds.length) {
    throw new AppError('One or more seat_ids are invalid', 400);
  }

  const breakdown = seatDetails.map((seat) => ({
    seat_id: seat.seat_id,
    seat_number: seat.seat_number,
    seat_type: seat.seat_type,
    price: priceForSeat(basePrice, seat.seat_type),
  }));

  const totalAmount = calculateTotal(basePrice, seatDetails);

  res.status(200).json({ success: true, base_price: basePrice, breakdown, total_amount: totalAmount });
});

module.exports = { bookTickets, cancelBooking, getBookingConfirmation, getMyBookings, getPriceQuote };