# Movie Ticket Booking System

A full-stack movie ticket booking application with Redis-based concurrency
control, PostgreSQL storage, real-time booking confirmation (Socket.io),
AI-powered recommendations (Groq), and a React frontend with real movie
posters (TMDB) and a realistic theatre seat map — similar in spirit to
BookMyShow.

## Architecture

Backend (MVC):
config/ -> DB & Redis connections
models/ -> Data access layer (SQL queries)
controllers/ -> Request handling + business logic
services/ -> Reusable logic: locking, caching, events, recommendations (Groq)
routes/ -> Express route definitions
middleware/ -> Error handling, async wrapper
sql/ -> schema.sql, seed.sql, migration files
scripts/ -> fetch-posters.js (TMDB poster fetcher)
docs/ -> API documentation, system design document

Frontend:
frontend/src/
api.js -> API client (calls backend)
AppContext.jsx -> shared user/socket/toast state
App.jsx -> React Router setup
components/ -> NavBar, MovieCard, SeatGrid, Toast
pages/ -> Home, Movies, MovieDetail, Shows, Booking, MyBookings

## Tech Stack

**Backend**
- Node.js + Express (REST API)
- PostgreSQL (`pg`) — primary data store
- Redis (`ioredis`) — caching + seat-locking (concurrency control)
- Socket.io — real-time booking confirmation events
- Groq API (Llama 3.3 70B) — AI movie recommendations, with local fallback
- Winston — logging

**Frontend**
- React (Vite)
- React Router — multi-page navigation (Home / Movies / Shows / My Bookings)
- Socket.io client — live booking confirmation toasts
- TMDB API — real movie posters (fetched into the DB via a script, not called live from the frontend)
- Custom theatre-style seat map — rows, center aisle, screen indicator, and
  distinct seat types (Regular / Premium / Recliner / Accessible)

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
of dropping everything:
\```bash
psql -U postgres -d ticket_booking -f sql/migration_add_posters.sql
psql -U postgres -d ticket_booking -f sql/migration_add_seat_types.sql
\```
Then add the uniqueness constraints that prevent duplicate seed data on
re-runs (only needed once, skip if already applied):
\```bash
psql -U postgres -d ticket_booking -c "ALTER TABLE movies ADD CONSTRAINT movies_title_unique UNIQUE (title);"
psql -U postgres -d ticket_booking -c "ALTER TABLE shows ADD CONSTRAINT shows_unique_slot UNIQUE (movie_id, theatre_id, screen_name, show_time);"
\```

### 4. Fetch real movie posters from TMDB
\```bash
node scripts/fetch-posters.js
\```
Looks up each seeded movie (Inception, The Dark Knight, Interstellar,
Parasite, La La Land, Oppenheimer, Dune, Spider-Man: Into the Spider-Verse,
Whiplash, Knives Out) on TMDB and saves the real poster URL + rating.

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

## Using the App

- **Home** (`/`) — currently-showing movies with real posters + ratings
- **Movies** (`/movies`) — full catalog with genre filter
- **Movie detail** (`/movies/:id`) — poster, info, showtimes grouped by theatre
- **Shows** (`/shows`) — flat list of every scheduled show across all movies
- **Booking** (`/book/:showId`) — realistic theatre seat map → lock seats → confirm booking
- **My Bookings** (`/my-bookings`) — booking history + cancel

A live toast notification appears the instant a booking is confirmed
(Socket.io), separate from the page's own success message.

### Theatre Seat Map

Each show has an 8-row (A–H) x 12-seat layout with a center aisle and a
curved "SCREEN" indicator at the top, generated in `sql/seed.sql`:

| Rows | Seat Type | Look |
|---|---|---|
| A, B | Regular | tan fill |
| A1, A12 (aisle ends) | Accessible (♿) | green fill, circular |
| C, D, E | Premium | gold fill |
| F, G, H | Recliner | blue fill, larger button |

Seat state (available / selected / locked-by-you / booked) is layered on top
of the type color, so you can tell both *what kind* of seat it is and
*whether you can book it* at a glance. The full legend is shown under the
seat map on the booking page.

## Testing with Postman

Import `Movie_Ticket_Booking.postman_collection.json`. It covers the 7 core
required APIs. The additional endpoints added for the frontend (movie detail,
all shows, user bookings) can be tested the same way — see `docs/API_DOCUMENTATION.md`.

**Recommended order** (booking is stateful):
1. Get Movies and Shows → note a `show_id`
2. Get Available Seats → note `AVAILABLE` `seat_id`s (unique per row, always
   fetch fresh — don't assume IDs are the same across shows)
3. Lock Seats
4. Book Tickets → save the returned `booking_id`
5. Cancel Booking / Booking Confirmation Event
6. AI Movie Recommendation

## API Overview

| # | Method | Endpoint | Purpose |
|---|--------|----------|---------|
| 1 | GET | `/api/movies` | Movies + shows (Redis cached, 300s TTL) |
| 2 | GET | `/api/shows/:show_id/seats` | Seat availability, row/type included (Redis cached, 30s TTL) |
| 3 | POST | `/api/shows/:show_id/lock-seats` | Lock seats before booking (Redis, TTL) |
| 3b| POST | `/api/shows/:show_id/unlock-seats` | Manually release a lock (helper) |
| 4 | POST | `/api/bookings` | Confirm booking (validates lock, DB transaction) |
| 5 | PATCH | `/api/bookings/:booking_id/cancel` | Cancel booking, free seats |
| 6 | GET | `/api/bookings/:booking_id/confirmation` | Re-emit real-time confirmation event |
| 7 | GET | `/api/recommendations/:user_id` | AI movie recommendations (Groq) |
| — | GET | `/api/movies/:movie_id` | Single movie + showtimes (frontend detail page) |
| — | GET | `/api/shows` | Flat list of all shows (frontend Shows page) |
| — | GET | `/api/users/:user_id/bookings` | Booking history (frontend My Bookings page) |

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
AND status='AVAILABLE'` inside a DB transaction. This row-level guard is the
final backstop — even if two requests somehow raced past the Redis check, only
one can flip a seat from AVAILABLE to BOOKED at the database level.

