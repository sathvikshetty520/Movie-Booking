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
} = require('../controllers/bookingController');
const { getRecommendations } = require('../controllers/recommendationController');

router.get('/movies', getMoviesAndShows);
router.get('/movies/:movie_id', getMovieById);
router.get('/shows', getAllShows);

router.get('/shows/:show_id/seats', getAvailableSeats);
router.post('/shows/:show_id/lock-seats', lockSeatsController);
router.post('/shows/:show_id/unlock-seats', unlockSeatsController);

router.post('/bookings', bookTickets);
router.patch('/bookings/:booking_id/cancel', cancelBooking);
router.get('/bookings/:booking_id/confirmation', getBookingConfirmation);

router.get('/users/:user_id/bookings', getMyBookings);

router.get('/recommendations/:user_id', getRecommendations);

module.exports = router;