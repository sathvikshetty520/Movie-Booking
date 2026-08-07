// Price multipliers applied to a show's base price, per seat type.
// Kept as the single source of truth on the backend — the frontend may show
// an estimated breakdown, but the server always recalculates and charges
// based on this, never trusting a client-supplied amount.
const SEAT_TYPE_MULTIPLIERS = {
  REGULAR: 1,
  PREMIUM: 1.5,
  RECLINER: 2,
  ACCESSIBLE: 1, // priced same as Regular — accessibility seats aren't upcharged
};

function priceForSeat(basePrice, seatType) {
  const multiplier = SEAT_TYPE_MULTIPLIERS[seatType] || 1;
  return Number((basePrice * multiplier).toFixed(2));
}

function calculateTotal(basePrice, seats) {
  return Number(
    seats.reduce((sum, seat) => sum + priceForSeat(basePrice, seat.seat_type), 0).toFixed(2)
  );
}

module.exports = { SEAT_TYPE_MULTIPLIERS, priceForSeat, calculateTotal };