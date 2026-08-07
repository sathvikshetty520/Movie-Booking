const pool = require('../config/db');
const SeatModel = require('../models/seatModel');
const BookingModel = require('../models/bookingModel');
const { validateLocks, releaseSeats } = require('../services/lockService');
const { invalidate } = require('../services/cacheService');
const { emitBookingConfirmed, emitBookingCancelled } = require('../services/eventService');
const { calculateTotal, priceForSeat } = require('../utils/pricing');
const AppError = require('../utils/AppError');
const asyncHandler = require('../middleware/asyncHandler');
const logger = require('../utils/logger');

// POST /api/bookings
// Body: { user_id, show_id, seat_ids: [1,2,3] }
const bookTickets = asyncHandler(async (req, res) => {
  const { user_id: userId, show_id: showId, seat_ids: seatIds } = req.body;

  if (!userId || !showId || !Array.isArray(seatIds) || seatIds.length === 0) {
    throw new AppError('user_id, show_id and non-empty seat_ids are required', 400);
  }

  // Step 1: Validate the caller actually holds the Redis locks for these seats
  await validateLocks(showId, seatIds, userId);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Step 2: Atomically flip seats AVAILABLE -> BOOKED (row-level guard against double booking)
    const bookedSeatIds = await SeatModel.markSeatsBooked(seatIds, client);

    if (bookedSeatIds.length !== seatIds.length) {
      await client.query('ROLLBACK');
      throw new AppError('One or more seats were already booked. Please pick different seats.', 409);
    }

    // Step 3: Compute total amount using per-seat-type pricing (never trust a
    // client-supplied amount — always recalculate authoritatively here)
    const priceRes = await client.query('SELECT price FROM shows WHERE show_id = $1', [showId]);
    if (!priceRes.rows.length) {
      await client.query('ROLLBACK');
      throw new AppError('Show not found', 404);
    }
    const basePrice = parseFloat(priceRes.rows[0].price);

    const seatDetails = await SeatModel.getSeatsByIds(seatIds);
    const totalAmount = calculateTotal(basePrice, seatDetails);

    // Step 4: Create booking record
    const booking = await BookingModel.createBooking(
      { userId, showId, seatIds, totalAmount },
      client
    );

    await client.query('COMMIT');

    // Step 5: Release Redis locks now that booking is confirmed in DB
    await releaseSeats(showId, seatIds, userId);

    // Step 6: Invalidate seat-availability cache so next fetch reflects new state
    await invalidate(`seats:show:${showId}`);

    // Step 7: Emit real-time confirmation event (WebSocket)
    emitBookingConfirmed(userId, booking);

    logger.info(`Booking ${booking.booking_id} confirmed for user ${userId}, show ${showId}`);

    res.status(201).json({ success: true, message: 'Booking confirmed', data: booking });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
});

// PATCH /api/bookings/:booking_id/cancel
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

    await SeatModel.markSeatsAvailable(cancelled.seat_ids, client);
    await client.query('COMMIT');

    await invalidate(`seats:show:${cancelled.show_id}`);

    emitBookingCancelled(cancelled.user_id, { booking_id: bookingId, show_id: cancelled.show_id });

    logger.info(`Booking ${bookingId} cancelled`);
    res.status(200).json({ success: true, message: 'Booking cancelled', data: cancelled });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
});

// GET /api/bookings/:booking_id/confirmation
const getBookingConfirmation = asyncHandler(async (req, res) => {
  const bookingId = parseInt(req.params.booking_id, 10);
  const booking = await BookingModel.getBookingById(bookingId);

  if (!booking) throw new AppError('Booking not found', 404);

  emitBookingConfirmed(booking.user_id, booking);

  res.status(200).json({ success: true, data: booking });
});

// GET /api/users/:user_id/bookings
const getMyBookings = asyncHandler(async (req, res) => {
  const userId = parseInt(req.params.user_id, 10);
  if (!userId) throw new AppError('Valid user_id is required', 400);

  const bookings = await BookingModel.getBookingsByUser(userId);
  res.status(200).json({ success: true, count: bookings.length, data: bookings });
});

// POST /api/shows/:show_id/quote
// Body: { seat_ids: [1,2,3] }
// Returns a per-seat price breakdown WITHOUT locking or booking anything —
// used by the frontend to show "Premium x2 = ₹500" before the user commits.
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