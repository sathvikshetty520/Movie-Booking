# System Design Document — Movie Ticket Booking System

## 1. Architecture Overview

┌───────────────────────┐
                    │        Client         │
                    │  React SPA (Vite) +    │
                    │  Socket.io client      │
                    └──────────┬────────────┘
                               │ REST (JWT) + WebSocket
                               ▼
               ┌───────────────────────────────┐
               │        Express.js API         │
               │  (Controllers / Routes / MW)  │
               │  Auth middleware (JWT verify) │
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
             │ personal booking   │
             │ events + live seat │
             │ updates + admin    │
             │ live feed          │
             └───────────────────┘

    External services (called out-of-band, not on the hot path):
    - Groq API (Llama 3.3 70B)  -> AI recommendations
    - TMDB API                  -> poster images (fetched once via script,
                                    cached in the DB, never called live)


  **Layers (MVC):**
- **Model** — `models/*.js`: raw SQL access (movies, seats, bookings, users, admin aggregates)
- **Controller** — `controllers/*.js`: input validation + orchestration
- **Service** — `services/*.js`: reusable cross-cutting logic (Redis locks, cache, recommendations, real-time events)
- **Middleware** — `middleware/*.js`: JWT auth (`requireAuth`, `requireAdmin`), error handling, async wrapper
- **View** — N/A on the backend (JSON API); the React frontend (`frontend/src/`) is the presentation layer

---

## 2. Database Schema (ER Diagram, textual)

users (user_id PK, email UNIQUE, password_hash, is_admin) ──< bookings (user_id FK)

movies (movie_id PK, title UNIQUE, poster_url, is_now_showing) ─┬──< shows (movie_id FK, theatre_id FK)
│
theatres (theatre_id PK) ────────────────────────────────────────┘

shows (show_id PK, UNIQUE(movie_id, theatre_id, screen_name, show_time))
──< seats (show_id FK, row_label, seat_type, status)

bookings (booking_id PK, user_id FK, show_id FK, seat_ids INT[], total_amount, status)

Key columns added since the initial design:
- `movies.poster_url`, `movies.is_now_showing` — real poster support (TMDB)
- `seats.row_label`, `seats.seat_type` — theatre layout (Regular / Premium / Recliner / Accessible)
- `users.password_hash`, `users.is_admin` — authentication + role
- `movies.title` and `shows.(movie_id, theatre_id, screen_name, show_time)` — `UNIQUE` constraints added after a duplicate-seeding bug (re-running `seed.sql` without a real uniqueness guard caused `ON CONFLICT DO NOTHING` to silently insert duplicates instead of skipping them)

Full DDL: `sql/schema.sql`. Sample data: `sql/seed.sql`. Incremental changes for existing databases: `sql/migration_*.sql`.

---

## 3. Authentication & Authorization

**Registration/Login (`controllers/authController.js`):**
- Passwords hashed with `bcrypt` (10 salt rounds) before storage — plaintext passwords are never persisted
- On successful login/register, a JWT is issued containing `{ userId, email, isAdmin }`, signed with `JWT_SECRET`, expiring per `JWT_EXPIRES_IN` (default 7 days)

**Request authorization (`middleware/auth.js`):**
- `requireAuth` — verifies the `Authorization: Bearer <token>` header on protected routes, attaches `req.user = { userId, email, isAdmin }`. Controllers read `req.user.userId` instead of trusting any `user_id` in the request body — this is what actually proves the caller's identity, rather than merely asking for it politely.
- `requireAdmin` — checked after `requireAuth`; rejects with `403` unless `req.user.isAdmin` is true. Used to gate `/api/admin/stats`.

**Protected vs public routes:**
| Public | Protected (`requireAuth`) | Admin-only (`requireAdmin`) |
|---|---|---|
| Browse movies/shows, seat availability, price quotes | Lock/unlock seats, book, cancel, my-bookings, recommendations | Admin dashboard stats |

---

## 4. Redis Usage

| Purpose | Key pattern | Type | TTL |
|---|---|---|---|
| Seat lock (concurrency control) | `lock:show:{show_id}:seat:{seat_id}` | String (value = user_id) | 120s (configurable) |
| Movies+shows cache | `movies:with_shows` | String (JSON) | 300s |
| Single movie cache | `movie:{movie_id}` | String (JSON) | 120s |
| All-shows cache | `shows:all` | String (JSON) | 60s |
| Seat availability cache | `seats:show:{show_id}` | String (JSON) | 30s (short TTL — high churn) |

