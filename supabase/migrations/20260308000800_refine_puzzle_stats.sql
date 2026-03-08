-- Migration: Refine puzzle stats (Add Adjusted Attempts)
-- Date: 2026-03-08

-- 1. Add median_adjusted_attempts and play_count columns
ALTER TABLE public.puzzles 
ADD COLUMN IF NOT EXISTS median_adjusted_attempts FLOAT8 DEFAULT 0,
ADD COLUMN IF NOT EXISTS play_count INTEGER DEFAULT 0;

-- 2. Update RPC function to calculate median of adjusted attempts
-- Adjusted Attempts = attempts + jsonb_array_length(hints_revealed)
CREATE OR REPLACE FUNCTION public.increment_puzzle_stats(p_id UUID, p_attempts INTEGER, p_seconds INTEGER, p_moves INTEGER)
RETURNS void AS $$
DECLARE
    v_median_attempts FLOAT8;
    v_median_seconds FLOAT8;
    v_median_moves FLOAT8;
    v_median_adjusted FLOAT8;
BEGIN
    -- Recalculate medians from user_progress for this puzzle
    SELECT 
        percentile_cont(0.5) WITHIN GROUP (ORDER BY attempts),
        percentile_cont(0.5) WITHIN GROUP (ORDER BY total_seconds_played),
        percentile_cont(0.5) WITHIN GROUP (ORDER BY move_count),
        percentile_cont(0.5) WITHIN GROUP (ORDER BY (attempts + COALESCE(jsonb_array_length(hints_revealed), 0)))
    INTO v_median_attempts, v_median_seconds, v_median_moves, v_median_adjusted
    FROM public.user_progress
    WHERE puzzle_id = p_id AND status = 'solved';

    -- Update the puzzles table
    UPDATE public.puzzles
    SET 
        median_attempts_to_solve = COALESCE(v_median_attempts, p_attempts::FLOAT8),
        median_time_to_solve = COALESCE(v_median_seconds, p_seconds::FLOAT8),
        median_moves_to_solve = COALESCE(v_median_moves, p_moves::FLOAT8),
        median_adjusted_attempts = COALESCE(v_median_adjusted, p_attempts::FLOAT8),
        solve_count = solve_count + 1
    WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Backfill stats for existing puzzles
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.puzzles LOOP
        UPDATE public.puzzles p
        SET median_adjusted_attempts = (
            SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY (attempts + COALESCE(jsonb_array_length(hints_revealed), 0)))
            FROM public.user_progress up
            WHERE up.puzzle_id = p.id AND up.status = 'solved'
        )
        WHERE p.id = r.id;
    END LOOP;
END;
$$;
