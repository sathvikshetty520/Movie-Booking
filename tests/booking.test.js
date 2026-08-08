const request = require('supertest');
const app = require('../app');
const { createTestFixture, closeConnections } = require('./testHelpers');

describe('Booking Lifecycle', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await createTestFixture({ seatCount: 3, price: 200 });
  });

  afterEach(async () => {
    await fixture.teardown();
  });

  afterAll(async () => {
    await closeConnections();
  });

  test('full flow: lock -> book -> seat shows as BOOKED', async () => {
    const { showId, seatIds, userId } = fixture;
    const seatId = seatIds[0];

    await request(app)
      .post(`/api/shows/${showId}/lock-seats`)
      .send({ user_id: userId, seat_ids: [seatId] })
      .expect(200);

    const bookRes = await request(app)
      .post('/api/bookings')
      .send({ user_id: userId, show_id: showId, seat_ids: [seatId] });

    expect(bookRes.status).toBe(201);
    expect(bookRes.body.data.status).toBe('CONFIRMED');
    const bookingId = bookRes.body.data.booking_id;

    const seatsRes = await request(app).get(`/api/shows/${showId}/seats`);
    const bookedSeat = seatsRes.body.data.find((s) => s.seat_id === seatId);
    expect(bookedSeat.status).toBe('BOOKED');

    return bookingId; // not used further here, but documents the flow
  });

  test('cancel booking frees the seat back to AVAILABLE', async () => {
    const { showId, seatIds, userId } = fixture;
    const seatId = seatIds[1];

    await request(app)
      .post(`/api/shows/${showId}/lock-seats`)
      .send({ user_id: userId, seat_ids: [seatId] })
      .expect(200);

    const bookRes = await request(app)
      .post('/api/bookings')
      .send({ user_id: userId, show_id: showId, seat_ids: [seatId] });
    const bookingId = bookRes.body.data.booking_id;

    const cancelRes = await request(app).patch(`/api/bookings/${bookingId}/cancel`);
    expect(cancelRes.status).toBe(200);

    const seatsRes = await request(app).get(`/api/shows/${showId}/seats`);
    const freedSeat = seatsRes.body.data.find((s) => s.seat_id === seatId);
    expect(freedSeat.status).toBe('AVAILABLE');

    // seat should now be lockable/bookable again by a different user
    const relockRes = await request(app)
      .post(`/api/shows/${showId}/lock-seats`)
      .send({ user_id: userId + 1, seat_ids: [seatId] });
    expect(relockRes.status).toBe(200);
  });

  test('cancelling an already-cancelled booking is rejected', async () => {
    const { showId, seatIds, userId } = fixture;
    const seatId = seatIds[2];

    await request(app)
      .post(`/api/shows/${showId}/lock-seats`)
      .send({ user_id: userId, seat_ids: [seatId] })
      .expect(200);

    const bookRes = await request(app)
      .post('/api/bookings')
      .send({ user_id: userId, show_id: showId, seat_ids: [seatId] });
    const bookingId = bookRes.body.data.booking_id;

    await request(app).patch(`/api/bookings/${bookingId}/cancel`).expect(200);

    const secondCancel = await request(app).patch(`/api/bookings/${bookingId}/cancel`);
    expect(secondCancel.status).toBe(404);
  });

  test('booking total is calculated correctly from seat type pricing', async () => {
    const { showId, seatIds, userId, price } = fixture;
    const seatId = seatIds[0];

    await request(app)
      .post(`/api/shows/${showId}/lock-seats`)
      .send({ user_id: userId, seat_ids: [seatId] })
      .expect(200);

    const bookRes = await request(app)
      .post('/api/bookings')
      .send({ user_id: userId, show_id: showId, seat_ids: [seatId] });

    // fixture seats are all REGULAR type -> multiplier 1x
    expect(parseFloat(bookRes.body.data.total_amount)).toBe(price);
  });
});