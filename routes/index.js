// const express = require('express');
// const router = express.Router();
// const { getDashboardStats } = require('../controllers/adminController');
// const { requireAdmin } = require('../middleware/auth');

// const { register, login, getMe } = require('../controllers/authController');
// const { requireAuth } = require('../middleware/auth');

// const { getMoviesAndShows, getMovieById, getAllShows } = require('../controllers/movieController');
// const {
//   getAvailableSeats,
//   lockSeatsController,
//   unlockSeatsController,
// } = require('../controllers/seatController');
// const {
//   bookTickets,
//   cancelBooking,
//   getBookingConfirmation,
//   getMyBookings,
//   getPriceQuote,
// } = require('../controllers/bookingController');
// const { getRecommendations } = require('../controllers/recommendationController');

// // Auth
// router.post('/auth/register', register);
// router.post('/auth/login', login);
// router.get('/auth/me', requireAuth, getMe);

// // 1. Get Movies and Shows (public)
// router.get('/movies', getMoviesAndShows);
// router.get('/movies/:movie_id', getMovieById);
// router.get('/shows', getAllShows);

// // 2. Get Available Seats (public)
// router.get('/shows/:show_id/seats', getAvailableSeats);

// // 3. Lock Seats (protected — must be logged in to reserve a seat)
// router.post('/shows/:show_id/lock-seats', requireAuth, lockSeatsController);
// router.post('/shows/:show_id/unlock-seats', requireAuth, unlockSeatsController);
// router.post('/shows/:show_id/quote', getPriceQuote); // public — just a price preview

// // 4. Book Tickets (protected)
// router.post('/bookings', requireAuth, bookTickets);

// // 5. Cancel Booking (protected)
// router.patch('/bookings/:booking_id/cancel', requireAuth, cancelBooking);

// // 6. Booking Confirmation Event (protected)
// router.get('/bookings/:booking_id/confirmation', requireAuth, getBookingConfirmation);

// // My Bookings (protected — always the logged-in user's own)
// router.get('/users/me/bookings', requireAuth, getMyBookings);

// // 7. AI Movie Recommendation (protected — personalized to the logged-in user)
// router.get('/recommendations/me', requireAuth, getRecommendations);

// router.get('/admin/stats', requireAuth, requireAdmin, getDashboardStats);
// module.exports = router;
const express = require('express');
const router = express.Router();

const { register, login, getMe } = require('../controllers/authController');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { getDashboardStats } = require('../controllers/adminController');

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

router.post('/auth/register', register);
router.post('/auth/login', login);
router.get('/auth/me', requireAuth, getMe);

router.get('/movies', getMoviesAndShows);
router.get('/movies/:movie_id', getMovieById);
router.get('/shows', getAllShows);

router.get('/shows/:show_id/seats', getAvailableSeats);

router.post('/shows/:show_id/lock-seats', requireAuth, lockSeatsController);
router.post('/shows/:show_id/unlock-seats', requireAuth, unlockSeatsController);
router.post('/shows/:show_id/quote', getPriceQuote);

router.post('/bookings', requireAuth, bookTickets);
router.patch('/bookings/:booking_id/cancel', requireAuth, cancelBooking);
router.get('/bookings/:booking_id/confirmation', requireAuth, getBookingConfirmation);

router.get('/users/me/bookings', requireAuth, getMyBookings);

router.get('/recommendations/me', requireAuth, getRecommendations);

router.get('/admin/stats', requireAuth, requireAdmin, getDashboardStats);

module.exports = router;