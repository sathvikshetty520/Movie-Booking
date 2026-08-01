Movie Ticket Booking Backend

Backend-only ticket booking system with Redis-based concurrency control, PostgreSQL storage, real-time booking confirmation (Socket.io), and an LLM-powered movie recommendation engine (Groq API, with automatic local fallback).

Architecture (MVC)
config/        -> DB & Redis connections
models/        -> Data access layer (SQL queries)
controllers/   -> Request handling + business logic
services/      -> Reusable logic: locking, caching, events, recommendations (Groq)
routes/        -> Express route definitions
middleware/    -> Error handling, async wrapper
sql/           -> schema.sql, seed.sql
docs/          -> API documentation, system design document
Tech Stack
Node.js + Express (REST API)
PostgreSQL (pg) - primary data store
Redis (ioredis) - caching + seat-locking (concurrency control)
Socket.io - real-time booking confirmation events
Groq API (Llama 3.3 70B) - AI movie recommendations, with local hybrid-scoring fallback
Winston - logging
Setup
Install dependencies
   npm install
Create .env from the example:
   cp .env.example .env

Fill in your DB/Redis credentials and your Groq API key (get one free at https://console.groq.com/keys):

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
Create the database and run schema + seed:
   createdb ticket_booking
   psql -U postgres -d ticket_booking -f sql/schema.sql
   psql -U postgres -d ticket_booking -f sql/seed.sql
Start Redis (locally or via Docker):
   docker run --name ticket-redis -p 6379:6379 -d redis
Run the server:
   npm run dev     # with nodemon (auto-restart on changes)
   npm start        # plain node

Server runs at http://localhost:3001 (or whatever PORT you set in .env). Health check: GET /health.

Testing with Postman

Import Movie_Ticket_Booking.postman_collection.json into Postman (Import button → select the file). It includes all 7 required APIs pre-built with correct methods, URLs, and JSON bodies, using collection variables (base_url, show_id, user_id, booking_id) so you don't have to retype IDs everywhere.

Recommended test order (the booking flow is stateful):

Get Movies and Shows → note a show_id
Get Available Seats → note AVAILABLE seat_ids for that show (seat IDs are unique per row, not per show — always read them from this response, don't assume 1,2,3...)
Lock Seats → same show_id + those seat_ids + a user_id
Book Tickets → same show_id/user_id/seat_ids → save the returned booking_id
Cancel Booking / Booking Confirmation Event → using that booking_id
AI Movie Recommendation → any user_id

Demonstrating concurrency control: open two requests with the same seat_ids but different user_ids and fire them close together — one succeeds, the other gets 409 Conflict. Good to show on camera for the demo video.

API Overview
#	Method	Endpoint	Purpose
1	GET	/api/movies	Movies + shows (Redis cached, 300s TTL)
2	GET	/api/shows/:show_id/seats	Seat availability (Redis cached, 30s TTL)
3	POST	/api/shows/:show_id/lock-seats	Lock seats before booking (Redis, TTL)
3b	POST	/api/shows/:show_id/unlock-seats	Manually release a lock (helper)
4	POST	/api/bookings	Confirm booking (validates lock, DB transaction)
5	PATCH	/api/bookings/:booking_id/cancel	Cancel booking, free seats
6	GET	/api/bookings/:booking_id/confirmation	Re-emit real-time confirmation event
7	GET	/api/recommendations/:user_id	AI movie recommendations (Groq)

Full request/response examples: see docs/API_DOCUMENTATION.md. System design, ER diagram, Redis usage and event flow: see docs/SYSTEM_DESIGN.md.

Concurrency Control Design (core of this assignment)

Two-phase booking prevents double-booking under concurrent requests:

Phase 1 — Lock (Redis): SET lock:show:{id}:seat:{id} {user_id} NX EX 120 NX makes this a single atomic test-and-set — only the first caller acquires the key; everyone else gets nil and is rejected with 409 Conflict. The lock auto-expires after 120s if the user abandons checkout.

Phase 2 — Confirm (PostgreSQL transaction): On /api/bookings, the server re-validates the Redis lock is still owned by the caller, then runs UPDATE seats SET status='BOOKED' WHERE seat_id = ANY(...) AND status='AVAILABLE' inside a DB transaction. The AND status='AVAILABLE' clause is an atomic row-level guard: even if two requests somehow raced past the Redis check (e.g. an expired lock), only one can flip a seat from AVAILABLE to BOOKED at the database level; the other's affected-row-count mismatch triggers a rollback and a 409 response.

This gives concurrency safety at both the cache layer (fast-fail for obviously taken seats) and the database layer (final source of truth), rather than relying on Redis alone.

AI Recommendation Approach

services/recommendationService.js calls the Groq API (Llama 3.3 70B) to generate personalized recommendations:

Pull the user's booking history by genre + global booking trends (seats booked per movie) from PostgreSQL.
Send that data as context to Groq, asking it to rank movies and return a short natural-language reason for each recommendation.
Parse and return Groq's JSON response.
Automatic fallback: if GROQ_API_KEY is missing or the API call fails for any reason, the service transparently falls back to a local hybrid scorer (score = 0.5*genre_affinity + 0.35*popularity + 0.15*rating) so the endpoint never breaks, even without network access to Groq.

The controller/route layer is unaware of which path served the response — the function signature recommendMoviesForUser(userId, topN) is identical either way.

Real-time Feature

Socket.io emits booking:confirmed to the booking user's room and bookings:feed globally whenever a booking is confirmed or cancelled — usable for a live "seat map" or admin dashboard. Example client:

javascript
const socket = io("http://localhost:3001");
socket.emit("join", userId);
socket.on("booking:confirmed", (data) => console.log("Booking confirmed:", data));
Logging & Error Handling
All requests logged via Winston (logs/combined.log, logs/error.log)
All controllers wrapped in asyncHandler -> errors funnel to a single errorHandler middleware
Business-rule violations use AppError with explicit HTTP status codes (400/404/409)
Groq API failures are logged (ERROR: Groq API call failed, using local fallback: ...) and never surface as a 500 to the client — recommendations always return successfully
Troubleshooting
Symptom	Fix
GROQ_API_KEY not set warning	Check .env has GROQ_API_KEY=gsk_... (no quotes) and restart the server
Groq API returned 404: model_not_found	Check GROQ_MODEL matches an available model, e.g. llama-3.3-70b-versatile
One or more seats do not belong to this show	You used stale/wrong seat_ids — always fetch seat IDs from GET /shows/:id/seats first, they are not the same across shows
ECONNREFUSED on Postgres/Redis	Confirm both services are running (psql -U postgres -c "SELECT 1;", redis-cli ping)
.env not loading	Confirm you're running npm run dev from inside the project root (same folder as package.json)