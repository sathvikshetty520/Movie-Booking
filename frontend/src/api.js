const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!res.ok || data.success === false) {
    const err = new Error(data.error || `Request failed: ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  getMovies: () => request('/movies'),
  getSeats: (showId) => request(`/shows/${showId}/seats`),
  lockSeats: (showId, userId, seatIds) =>
    request(`/shows/${showId}/lock-seats`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, seat_ids: seatIds }),
    }),
  unlockSeats: (showId, userId, seatIds) =>
    request(`/shows/${showId}/unlock-seats`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, seat_ids: seatIds }),
    }),
  bookTickets: (userId, showId, seatIds) =>
    request('/bookings', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, show_id: showId, seat_ids: seatIds }),
    }),
  cancelBooking: (bookingId) =>
    request(`/bookings/${bookingId}/cancel`, { method: 'PATCH' }),
  getRecommendations: (userId) => request(`/recommendations/${userId}`),
};

export const SOCKET_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api').replace(
  '/api',
  ''
);