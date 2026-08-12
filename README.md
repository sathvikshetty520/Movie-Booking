# Movie Ticket Booking System

A full-stack movie ticket booking application with Redis-based concurrency
control, PostgreSQL storage, real-time booking + live seat-map updates
(Socket.io), AI-powered recommendations (Groq), JWT authentication, an admin
dashboard, and a React frontend with real movie posters (TMDB) and a
realistic theatre seat map — similar in spirit to BookMyShow.

## Architecture

Backend (MVC):
app.js -> Express app config (exported separately so tests can import it)
server.js -> starts the HTTP server + Socket.io on top of app.js
config/ -> DB & Redis connections
models/ -> Data access layer (SQL queries)
controllers/ -> Request handling + business logic
services/ -> Reusable logic: locking, caching, events, recommendations (Groq)
middleware/ -> JWT auth (requireAuth, requireAdmin), error handling, async wrapper
routes/ -> Express route definitions
utils/ -> pricing, JWT signing, custom error class, logger
sql/ -> schema.sql, seed.sql, migration files
scripts/ -> fetch-posters.js, fetch-now-playing.js (TMDB integration)
tests/ -> Jest + Supertest integration tests (real Postgres/Redis)
docs/ -> API documentation, system design document

Frontend:
frontend/src/
api.js -> API client (attaches JWT to every request)
AppContext.jsx -> auth state, socket connection, toasts
App.jsx -> React Router setup + protected routes
components/ -> NavBar, MovieCard, SeatGrid, Toast, ProtectedRoute
pages/ -> Home, Movies, MovieDetail, Shows, Booking,
MyBookings, Login, Register, Admin

## Tech Stack

**Backend**
- Node.js + Express (REST API)
- PostgreSQL (`pg`) — primary data store
- Redis (`ioredis`) — caching + seat-locking (concurrency control)
- Socket.io — real-time booking confirmation, live seat-map updates, admin live feed
- JWT (`jsonwebtoken`) + `bcrypt` — authentication
- Groq API (Llama 3.3 70B) — AI movie recommendations, with local fallback
- Winston — logging
- Jest + Supertest — integration tests against real Postgres/Redis

**Frontend**
- React (Vite)
- React Router — multi-page navigation + protected/admin-only routes
- Socket.io client — live booking toasts, live seat updates, admin live feed
- TMDB API — real movie posters + genuinely current "Now Playing" catalog
- Custom theatre-style seat map — rows, center aisle, screen indicator, 4 seat types

## Setup

### 1. Install backend dependencies
\```bash
npm install
\```

### 2. Configure environment variables
\```bash
cp .env.example .env
\```
Fill in:
\```
PORT=3001

PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=postgres
PGDATABASE=ticket_booking

REDIS_HOST=localhost
REDIS_PORT=6379

SEAT_LOCK_TTL_SECONDS=120

GROQ_API_KEY=gsk_your_real_key_here
GROQ_MODEL=llama-3.3-70b-versatile

TMDB_API_KEY=your_tmdb_key_here

JWT_SECRET=change_this_to_a_long_random_string
JWT_EXPIRES_IN=7d
\```
- Get a free Groq key: https://console.groq.com/keys
- Get a free TMDB key: https://www.themoviedb.org/settings/api

### 3. Create the database (fresh setup)
\```bash
createdb ticket_booking
psql -U postgres -d ticket_booking -f sql/schema.sql
psql -U postgres -d ticket_booking -f sql/seed.sql
\```

If you already have an older version of this DB, run the migrations instead
of dropping everything (run in this order):
\```bash
psql -U postgres -d ticket_booking -f sql/migration_add_posters.sql
psql -U postgres -d ticket_booking -f sql/migration_add_seat_types.sql
psql -U postgres -d ticket_booking -f sql/migration_add_auth.sql
psql -U postgres -d ticket_booking -f sql/migration_add_admin_role.sql
\```
Then add the uniqueness constraints that prevent duplicate seed data on
re-runs (only needed once):
\```bash
psql -U postgres -d ticket_booking -c "ALTER TABLE movies ADD CONSTRAINT movies_title_unique UNIQUE (title);"
psql -U postgres -d ticket_booking -c "ALTER TABLE shows ADD CONSTRAINT shows_unique_slot UNIQUE (movie_id, theatre_id, screen_name, show_time);"
\```

### 4. Fetch real, currently-showing movies from TMDB
\```bash
node scripts/fetch-now-playing.js
# or target a specific region, e.g. India:
node scripts/fetch-now-playing.js --region=IN
\```
Pulls TMDB's live "Now Playing" list, upserts real movies with real posters
and ratings, auto-generates shows + full theatre seat layouts for each, and
marks any older seed movies as no longer showing (without deleting their
booking history). Safe to re-run any time to refresh the catalog.

Alternatively, `node scripts/fetch-posters.js` just backfills poster images
for whatever's already in `movies` (used by the original fixed seed set).

### 5. Start Redis
\```bash
docker run --name ticket-redis -p 6379:6379 -d redis
\```

### 6. Start the backend
\```bash
npm run dev
\```
Runs at `http://localhost:3001`. Health check: `GET /health`.

