const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

function getToken() {
  return localStorage.getItem('token');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const data = await res.json();

  if (!res.ok || data.success === false) {
    const err = new Error(data.error || `Request failed: ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  register: (name, email, password) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) }),
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  getMe: () => request('/auth/me'),

  getMovies: () => request('/movies'),
  getMovieById: (movieId) => request(`/movies/${movieId}`),
  getAllShows: () => request('/shows'),
  getSeats: (showId) => request(`/shows/${showId}/seats`),
  getPriceQuote: (showId, seatIds) =>
    request(`/shows/${showId}/quote`, { method: 'POST', body: JSON.stringify({ seat_ids: seatIds }) }),
  lockSeats: (showId, seatIds) =>
    request(`/shows/${showId}/lock-seats`, { method: 'POST', body: JSON.stringify({ seat_ids: seatIds }) }),
  unlockSeats: (showId, seatIds) =>
    request(`/shows/${showId}/unlock-seats`, { method: 'POST', body: JSON.stringify({ seat_ids: seatIds }) }),
  bookTickets: (showId, seatIds) =>
    request('/bookings', { method: 'POST', body: JSON.stringify({ show_id: showId, seat_ids: seatIds }) }),
  cancelBooking: (bookingId) => request(`/bookings/${bookingId}/cancel`, { method: 'PATCH' }),
  getMyBookings: () => request('/users/me/bookings'),
  getRecommendations: () => request('/recommendations/me'),
  getAdminStats: () => request('/admin/stats'),
};

export const SOCKET_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api').replace('/api', '');