**Why `SET key value NX EX ttl`:** a single atomic Redis command — no separate "check then set" round trip — so two simultaneous requests for the same seat can never both succeed. The loser receives `409 Conflict` immediately, without touching Postgres.

**Cache invalidation:** seat-availability cache is explicitly invalidated (`DEL seats:show:{id}`) immediately after any booking or cancellation, rather than waiting out the 30s TTL, so reads are never stale for long.

---

## 5. Concurrency Control Flow (2-Phase, now integration-tested)

User A Redis PostgreSQL
│ lock-seats [1,2] │ │
├──────────────────────────────▶ SET lock:show1:seat1 NX EX120 │
│ │ SET lock:show1:seat2 NX EX120 │
│ ◀── 200 OK (locked) ────────┤ │
│ │ │
│ POST /bookings (JWT) │ │
├──────────────────────────────▶ validateLocks() -> owner==A? │
│ │ (yes) │
│ │ BEGIN TRANSACTION ─▶│
│ │ UPDATE seats SET BOOKED │
│ │ WHERE status=AVAILABLE │
│ │ INSERT booking │
│ │ COMMIT ─────────────▶│
│ ◀── release locks ──────────┤ │
│ ◀── 201 Confirmed ──────────┼── emit booking:confirmed ──────┤
│ │── emit seat:update (BOOKED) ───┤
│ │ to everyone else viewing │
│ │ this show's seat map │

If a second user (B) tries to lock a seat A already holds, Redis `NX` returns `nil` and B gets `409` — no DB round-trip for the common contention case. If B's booking somehow reaches the DB transaction anyway (e.g., a stale/expired lock), `WHERE status = 'AVAILABLE'` guarantees only one `UPDATE` succeeds; the loser's row-count mismatch triggers `ROLLBACK`.

**This is no longer just asserted — it's tested.** `tests/concurrency.test.js` uses Jest + Supertest to fire two simultaneous `POST /lock-seats` requests at the same seat via `Promise.all` (not sequential calls) against a real Postgres/Redis instance, and asserts exactly one returns `200` and the other `409`. `tests/booking.test.js` covers the full lock → book → cancel → re-lock lifecycle and verifies pricing totals. Run via `npm test`.

---

## 6. Seat Pricing Model

`utils/pricing.js` defines per-seat-type multipliers applied to a show's base price:

| Seat Type | Multiplier | Rationale |
|---|---|---|
| Regular | ×1.0 | baseline |
| Premium | ×1.5 | better positioning (middle rows) |
| Recliner | ×2.0 | largest, most comfortable, back rows |
| Accessible | ×1.0 | same as Regular — never upcharged |

**Server-side authority:** `POST /shows/:id/quote` lets the frontend preview a price breakdown before locking anything, but the actual charge is *always* recalculated server-side inside the booking transaction (`bookingController.js`) using the same `calculateTotal()` function — a client can never submit or influence the final amount. This is a deliberate security boundary: price is derived from `seat_type` (read from the DB) × the show's `price` column (read from the DB), never from anything the client sends.

---

## 7. Theatre Seat Layout

Generated per-show in `sql/seed.sql`: 8 rows (A–H) × 12 seats, with a center aisle rendered on the frontend (`SeatGrid.jsx` splits each row at the midpoint).

| Rows | Type |
|---|---|
| A, B, C | Regular |
| D, E, F | Premium |
| G, H | Recliner |
| G1, G12 (aisle ends of the recliner section) | Accessible |

Seat numbers sort correctly (`A1, A2, ... A12`, not lexicographic `A1, A10, A11...`) via `ORDER BY row_label, (regexp_replace(seat_number, '[^0-9]', '', 'g'))::int` in `models/seatModel.js`.

---

## 8. Real-Time Event Flow

Three distinct Socket.io event channels, all driven from `services/eventService.js`:

