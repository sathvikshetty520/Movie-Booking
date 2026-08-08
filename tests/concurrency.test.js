const request = require('supertest');
const app = require('../app');
const { createTestFixture, closeConnections } = require('./testHelpers');

describe('Seat Locking Concurrency Control', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await createTestFixture({ seatCount: 4 });
  });

  afterEach(async () => {
    await fixture.teardown();
  });

  afterAll(async () => {
    await closeConnections();
  });

  test('two users locking the SAME seat simultaneously — only one succeeds', async () => {
    const { showId, seatIds } = fixture;
    const contestedSeat = seatIds[0];

    // Fire both lock requests at literally the same time (Promise.all, not sequential)
    const [resA, resB] = await Promise.all([
      request(app)
        .post(`/api/shows/${showId}/lock-seats`)
        .send({ user_id: 1001, seat_ids: [contestedSeat] }),
      request(app)
        .post(`/api/shows/${showId}/lock-seats`)
        .send({ user_id: 1002, seat_ids: [contestedSeat] }),
    ]);

    const statuses = [resA.status, resB.status].sort();

    // Exactly one must succeed (200) and the other must be rejected (409)
    expect(statuses).toEqual([200, 409]);

    const successResponse = resA.status === 200 ? resA : resB;
    const failResponse = resA.status === 409 ? resA : resB;

    expect(successResponse.body.success).toBe(true);
    expect(successResponse.body.seatIds).toContain(contestedSeat);
    expect(failResponse.body.success).toBe(false);
    expect(failResponse.body.error).toMatch(/already locked/i);
  });

  test('locking DIFFERENT seats simultaneously — both succeed (no false contention)', async () => {
    const { showId, seatIds } = fixture;

    const [resA, resB] = await Promise.all([
      request(app)
        .post(`/api/shows/${showId}/lock-seats`)
        .send({ user_id: 2001, seat_ids: [seatIds[1]] }),
      request(app)
        .post(`/api/shows/${showId}/lock-seats`)
        .send({ user_id: 2002, seat_ids: [seatIds[2]] }),
    ]);

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);
  });

  test('booking a seat someone else already booked — rejected even with a valid lock', async () => {
    const { showId, seatIds, userId } = fixture;
    const seatId = seatIds[3];

    // User A locks and books the seat successfully first
    await request(app)
      .post(`/api/shows/${showId}/lock-seats`)
      .send({ user_id: userId, seat_ids: [seatId] })
      .expect(200);

    const bookRes = await request(app)
      .post('/api/bookings')
      .send({ user_id: userId, show_id: showId, seat_ids: [seatId] });
    expect(bookRes.status).toBe(201);

    // User B tries to lock the same (now-booked) seat — should be rejected
    // at the DB-state check inside lock-seats, before even reaching Redis
    const lockRes = await request(app)
      .post(`/api/shows/${showId}/lock-seats`)
      .send({ user_id: 9999, seat_ids: [seatId] });

    expect(lockRes.status).toBe(409);
    expect(lockRes.body.error).toMatch(/already booked/i);
  });

  test('booking without a valid lock is rejected (lock expired or never taken)', async () => {
    const { showId, seatIds, userId } = fixture;
    const seatId = seatIds[0];

    // Never called lock-seats for this seat — booking should fail
    const res = await request(app)
      .post('/api/bookings')
      .send({ user_id: userId, show_id: showId, seat_ids: [seatId] });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/lock/i);
  });
});