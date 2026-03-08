-- Migration to add grid_data for easier editing
ALTER TABLE puzzles 
ADD COLUMN IF NOT EXISTS grid_data JSONB;

-- Backfill grid_data if possible (best effort based on layout and word_order)
-- Note: This is an approximation since word_order was shuffled, but better than nothing for existing puzzles.
-- In reality, we'll just start saving it properly from now on.
