INSERT INTO movies (title, genre, language, duration_mins, rating) VALUES
('Interstellar Odyssey', 'Sci-Fi', 'English', 148, 4.7),
('The Last Heist', 'Action', 'English', 132, 4.3),
('Chai and Chords', 'Drama', 'Hindi', 120, 4.5)
ON CONFLICT DO NOTHING;

INSERT INTO theatres (name, city) VALUES
('PVR Forum Mall', 'Bengaluru'),
('INOX Garuda', 'Bengaluru')
ON CONFLICT DO NOTHING;

INSERT INTO shows (movie_id, theatre_id, screen_name, show_time, price, total_seats) VALUES
(1, 1, 'Screen 1', NOW() + interval '1 day', 250.00, 10),
(2, 2, 'Screen 3', NOW() + interval '2 day', 220.00, 10),
(3, 1, 'Screen 2', NOW() + interval '1 day 3 hour', 180.00, 10)
ON CONFLICT DO NOTHING;

-- Generate 10 seats (A1-A10) for each show
INSERT INTO seats (show_id, seat_number, status)
SELECT s.show_id, 'A' || gs, 'AVAILABLE'
FROM shows s, generate_series(1, 10) gs
ON CONFLICT DO NOTHING;

INSERT INTO users (name, email) VALUES
('Asha Rao', 'asha@example.com'),
('Karan Mehta', 'karan@example.com')
ON CONFLICT DO NOTHING;
