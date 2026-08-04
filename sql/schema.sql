-- Movie Ticket Booking System Schema

CREATE TABLE IF NOT EXISTS movies (
    movie_id      SERIAL PRIMARY KEY,
    title         VARCHAR(255) NOT NULL,
    genre         VARCHAR(100),
    language      VARCHAR(50),
    duration_mins INT,
    rating        NUMERIC(2,1) DEFAULT 0,
    poster_url    TEXT,
    is_now_showing BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS theatres (
    theatre_id  SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    city        VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS shows (
    show_id      SERIAL PRIMARY KEY,
    movie_id     INT NOT NULL REFERENCES movies(movie_id) ON DELETE CASCADE,
    theatre_id   INT NOT NULL REFERENCES theatres(theatre_id) ON DELETE CASCADE,
    screen_name  VARCHAR(50) NOT NULL,
    show_time    TIMESTAMP NOT NULL,
    price        NUMERIC(8,2) NOT NULL DEFAULT 200.00,
    total_seats  INT NOT NULL DEFAULT 60
);

-- One row per seat per show
CREATE TABLE IF NOT EXISTS seats (
    seat_id      SERIAL PRIMARY KEY,
    show_id      INT NOT NULL REFERENCES shows(show_id) ON DELETE CASCADE,
    seat_number  VARCHAR(10) NOT NULL,       -- e.g. A1, A2, B5
    status       VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE', -- AVAILABLE, BOOKED
    UNIQUE (show_id, seat_number)
);

CREATE TABLE IF NOT EXISTS users (
    user_id    SERIAL PRIMARY KEY,
    name       VARCHAR(255) NOT NULL,
    email      VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bookings (
    booking_id   SERIAL PRIMARY KEY,
    user_id      INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    show_id      INT NOT NULL REFERENCES shows(show_id) ON DELETE CASCADE,
    seat_ids     INT[] NOT NULL,             -- array of seats.seat_id
    total_amount NUMERIC(10,2) NOT NULL,
    status       VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED', -- CONFIRMED, CANCELLED
    created_at   TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shows_movie ON shows(movie_id);
CREATE INDEX IF NOT EXISTS idx_seats_show ON seats(show_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_show ON bookings(show_id);
