-- Migration: Refactor user_progress status and add play_count logic
-- Date: 2026-03-08

-- 1. Ensure play_count exists on puzzles
ALTER TABLE public.puzzles 
ADD COLUMN IF NOT EXISTS play_count INTEGER DEFAULT 0;

-- 2. Add boolean flags to user_progress
ALTER TABLE public.user_progress 
ADD COLUMN IF NOT EXISTS is_solved BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_skipped BOOLEAN DEFAULT false;

-- 3. Migrate existing data from status column
UPDATE public.user_progress 
SET 
    is_solved = (status = 'solved'),
    is_skipped = (status = 'skipped');

-- 4. Redefine status as a generated column (or update it via trigger for backward compatibility)
-- Note: Dropping and recreating status as a generated column to ensure it always reflects the booleans
ALTER TABLE public.user_progress DROP COLUMN status;
ALTER TABLE public.user_progress ADD COLUMN status TEXT GENERATED ALWAYS AS (
    CASE 
        WHEN is_solved THEN 'solved'
        WHEN is_skipped THEN 'skipped'
        ELSE 'in_progress'
    END
) STORED;

-- 5. Create RPC function to increment play count
CREATE OR REPLACE FUNCTION public.increment_play_count(p_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE public.puzzles
    SET play_count = play_count + 1
    WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