## AI Recommendation Approach

`services/recommendationService.js` calls the **Groq API** (Llama 3.3 70B):
1. Pulls the user's booking history by genre + global booking trends from PostgreSQL
2. Sends that as context to Groq, asking it to rank movies with short natural-language reasons
3. Parses and returns Groq's JSON response
4. **Automatic fallback:** if `GROQ_API_KEY` is missing or the call fails, falls
   back to a local hybrid scorer (`0.5×genre_affinity + 0.35×popularity + 0.15×rating`)
   so the endpoint never breaks

## Real Movie Posters (TMDB)

`scripts/fetch-posters.js` is a one-time (or re-runnable) script — not called
live by the app — that looks up each movie by title on TMDB's free API and
saves the real poster image URL + TMDB rating into the `movies` table. This
keeps the running app fast (no external API call on every page load) while
still showing genuine, correctly-licensed poster artwork via TMDB's CDN.

## Real-time Feature

Socket.io emits `booking:confirmed` to the booking user's room and
`bookings:feed` globally whenever a booking is confirmed or cancelled. The
frontend listens for this and shows a live toast notification, separate from
the booking page's own confirmation message.

## Logging & Error Handling

- All requests logged via Winston (`logs/combined.log`, `logs/error.log`)
- All controllers wrapped in `asyncHandler` → errors funnel to a single `errorHandler` middleware
- Business-rule violations use `AppError` with explicit HTTP status codes (400/404/409)
- Groq API failures are logged but never surface as a 500 — recommendations always return successfully

## Troubleshooting

| Symptom | Fix |
|---|---|
| `GROQ_API_KEY not set` warning | Check `.env` has `GROQ_API_KEY=gsk_...` (no quotes), restart server |
| `Groq API returned 404: model_not_found` | Confirm `GROQ_MODEL` is valid, e.g. `llama-3.3-70b-versatile` |
| No poster images showing | Run `node scripts/fetch-posters.js`; confirm `TMDB_API_KEY` is set; clear cache: `redis-cli DEL movies:with_shows` |
| `column "poster_url" does not exist` | Run `sql/migration_add_posters.sql` |
| `column "seat_type" does not exist` | Run `sql/migration_add_seat_types.sql` |
| Movies/shows appear duplicated | `sql/seed.sql` was run more than once without unique constraints. Dedupe with `DELETE FROM movies WHERE movie_id NOT IN (SELECT MIN(movie_id) FROM movies GROUP BY title);` (same pattern for `shows`), then add the `UNIQUE` constraints shown in Setup step 3 |
| Seat numbers out of order (A1, A10, A11, A2...) | Text sort instead of numeric — confirm `models/seatModel.js` uses `ORDER BY row_label, (regexp_replace(seat_number, '[^0-9]', '', 'g'))::int` |
| All seats look the same color | Confirm `seat_type` is actually populated (`SELECT DISTINCT seat_type FROM seats;`) and that `App.css` has the `.seat-premium`, `.seat-recliner`, `.seat-accessible` fill-color rules |
| `One or more seats do not belong to this show` | Fetch fresh `seat_id`s from `GET /shows/:id/seats` — they're not the same across shows |
| Frontend shows "Internal server error" | Check the **backend terminal** for the real stack trace — the frontend only shows a generic message |
| `ECONNREFUSED` on Postgres/Redis | Confirm both are running: `psql -U postgres -c "SELECT 1;"`, `redis-cli ping` |
| CORS errors in browser console | Confirm `cors` middleware is enabled in `server.js` (`app.use(cors())`) |

