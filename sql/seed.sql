-- Movies: real, well-known titles across genres so TMDB poster lookup works accurately.
-- Run scripts/fetch-posters.js after seeding to populate real poster images + ratings.
INSERT INTO movies (title, genre, language, duration_mins, rating, is_now_showing) VALUES
('Inception', 'Sci-Fi', 'English', 148, 8.4, TRUE),
('The Dark Knight', 'Action', 'English', 152, 9.0, TRUE),
('Interstellar', 'Sci-Fi', 'English', 169, 8.7, TRUE),
('Parasite', 'Thriller', 'Korean', 132, 8.5, TRUE),
('La La Land', 'Musical', 'English', 128, 8.0, TRUE),
('Oppenheimer', 'Drama', 'English', 180, 8.3, TRUE),
('Dune', 'Sci-Fi', 'English', 155, 8.0, TRUE),
('Spider-Man: Into the Spider-Verse', 'Animation', 'English', 117, 8.4, TRUE),
('Whiplash', 'Drama', 'English', 106, 8.5, TRUE),
('Knives Out', 'Mystery', 'English', 130, 7.9, TRUE)
ON CONFLICT (title) DO NOTHING;

INSERT INTO theatres (name, city) VALUES
('PVR Forum Mall', 'Bengaluru'),
('INOX Garuda', 'Bengaluru'),
('Cinepolis Royal Meenakshi', 'Bengaluru')
ON CONFLICT DO NOTHING;

-- Multiple shows per movie, spread across theatres/screens/times
INSERT INTO shows (movie_id, theatre_id, screen_name, show_time, price, total_seats)
SELECT m.movie_id, t.theatre_id, s.screen, NOW() + s.offset_interval, s.price, 10
FROM (
  VALUES
    ('Inception', 1, 'Screen 1', interval '1 day', 250.00),
    ('Inception', 2, 'Screen 2', interval '1 day 3 hour', 220.00),
    ('The Dark Knight', 1, 'Screen 2', interval '1 day', 260.00),
    ('The Dark Knight', 3, 'Screen 1', interval '2 day', 240.00),
    ('Interstellar', 1, 'Screen 3', interval '1 day 4 hour', 250.00),
    ('Parasite', 2, 'Screen 1', interval '1 day', 200.00),
    ('La La Land', 3, 'Screen 2', interval '2 day', 210.00),
    ('Oppenheimer', 1, 'Screen 1', interval '1 day 2 hour', 280.00),
    ('Oppenheimer', 2, 'Screen 3', interval '2 day 1 hour', 280.00),
    ('Dune', 3, 'Screen 1', interval '1 day', 230.00),
    ('Spider-Man: Into the Spider-Verse', 2, 'Screen 2', interval '1 day 1 hour', 200.00),
    ('Whiplash', 1, 'Screen 3', interval '2 day', 190.00),
    ('Knives Out', 3, 'Screen 2', interval '1 day 5 hour', 210.00)
) AS s(movie_title, theatre_id, screen, offset_interval, price)
JOIN movies m ON m.title = s.movie_title
JOIN theatres t ON t.theatre_id = s.theatre_id
ON CONFLICT (movie_id, theatre_id, screen_name, show_time) DO NOTHING;

-- Realistic theatre layout: 8 rows (A-H) x 12 seats, with a center aisle (handled visually
-- on the frontend). Row-based seat types: A/B = Regular (with 2 accessible seats at the aisle
-- ends of row A), C/D/E = Premium, F/G/H = Recliner (back rows, priciest).
INSERT INTO seats (show_id, seat_number, row_label, seat_type, status)
SELECT
  s.show_id,
  r.row_label || col.n,
  r.row_label,
  CASE
    WHEN r.row_label = 'A' AND col.n IN (1, 12) THEN 'ACCESSIBLE'
    WHEN r.row_label IN ('A', 'B') THEN 'REGULAR'
    WHEN r.row_label IN ('C', 'D', 'E') THEN 'PREMIUM'
    ELSE 'RECLINER'
  END,
  'AVAILABLE'
FROM shows s
CROSS JOIN (VALUES ('A'), ('B'), ('C'), ('D'), ('E'), ('F'), ('G'), ('H')) AS r(row_label)
CROSS JOIN generate_series(1, 12) AS col(n)
ON CONFLICT DO NOTHING;

INSERT INTO users (name, email) VALUES
('Asha Rao', 'asha@example.com'),
('Karan Mehta', 'karan@example.com')
ON CONFLICT DO NOTHING;