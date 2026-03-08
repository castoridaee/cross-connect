-- Migration: Add puzzle stats columns (Median) including Moves and increment RPC
-- Date: 2026-03-08

-- 1. Add tracking columns to puzzles table
ALTER TABLE public.puzzles 
ADD COLUMN IF NOT EXISTS solve_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS median_attempts_to_solve FLOAT8 DEFAULT 0,
ADD COLUMN IF NOT EXISTS median_time_to_solve FLOAT8 DEFAULT 0,
ADD COLUMN IF NOT EXISTS median_moves_to_solve FLOAT8 DEFAULT 0;

-- 2. Create RPC function to update stats using medians
-- This function recalculates the median from the user_progress table for the specific puzzle.
CREATE OR REPLACE FUNCTION public.increment_puzzle_stats(p_id UUID, p_attempts INTEGER, p_seconds INTEGER, p_moves INTEGER)
RETURNS void AS $$
DECLARE
    v_median_attempts FLOAT8;
    v_median_seconds FLOAT8;
    v_median_moves FLOAT8;
BEGIN
    -- Recalculate medians from user_progress for this puzzle
    SELECT 
        percentile_cont(0.5) WITHIN GROUP (ORDER BY attempts),
        percentile_cont(0.5) WITHIN GROUP (ORDER BY total_seconds_played),
        percentile_cont(0.5) WITHIN GROUP (ORDER BY move_count)
    INTO v_median_attempts, v_median_seconds, v_median_moves
    FROM public.user_progress
    WHERE puzzle_id = p_id AND status = 'solved';

    -- Update the puzzles table
    UPDATE public.puzzles
    SET 
        median_attempts_to_solve = COALESCE(v_median_attempts, p_attempts::FLOAT8),
        median_time_to_solve = COALESCE(v_median_seconds, p_seconds::FLOAT8),
        median_moves_to_solve = COALESCE(v_median_moves, p_moves::FLOAT8),
        solve_count = solve_count + 1
    WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
