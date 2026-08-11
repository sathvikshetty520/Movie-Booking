const AdminModel = require('../models/adminModel');
const asyncHandler = require('../middleware/asyncHandler');

// GET /api/admin/stats (protected, admin only)
const getDashboardStats = asyncHandler(async (req, res) => {
  const [overview, revenueByMovie, occupancy, recentBookings] = await Promise.all([
    AdminModel.getOverviewStats(),
    AdminModel.getRevenueByMovie(),
    AdminModel.getSeatOccupancyByShow(),
    AdminModel.getRecentBookings(20),
  ]);

  res.status(200).json({
    success: true,
    data: { overview, revenueByMovie, occupancy, recentBookings },
  });
});

module.exports = { getDashboardStats };