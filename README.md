# Movie Ticket Booking Backend

Backend-only ticket booking system with Redis-based concurrency control, PostgreSQL storage,
real-time booking confirmation (Socket.io), and an AI-style movie recommendation engine.

## Architecture (MVC)

```
config/        -> DB & Redis connections
models/        -> Data access layer (SQL queries)
controllers/   -> Request handling + business logic
services/       -> Reusable logic: locking, caching, events, recommendations
routes/        -> Express route definitions
middleware/    -> Error handling, async wrapper
sql/           -> schema.sql, seed.sql
```

## Tech Stack
- Node.js + Express (REST API)
- PostgreSQL (`pg`) - primary data store
- Redis (`ioredis`) - caching + seat-locking (concurrency control)
- Socket.io - real-time booking confirmation events
- Winston - logging

## Setup

1. Install dependencies
   ```
   npm install
   ```

2. Create `.env` from the example and fill in your DB/Redis credentials:
   ```
   cp .env.example .env
   ```

3. Create the database and run schema + seed:
   ```
   createdb ticket_booking
   psql -U postgres -d ticket_booking -f sql/schema.sql
   psql -U postgres -d ticket_booking -f sql/seed.sql
   ```

4. Start Redis (locally or via Docker):
   ```
   docker run -p 6379:6379 -d redis
   ```

5. Run the server:
   ```
   npm run dev     # with nodemon
   npm start        # plain node
   ```

Server runs at `http://localhost:3000`. Health check: `GET /health`.

## API Overview

| # | Method | Endpoint | Purpose |
|---|--------|----------|---------|
| 1 | GET | `/api/movies` | Movies + shows (Redis cached) |
| 2 | GET | `/api/shows/:show_id/seats` | Seat availability (Redis cached) |
| 3 | POST | `/api/shows/:show_id/lock-seats` | Lock seats before booking (Redis, TTL) |
| 3b| POST | `/api/shows/:show_id/unlock-seats` | Manually release a lock |
| 4 | POST | `/api/bookings` | Confirm booking (validates lock, DB transaction) |
| 5 | PATCH | `/api/bookings/:booking_id/cancel` | Cancel booking, free seats |
| 6 | GET | `/api/bookings/:booking_id/confirmation` | Re-emit real-time confirmation event |
| 7 | GET | `/api/recommendations/:user_id` | AI movie recommendations |

Full request/response examples: see `docs/API_DOCUMENTATION.md`.
System design, ER diagram, Redis usage and event flow: see `docs/SYSTEM_DESIGN.md`.

## Concurrency Control Design (core of this assignment)

Two-phase booking prevents double-booking under concurrent requests:

**Phase 1 — Lock (Redis):**
`SET lock:show:{id}:seat:{id} {user_id} NX EX 120`
`NX` guarantees only the first caller acquires the key; others get `nil` and are rejected
with `409 Conflict`. Lock auto-expires after 120s if the user abandons checkout.

**Phase 2 — Confirm (PostgreSQL transaction):**
On `/api/bookings`, the server re-validates the Redis lock is still owned by the caller, then
runs `UPDATE seats SET status='BOOKED' WHERE seat_id = ANY(...) AND status='AVAILABLE'`
inside a DB transaction. The `AND status='AVAILABLE'` clause is an atomic row-level guard:
even if two requests somehow raced past the Redis check, only one can flip a seat from
AVAILABLE to BOOKED at the database level; the other's affected-row-count mismatch triggers
a rollback and a `409` response.

This gives concurrency safety at both the cache layer (fast-fail for obviously-taken seats)
and the database layer (final source of truth), rather than relying on Redis alone.

## AI Recommendation Approach

`services/recommendationService.js` implements a hybrid content + popularity scorer:
`score = 0.5 * genre_affinity(user) + 0.35 * normalized_popularity(movie) + 0.15 * rating`.
No external ML dependency is required, and the interface is designed so a real
model/microservice could replace `recommendMoviesForUser()` without touching the controller.

## Real-time Feature

Socket.io emits `booking:confirmed` to the booking user's room and `bookings:feed` globally
whenever a booking is confirmed or cancelled — usable for a live "seat map" or admin dashboard.

## Logging & Error Handling

- All requests logged via Winston (`logs/combined.log`, `logs/error.log`)
- All controllers wrapped in `asyncHandler` -> errors funnel to a single `errorHandler` middleware
- Business-rule violations use `AppError` with explicit HTTP status codes (400/404/409)
