-- Migration to make existing puzzles public and set default to true
UPDATE puzzles SET is_published = true WHERE is_published = false OR is_published IS NULL;

ALTER TABLE puzzles ALTER COLUMN is_published SET DEFAULT true;
