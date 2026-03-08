-- Migration: Deduplicate user_progress and enforce UNIQUE(user_id, puzzle_id)
-- Date: 2026-03-07

-- 1. Identify and delete duplicates, keeping only the "best" record
-- Priority: solved > skipped > in_progress
WITH prioritized_rows AS (
    SELECT 
        id,
        user_id,
        puzzle_id,
        ROW_NUMBER() OVER (
            PARTITION BY user_id, puzzle_id 
            ORDER BY 
                CASE status 
                    WHEN 'solved' THEN 1 
                    WHEN 'skipped' THEN 2 
                    ELSE 3 
                END ASC,
                updated_at DESC
        ) as rank
    FROM public.user_progress
)
DELETE FROM public.user_progress
WHERE id IN (
    SELECT id 
    FROM prioritized_rows 
    WHERE rank > 1
);

-- 2. Explicitly add the UNIQUE constraint if it's somehow missing or bypassed
-- Note: Some environments might need to drop the constraint first if it's corrupted
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'user_progress_user_id_puzzle_id_key'
    ) THEN
        ALTER TABLE public.user_progress 
        ADD CONSTRAINT user_progress_user_id_puzzle_id_key UNIQUE (user_id, puzzle_id);
    END IF;
END $$;
