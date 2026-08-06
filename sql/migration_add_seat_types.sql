-- Run this ONLY if you already created the database before this update.
-- If you're setting up fresh, just run schema.sql — it already includes these columns.

ALTER TABLE seats ADD COLUMN IF NOT EXISTS row_label VARCHAR(2);
ALTER TABLE seats ADD COLUMN IF NOT EXISTS seat_type VARCHAR(20) DEFAULT 'REGULAR';

-- Backfill row_label from seat_number for any existing rows (e.g. "A1" -> "A")
UPDATE seats SET row_label = LEFT(seat_number, 1) WHERE row_label IS NULL;