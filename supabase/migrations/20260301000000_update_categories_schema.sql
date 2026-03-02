-- Update the `categories` column if it isn't already JSONB
ALTER TABLE puzzles
ALTER COLUMN categories TYPE jsonb USING categories::jsonb;

-- Optional: If you need to migrate existing data from text arrays to JSONB arrays of objects
/*
UPDATE puzzles
SET categories = (
  SELECT jsonb_agg(
    jsonb_build_object(
      'words', cat,
      'description', ''
    )
  )
  FROM jsonb_array_elements(categories) AS cat
)
WHERE jsonb_typeof(categories->0) = 'array';
*/
