-- Migration: Clean Slate (Drop all stale triggers and functions)
-- Date: 2026-03-08
-- Purpose: Eliminated "phantom" errors by dropping anything that might refer to old columns.

-- 1. Drop ALL triggers on user_progress (Cleanup the slate)
DROP TRIGGER IF EXISTS on_puzzle_play_start ON public.user_progress;
DROP TRIGGER IF EXISTS on_puzzle_like_change ON public.user_progress;
DROP TRIGGER IF EXISTS on_puzzle_engagement_change ON public.user_progress;
DROP TRIGGER IF EXISTS on_user_progress_master_sync ON public.user_progress;
DROP TRIGGER IF EXISTS update_puzzle_stats_trigger ON public.user_progress;
DROP TRIGGER IF EXISTS trigger_update_puzzle_stats ON public.user_progress;
DROP TRIGGER IF EXISTS on_user_progress_change ON public.user_progress;

-- 2. Drop ALL triggers on puzzles (just in case)
DROP TRIGGER IF EXISTS on_puzzle_change ON public.puzzles;
DROP TRIGGER IF EXISTS refresh_puzzle_stats_trigger ON public.puzzles;

-- 3. Drop all potential legacy functions with CASCADE
-- This ensures that any dependent triggers we missed are also removed.
DROP FUNCTION IF EXISTS public.handle_puzzle_play_increment() CASCADE;
DROP FUNCTION IF EXISTS public.handle_puzzle_like_sync() CASCADE;
DROP FUNCTION IF EXISTS public.handle_puzzle_engagement_sync() CASCADE;
DROP FUNCTION IF EXISTS public.on_user_progress_change_master() CASCADE;
DROP FUNCTION IF EXISTS public.update_puzzle_stats() CASCADE;
DROP FUNCTION IF EXISTS public.update_avg_stats() CASCADE;
DROP FUNCTION IF EXISTS public.increment_puzzle_stats(UUID, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.increment_puzzle_stats(UUID, INTEGER, INTEGER, INTEGER) CASCADE;

-- 4. RE-APPLY the Master Trigger and Function (Cleanly)
-- Function to handle play_count increments, like sync, and medians
CREATE OR REPLACE FUNCTION public.recalculate_puzzle_stats(p_id UUID)
RETURNS void AS $$
DECLARE
    v_play_count INTEGER;
    v_solve_count INTEGER;
    v_likes_count INTEGER;
    v_share_count INTEGER;
    v_author_clicks INTEGER;
    v_median_attempts FLOAT8;
    v_median_seconds FLOAT8;
    v_median_moves FLOAT8;
BEGIN
    SELECT count(*) INTO v_play_count FROM public.user_progress WHERE puzzle_id = p_id;
    SELECT count(*) INTO v_solve_count FROM public.user_progress WHERE puzzle_id = p_id AND is_solved = true;
    SELECT count(*) INTO v_likes_count FROM public.user_progress WHERE puzzle_id = p_id AND is_liked = true;
    SELECT count(*) INTO v_share_count FROM public.user_progress WHERE puzzle_id = p_id AND has_shared = true;
    SELECT count(*) INTO v_author_clicks FROM public.user_progress WHERE puzzle_id = p_id AND has_clicked_author = true;

    SELECT 
        percentile_cont(0.5) WITHIN GROUP (ORDER BY attempts),
        percentile_cont(0.5) WITHIN GROUP (ORDER BY total_seconds_played),
        percentile_cont(0.5) WITHIN GROUP (ORDER BY move_count)
    INTO v_median_attempts, v_median_seconds, v_median_moves
    FROM public.user_progress
    WHERE puzzle_id = p_id AND is_solved = true;

    UPDATE public.puzzles
    SET 
        play_count = COALESCE(v_play_count, 0),
        solve_count = COALESCE(v_solve_count, 0),
        likes_count = COALESCE(v_likes_count, 0),
        share_count = COALESCE(v_share_count, 0),
        author_profile_clicks = COALESCE(v_author_clicks, 0),
        median_attempts_to_solve = COALESCE(v_median_attempts, 0),
        median_time_to_solve = COALESCE(v_median_seconds, 0),
        median_moves_to_solve = COALESCE(v_median_moves, 0)
    WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.on_user_progress_change_master()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM public.recalculate_puzzle_stats(COALESCE(NEW.puzzle_id, OLD.puzzle_id));
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_user_progress_master_sync
AFTER INSERT OR UPDATE OR DELETE ON public.user_progress
FOR EACH ROW EXECUTE FUNCTION public.on_user_progress_change_master();

-- 5. Final resync
SELECT public.recalculate_all_puzzle_stats();
