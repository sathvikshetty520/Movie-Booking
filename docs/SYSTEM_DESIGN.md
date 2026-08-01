# System Design Document — Movie Ticket Booking Backend

## 1. Architecture Overview

```
                        ┌───────────────────────┐
                        │        Client         │
                        │ (Postman / Frontend /  │
                        │  Socket.io client)     │
                        └──────────┬────────────┘
                                   │ REST + WebSocket
                                   ▼
                   ┌───────────────────────────────┐
                   │        Express.js API         │
                   │  (Controllers / Routes / MW)  │
                   └───────┬───────────────┬───────┘
                           │               │
                 ┌─────────▼───┐   ┌───────▼────────┐
                 │  PostgreSQL │   │      Redis      │
                 │  (source of │   │ (cache + seat   │
                 │   truth)    │   │   locks, TTL)   │
                 └─────────────┘   └────────────────┘
                           │
                           ▼
                 ┌───────────────────┐
                 │   Socket.io Layer  │
                 │ (real-time booking │
                 │  confirmation)     │
                 └───────────────────┘
```

**Layers (MVC):**
- **Model** — `models/*.js`: raw SQL access (movies, seats, bookings)
- **Controller** — `controllers/*.js`: input validation + orchestration
- **Service** — `services/*.js`: reusable cross-cutting logic (Redis locks, cache, recommendations, events) — kept separate from controllers to avoid duplicating concurrency logic across endpoints
- **View** — N/A (backend-only); JSON responses serve as the "view"

---

## 2. Database Schema (ER Diagram, textual)

```
movies (movie_id PK) ─┬──< shows (show_id PK, movie_id FK, theatre_id FK)
                       │
theatres (theatre_id PK) ┘

shows (show_id PK) ──< seats (seat_id PK, show_id FK, seat_number, status)

users (user_id PK) ──< bookings (booking_id PK, user_id FK, show_id FK,
                                  seat_ids INT[], total_amount, status)
```

- `seats.status`: `AVAILABLE` | `BOOKED` — single source of truth for occupancy
- `bookings.seat_ids`: array column avoids a separate join table for this scale;
  a `booking_seats` join table is a straightforward upgrade path if per-seat
  booking metadata is later needed
- `bookings.status`: `CONFIRMED` | `CANCELLED`

Full DDL: `sql/schema.sql`. Sample data: `sql/seed.sql`.

---

## 3. Redis Usage

| Purpose | Key pattern | Type | TTL |
|---|---|---|---|
| Seat lock (concurrency control) | `lock:show:{show_id}:seat:{seat_id}` | String (value = user_id) | 120s (configurable) |
| Movies+shows cache | `movies:with_shows` | String (JSON) | 300s |
| Seat availability cache | `seats:show:{show_id}` | String (JSON) | 30s (short TTL — high churn) |

**Why `SET key value NX EX ttl`:** this is a single atomic Redis command — no
separate "check then set" round trip — so two simultaneous requests for the
same seat can never both succeed. The loser receives `409 Conflict` immediately.

**Cache invalidation:** the seat-availability cache is explicitly invalidated
(`DEL seats:show:{id}`) immediately after a booking or cancellation changes seat
state, rather than waiting for the 30s TTL, so reads are never stale for long.

---

## 4. Concurrency Control Flow (2-Phase Commit Style)

```
User A                         Redis                         PostgreSQL
  │  lock-seats [1,2]            │                                │
  ├──────────────────────────────▶ SET lock:show1:seat1 NX EX120   │
  │                              │ SET lock:show1:seat2 NX EX120   │
  │  ◀── 200 OK (locked) ────────┤                                │
  │                              │                                │
  │  POST /bookings               │                                │
  ├──────────────────────────────▶ validateLocks() -> owner==A?   │
  │                              │ (yes)                          │
  │                              │            BEGIN TRANSACTION ─▶│
  │                              │      UPDATE seats SET BOOKED   │
  │                              │        WHERE status=AVAILABLE  │
  │                              │            INSERT booking      │
  │                              │            COMMIT ─────────────▶│
  │  ◀── release locks ──────────┤                                │
  │  ◀── 201 Confirmed ──────────┼── emit booking:confirmed ──────┤
```

If a second user (B) tries to lock seat 2 while A's lock is active, Redis `NX`
returns `nil` and B is told the seat is unavailable (`409`) — no DB round-trip
needed for the common contention case. If B's booking somehow reaches the DB
transaction anyway (e.g., a stale/expired lock), the
`WHERE status = 'AVAILABLE'` clause guarantees only one `UPDATE` succeeds; the
loser's row-count mismatch triggers an automatic `ROLLBACK`.

---

## 5. Event Flow (Real-Time Booking Confirmation)

1. Client connects via Socket.io and emits `join` with their `user_id`, joining room `user:{id}`.
2. On successful booking, `eventService.emitBookingConfirmed(userId, booking)` is called from inside `bookingController.bookTickets` **after** the DB transaction commits.
3. The event is emitted to:
   - `user:{id}` room → the booking owner gets an instant confirmation push
   - global `bookings:feed` → any listening admin dashboard sees live activity
4. Same pattern for cancellations (`booking:cancelled`).
5. `GET /bookings/:id/confirmation` allows a client to request a replay of the event (e.g. after reconnecting).

---

## 6. AI Recommendation Design

Hybrid scorer (see `services/recommendationService.js`):

```
score = 0.5 × genre_affinity(user)   -- personalization from booking history
      + 0.35 × normalized_popularity  -- global booking trend signal
      + 0.15 × movie_rating / 5       -- quality prior
```

- `genre_affinity`: fraction of the user's past confirmed bookings in that genre
- `normalized_popularity`: seats booked for that movie ÷ max seats booked for any movie
- New users (no booking history) fall back entirely to popularity + rating (cold-start handling)

This is intentionally dependency-free (no external ML API) but isolated behind
a single function so it can be swapped for a real recommender (e.g. a
collaborative-filtering microservice, or an LLM-based ranker called via the
Anthropic API) without changing the controller/route contract.

---

## 7. Error Handling & Logging

- Every controller is wrapped in `asyncHandler` → uncaught errors funnel to one `errorHandler` middleware → consistent `{ success: false, error }` responses
- Expected business errors (`AppError`) carry explicit HTTP status codes (400/404/409)
- Winston logs all requests and errors to console + `logs/combined.log` / `logs/error.log`

## 8. Scalability Notes (future work)
- Move seat locking to a Redis Lua script if lock+release needs to be a single atomic multi-key op under very high contention
- Add a message queue (e.g. BullMQ/RabbitMQ) for sending booking confirmation emails/SMS asynchronously
- Partition `bookings` by date range if volume grows significantly