1. **Personal booking confirmation** — `booking:confirmed` / `booking:cancelled`, emitted to room `user:{userId}` (client joins on login). Drives the toast notification the booking owner sees.
2. **Live seat-map updates** — `seat:update`, emitted to room `show:{showId}` (client joins/leaves as they enter/exit a booking page). Payload includes `status: 'LOCKED' | 'AVAILABLE' | 'BOOKED'` and excludes the acting user (`by_user_id`) so their own optimistic UI isn't redundantly overwritten. This is what makes a seat visibly gray out in a *second browser window* the instant it's locked or booked in the first — no polling, no refresh.
3. **Global admin feed** — `bookings:feed`, emitted to all connected sockets on every confirmed/cancelled booking. Powers the live feed on `/admin`.

---

## 9. AI Recommendation Design

`services/recommendationService.js` calls the **Groq API** (Llama 3.3 70B) as the primary engine, with a local hybrid scorer as automatic fallback:

**Primary path (Groq):** user's booking history by genre + global booking trends are sent as context; Groq returns ranked recommendations with natural-language reasons.

**Fallback path (local, dependency-free):**

score = 0.5 × genre_affinity(user) + 0.35 × normalized_popularity + 0.15 × movie_rating / 5

Triggered automatically if `GROQ_API_KEY` is missing or the call fails/times out — the endpoint never returns a 500. New users with no booking history fall back to popularity + rating (cold-start handling).

---

## 10. Real Movie Posters (TMDB)

`scripts/fetch-posters.js` is a standalone, re-runnable script — never called on the request path — that looks up each seeded movie by title via TMDB's search API and persists the real poster URL + rating into `movies.poster_url`. This keeps normal page loads fast (no external API dependency at runtime) while showing genuine, correctly-attributed poster artwork served from TMDB's CDN.

---

## 11. Admin Dashboard

`models/adminModel.js` / `controllers/adminController.js` expose aggregate queries behind `requireAdmin`:
- **Overview** — total confirmed bookings, cancellations, revenue, users, movies, shows
- **Revenue by movie** — `SUM(total_amount)` joined through shows → bookings, grouped by movie
- **Seat occupancy by show** — booked seats ÷ total seats per show, rendered as a progress bar on the frontend
- **Recent bookings** — last 20 bookings with user/movie context

The frontend's `/admin` page combines this REST snapshot with the live `bookings:feed` socket stream, so the dashboard shows both historical aggregates and real-time activity in the same view.

---

## 12. Error Handling & Logging

- Every controller wrapped in `asyncHandler` → uncaught errors funnel to one `errorHandler` middleware → consistent `{ success: false, error }` JSON responses
- Expected business errors (`AppError`) carry explicit HTTP status codes: `400` validation, `401` auth, `403` forbidden (wrong owner / non-admin), `404` not found, `409` conflict (seat locked/booked)
- Winston logs all requests + errors to console and `logs/combined.log` / `logs/error.log`
- Groq API failures are logged but never surface as a 500 to the client

---

## 13. Testing Strategy

`tests/` (Jest + Supertest) runs integration tests against the real Postgres/Redis stack — not mocks — via `app.js` (Express config exported separately from `server.js`'s `.listen()` call, so Supertest can drive requests without a live network port).

Each test creates an isolated fixture (`tests/testHelpers.js`: its own throwaway movie/theatre/show/seats/user, prefixed `__TEST_*`) and tears it down afterward, so tests never collide with or corrupt seeded demo data. `--runInBand` forces sequential execution since tests share real external state.

Covered scenarios: simultaneous same-seat lock contention (the core concurrency guarantee), simultaneous different-seat locks (no false contention), booking an already-booked seat, booking without a valid lock, full lock→book→cancel→re-lock lifecycle, double-cancellation rejection, and per-seat-type price calculation correctness.

---

## 14. Scalability Notes (future work)

- Move seat locking to a Redis Lua script if lock+release ever needs to be a single atomic multi-key operation under very high contention
- Add a message queue (BullMQ/RabbitMQ, backed by the Redis instance already present) for asynchronous booking-confirmation emails/SMS
- Partition `bookings` by date range at higher volume
- Rate-limit `lock-seats`/`bookings` endpoints (e.g. `express-rate-limit`) to blunt scripted abuse — not yet implemented
- Containerize the full stack (Postgres + Redis + backend) via Docker Compose for one-command reviewer setup — not yet implemented