### 7. Start the frontend
\```bash
cd frontend
npm install
cp .env.example .env
npm run dev
\```
Runs at `http://localhost:5173`.

### 8. Create an account, then promote yourself to admin (optional)
Register normally through the app (`/register`), then:
\```bash
psql -U postgres -d ticket_booking -c "UPDATE users SET is_admin = TRUE WHERE email = 'your@email.com';"
\```
**Log out and log back in** afterward — `is_admin` is baked into the JWT at
login time, so an existing session won't pick up the change automatically.

## Using the App

- **Home** (`/`) — currently-showing movies with real posters + ratings
- **Movies** (`/movies`) — full catalog with genre filter
- **Movie detail** (`/movies/:id`) — poster, info, showtimes grouped by theatre
- **Shows** (`/shows`) — flat list of every scheduled show across all movies
- **Login / Register** (`/login`, `/register`) — required before booking
- **Booking** (`/book/:showId`) — realistic theatre seat map, live price
  breakdown → lock seats → confirm booking (protected route)
- **My Bookings** (`/my-bookings`) — your own booking history + cancel (protected)
- **Admin** (`/admin`) — stats, revenue by movie, seat occupancy, live bookings
  feed (protected, admin-only)

A live toast notification appears the instant your booking is confirmed
(Socket.io), and anyone else viewing the same show's seat map sees seats
gray out in real time the moment they're locked or booked — no refresh needed.

### Theatre Seat Map

Each show has an 8-row (A–H) x 12-seat layout with a center aisle and a
curved "SCREEN" indicator at the top:

| Rows | Seat Type | Price Multiplier |
|---|---|---|
| A, B, C | Regular | ×1.0 |
| D, E, F | Premium | ×1.5 |
| G, H | Recliner | ×2.0 |
| G1, G12 (aisle ends of the recliner section) | Accessible | ×1.0 (never upcharged) |

The final charge is always recalculated server-side from `seat_type` — a
client can never influence the actual amount billed.

## Authentication

- `POST /api/auth/register` — creates an account (bcrypt-hashed password), returns a JWT
- `POST /api/auth/login` — returns a JWT
- `GET /api/auth/me` — validates a token, returns the current user (protected)
- Protected endpoints (locking seats, booking, cancelling, my-bookings,
  recommendations) require `Authorization: Bearer <token>` and read the
  user's identity from the verified token — never from a client-supplied
  `user_id` in the request body
- `/api/admin/stats` additionally requires `is_admin = true` on the token

## Testing with Postman

Import `Movie_Ticket_Booking.postman_collection.json`. Since booking-related
endpoints now require auth, call `POST /api/auth/login` first, copy the
`token` from the response, and add header `Authorization: Bearer <token>` to
the protected requests (lock-seats, unlock-seats, bookings, cancel,
confirmation, my-bookings, recommendations, admin/stats).

**Recommended order:**
1. Register or log in → save the token
2. Get Movies and Shows → note a `show_id`
3. Get Available Seats → note `AVAILABLE` `seat_id`s (always fetch fresh —
   not the same across shows)
4. Lock Seats (with auth header)
5. Book Tickets (with auth header) → save the returned `booking_id`
6. Cancel Booking / Booking Confirmation Event (with auth header)
7. AI Movie Recommendation (with auth header)

## API Overview

| # | Method | Endpoint | Auth | Purpose |
|---|--------|----------|------|---------|
| — | POST | `/api/auth/register` | Public | Create account, returns JWT |
| — | POST | `/api/auth/login` | Public | Log in, returns JWT |
| — | GET | `/api/auth/me` | Protected | Get current user from token |
| 1 | GET | `/api/movies` | Public | Movies + shows (Redis cached, 300s TTL) |
| — | GET | `/api/movies/:movie_id` | Public | Single movie + showtimes |
| — | GET | `/api/shows` | Public | Flat list of all shows |
| 2 | GET | `/api/shows/:show_id/seats` | Public | Seat availability (Redis cached, 30s TTL) |
| 3 | POST | `/api/shows/:show_id/lock-seats` | Protected | Lock seats before booking (Redis, TTL) |
| 3b| POST | `/api/shows/:show_id/unlock-seats` | Protected | Manually release a lock |
| — | POST | `/api/shows/:show_id/quote` | Public | Price breakdown preview before locking |
| 4 | POST | `/api/bookings` | Protected | Confirm booking (validates lock, DB transaction) |
| 5 | PATCH | `/api/bookings/:booking_id/cancel` | Protected | Cancel booking, free seats |
| 6 | GET | `/api/bookings/:booking_id/confirmation` | Protected | Re-emit real-time confirmation event |
| — | GET | `/api/users/me/bookings` | Protected | Logged-in user's booking history |
| 7 | GET | `/api/recommendations/me` | Protected | AI movie recommendations (Groq) |
| — | GET | `/api/admin/stats` | Admin only | Dashboard: overview, revenue, occupancy, live feed |

Full request/response examples: `docs/API_DOCUMENTATION.md`.
Architecture, ER diagram, Redis usage, event flow: `docs/SYSTEM_DESIGN.md`.

## Concurrency Control Design

Two-phase booking prevents double-booking under concurrent requests:

**Phase 1 — Lock (Redis):**
`SET lock:show:{id}:seat:{id} {user_id} NX EX 120`
`NX` makes this a single atomic test-and-set — only the first caller acquires
the key; everyone else gets `nil` and is rejected with `409 Conflict`. The
lock auto-expires after 120s if the user abandons checkout.

**Phase 2 — Confirm (PostgreSQL transaction):**
On `/api/bookings`, the server re-validates the Redis lock is still owned by
the caller, then runs `UPDATE seats SET status='BOOKED' WHERE seat_id = ANY(...)
AND status='AVAILABLE'` inside a DB transaction — the final backstop even if
two requests somehow raced past the Redis check.

**This is integration-tested, not just claimed.** `tests/concurrency.test.js`
fires two simultaneous lock requests at the same seat via `Promise.all` and
asserts exactly one succeeds. Run with `npm test`.

## Real-Time Features (Socket.io)

Three separate event channels, all from `services/eventService.js`:
1. **Personal confirmation** — `booking:confirmed` / `booking:cancelled` to
   room `user:{userId}` → drives the toast the booking owner sees
2. **Live seat-map updates** — `seat:update` to room `show:{showId}` → seats
   gray out for everyone else viewing that show's booking page, in real time,
   the instant they're locked or booked (client joins/leaves the room as they
   enter/exit the booking page)
3. **Admin live feed** — `bookings:feed` broadcast globally → powers the
   real-time activity stream on `/admin`

## AI Recommendation Approach

`services/recommendationService.js` calls the **Groq API** (Llama 3.3 70B):
pulls the user's booking history by genre + global booking trends, sends it
as context, and returns ranked recommendations with natural-language reasons.
**Automatic fallback** to a local hybrid scorer
(`0.5×genre_affinity + 0.35×popularity + 0.15×rating`) if `GROQ_API_KEY` is
missing or the call fails — the endpoint never breaks.

## Real Movie Data (TMDB)

- `scripts/fetch-now-playing.js` — pulls TMDB's live "Now Playing" list per
  region, upserts real movies with real posters/ratings, and auto-generates
  bookable shows + seats for each. Re-runnable to keep the catalog current.
- `scripts/fetch-posters.js` — simpler variant that just backfills posters
  for whatever titles already exist in the `movies` table.

Neither script is called on the live request path — posters are fetched
once and cached in the DB, keeping normal page loads fast.

## Admin Dashboard

Protected behind `requireAdmin` (checks `is_admin` on the JWT):
- **Overview** — confirmed bookings, cancellations, total revenue, users, movies, shows
- **Revenue by movie** — aggregated from confirmed bookings
- **Seat occupancy by show** — booked ÷ total seats, shown as a progress bar
- **Recent bookings** — last 20, with user/movie context
- **Live feed** — real-time stream of new bookings as they happen anywhere in
  the app, via the `bookings:feed` socket event

## Logging & Error Handling

- All requests logged via Winston (`logs/combined.log`, `logs/error.log`)
- All controllers wrapped in `asyncHandler` → errors funnel to a single `errorHandler` middleware
- `AppError` carries explicit HTTP status codes: `400` validation, `401` auth,
  `403` forbidden (wrong owner / non-admin), `404` not found, `409` conflict
- Groq API failures are logged but never surface as a 500

## Testing

\```bash
npm test
\```
Jest + Supertest integration tests against your real Postgres/Redis (not
mocks). Each test creates isolated `__TEST_*`-prefixed fixtures and tears
them down afterward — safe to run without touching seeded demo data. Covers:
simultaneous same-seat lock contention, simultaneous different-seat locks,
booking an already-booked seat, booking without a valid lock, full
lock→book→cancel→re-lock lifecycle, double-cancellation rejection, and
per-seat-type price calculation.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `emitSeatUpdate is not a function` | `services/eventService.js` is missing `emitSeatUpdate` from its `module.exports` — add it (see `docs/SYSTEM_DESIGN.md` §8 for the full file) |
| `GROQ_API_KEY not set` warning | Check `.env` has `GROQ_API_KEY=gsk_...` (no quotes), restart server |
| `Groq API returned 404: model_not_found` | Confirm `GROQ_MODEL` is valid, e.g. `llama-3.3-70b-versatile` |
| No poster images showing | Run `node scripts/fetch-now-playing.js` or `fetch-posters.js`; confirm `TMDB_API_KEY` is set; clear cache: `redis-cli DEL movies:with_shows` |
| `column "poster_url"/"seat_type"/"password_hash"/"is_admin" does not exist` | Run the matching `sql/migration_*.sql` file for whichever feature you added most recently |
| Movies/shows appear duplicated | Add the `UNIQUE` constraints from Setup step 3, then dedupe with `DELETE FROM movies WHERE movie_id NOT IN (SELECT MIN(movie_id) FROM movies GROUP BY title);` (same pattern for `shows`) |
| Seat numbers out of order (A1, A10, A11, A2...) | Confirm `models/seatModel.js` uses `ORDER BY row_label, (regexp_replace(seat_number, '[^0-9]', '', 'g'))::int` |
| `401 Authentication required` on booking endpoints | You need to log in first and include `Authorization: Bearer <token>` — these routes are protected now |
| Admin link/page not visible after promoting a user | Log out and log back in — `is_admin` is embedded in the JWT at login time |
| `One or more seats do not belong to this show` | Fetch fresh `seat_id`s from `GET /shows/:id/seats` — they're not the same across shows |
| Frontend shows "Internal server error" | Check the **backend terminal** for the real stack trace — the frontend only shows a generic message |
| `ECONNREFUSED` on Postgres/Redis | Confirm both are running: `psql -U postgres -c "SELECT 1;"`, `redis-cli ping` |
| CORS errors in browser console | Confirm `cors` middleware is enabled in `app.js` (`app.use(cors())`) |
