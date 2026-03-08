-- Migration: Maintenance & Self-Healing Stats
-- Date: 2026-03-08
-- Purpose: 
-- 1. Adds DELETE support to ALL stats triggers (counts decrement when rows are removed)
-- 2. Consolidates engagement and solve stats into a robust "Multi-Stat" trigger
-- 3. Provides a master resync function to fix existing counts.

-- 1. Create the Master Recalculation Function
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
    -- Count Plays
    SELECT count(*) INTO v_play_count FROM public.user_progress WHERE puzzle_id = p_id;
    
    -- Count Solves
    SELECT count(*) INTO v_solve_count FROM public.user_progress WHERE puzzle_id = p_id AND is_solved = true;
    
    -- Count Likes
    SELECT count(*) INTO v_likes_count FROM public.user_progress WHERE puzzle_id = p_id AND is_liked = true;
    
    -- Count Shares
    SELECT count(*) INTO v_share_count FROM public.user_progress WHERE puzzle_id = p_id AND has_shared = true;
    
    -- Count Clicks
    SELECT count(*) INTO v_author_clicks FROM public.user_progress WHERE puzzle_id = p_id AND has_clicked_author = true;

    -- Recalculate Medians (only for solved)
    SELECT 
        percentile_cont(0.5) WITHIN GROUP (ORDER BY attempts),
        percentile_cont(0.5) WITHIN GROUP (ORDER BY total_seconds_played),
        percentile_cont(0.5) WITHIN GROUP (ORDER BY move_count)
    INTO v_median_attempts, v_median_seconds, v_median_moves
    FROM public.user_progress
    WHERE puzzle_id = p_id AND is_solved = true;

    -- Update the puzzles table
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

-- 2. Master Sync Function to run on whole table
CREATE OR REPLACE FUNCTION public.recalculate_all_puzzle_stats()
RETURNS void AS $$
DECLARE
    p_id UUID;
BEGIN
    FOR p_id IN SELECT id FROM public.puzzles LOOP
        PERFORM public.recalculate_puzzle_stats(p_id);
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Unified Trigger Function for user_progress
CREATE OR REPLACE FUNCTION public.on_user_progress_change_master()
RETURNS TRIGGER AS $$
DECLARE
    v_puzzle_id UUID;
BEGIN
    v_puzzle_id := COALESCE(NEW.puzzle_id, OLD.puzzle_id);
    PERFORM public.recalculate_puzzle_stats(v_puzzle_id);
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Apply the Unified Trigger
DROP TRIGGER IF EXISTS on_puzzle_play_start ON public.user_progress;
DROP TRIGGER IF EXISTS on_puzzle_like_change ON public.user_progress;
DROP TRIGGER IF EXISTS on_puzzle_engagement_change ON public.user_progress;
DROP TRIGGER IF EXISTS on_user_progress_master_sync ON public.user_progress;

CREATE TRIGGER on_user_progress_master_sync
AFTER INSERT OR UPDATE OR DELETE ON public.user_progress
FOR EACH ROW EXECUTE FUNCTION public.on_user_progress_change_master();


-- 5. Run the resync immediately once to fix current state
SELECT public.recalculate_all_puzzle_stats();
