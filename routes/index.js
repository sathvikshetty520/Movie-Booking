const express = require('express');
const router = express.Router();

const { getMoviesAndShows, getMovieById, getAllShows } = require('../controllers/movieController');
const {
  getAvailableSeats,
  lockSeatsController,
  unlockSeatsController,
} = require('../controllers/seatController');
const {
  bookTickets,
  cancelBooking,
  getBookingConfirmation,
  getMyBookings,
  getPriceQuote,
} = require('../controllers/bookingController');
const { getRecommendations } = require('../controllers/recommendationController');

// 1. Get Movies and Shows
router.get('/movies', getMoviesAndShows);
router.get('/movies/:movie_id', getMovieById);
router.get('/shows', getAllShows);

// 2. Get Available Seats
router.get('/shows/:show_id/seats', getAvailableSeats);

// 3. Lock Seats
router.post('/shows/:show_id/lock-seats', lockSeatsController);
router.post('/shows/:show_id/unlock-seats', unlockSeatsController);
router.post('/shows/:show_id/quote', getPriceQuote);

// 4. Book Tickets
router.post('/bookings', bookTickets);

// 5. Cancel Booking
router.patch('/bookings/:booking_id/cancel', cancelBooking);

// 6. Booking Confirmation Event
router.get('/bookings/:booking_id/confirmation', getBookingConfirmation);

// My Bookings page
router.get('/users/:user_id/bookings', getMyBookings);

// 7. AI Movie Recommendation
router.get('/recommendations/:user_id', getRecommendations);

module.exports = router;