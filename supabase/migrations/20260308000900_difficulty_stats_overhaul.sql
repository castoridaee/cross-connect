-- Migration: Overhaul difficulty stats with Hybrid Methodology and User-Refined Scaling
-- Date: 2026-03-08
-- Purpose: Fixes "column not found" error by replacing stale triggers and implements the Smoothed Difficulty Formula.

-- 1. CLEAN SLATE: Drop all triggers that might refer to old columns
-- This resolves the 400 Bad Request error in recordPuzzlePlay
DROP TRIGGER IF EXISTS on_user_progress_master_sync ON public.user_progress;
DROP TRIGGER IF EXISTS on_user_progress_sync ON public.user_progress;
DROP FUNCTION IF EXISTS public.recalculate_puzzle_stats(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.on_user_progress_change_master() CASCADE;

-- 2. Schema Updates
ALTER TABLE public.user_progress 
ADD COLUMN IF NOT EXISTS hints_revealed_count INTEGER DEFAULT 0;

-- Update existing user_progress rows
UPDATE public.user_progress 
SET hints_revealed_count = COALESCE(jsonb_array_length(hints_revealed), 0);

-- Trigger to keep hints_revealed_count in sync
CREATE OR REPLACE FUNCTION public.sync_hints_count()
RETURNS TRIGGER AS $$
BEGIN
    NEW.hints_revealed_count := COALESCE(jsonb_array_length(NEW.hints_revealed), 0);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_sync_hints_count ON public.user_progress;
CREATE TRIGGER tr_sync_hints_count
BEFORE INSERT OR UPDATE OF hints_revealed ON public.user_progress
FOR EACH ROW EXECUTE FUNCTION public.sync_hints_count();

-- 3. Update puzzles table columns
DO $$ 
BEGIN
    -- Rename median_attempts if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='puzzles' AND column_name='median_attempts_to_solve') THEN
        ALTER TABLE public.puzzles RENAME COLUMN median_attempts_to_solve TO trimmean_attempts_to_solve;
    ELSE
        ALTER TABLE public.puzzles ADD COLUMN IF NOT EXISTS trimmean_attempts_to_solve FLOAT8 DEFAULT 0;
    END IF;
END $$;

ALTER TABLE public.puzzles DROP COLUMN IF EXISTS median_adjusted_attempts;

ALTER TABLE public.puzzles
ADD COLUMN IF NOT EXISTS trimmean_hints_used FLOAT8 DEFAULT 0,
ADD COLUMN IF NOT EXISTS difficulty_score FLOAT8 DEFAULT 0;

-- 4. Create the Final Sync Function
-- Hybrid: 20% Trimmed Mean (Attempts, Hints) + Median (Time, Moves)
-- Difficulty: ((BaseScore) / (SolveRate + 1.0)) / 5.0
CREATE OR REPLACE FUNCTION public.recalculate_puzzle_stats_v3(p_id UUID)
RETURNS void AS $$
DECLARE
    v_play_count INTEGER;
    v_solve_count INTEGER;
    v_likes_count INTEGER;
    v_share_count INTEGER;
    v_author_clicks INTEGER;
    v_tm_attempts FLOAT8;
    v_tm_hints FLOAT8;
    v_med_seconds FLOAT8;
    v_med_moves FLOAT8;
    v_solve_rate FLOAT8;
    v_base_score FLOAT8;
BEGIN
    -- 1. Basic Counts
    SELECT count(*) INTO v_play_count FROM public.user_progress WHERE puzzle_id = p_id;
    SELECT count(*) INTO v_solve_count FROM public.user_progress WHERE puzzle_id = p_id AND is_solved = true;
    SELECT count(*) INTO v_likes_count FROM public.user_progress WHERE puzzle_id = p_id AND is_liked = true;
    SELECT count(*) INTO v_share_count FROM public.user_progress WHERE puzzle_id = p_id AND has_shared = true;
    SELECT count(*) INTO v_author_clicks FROM public.user_progress WHERE puzzle_id = p_id AND has_clicked_author = true;

    -- 2. Median Calculations (Time, Moves)
    SELECT 
        percentile_cont(0.5) WITHIN GROUP (ORDER BY total_seconds_played),
        percentile_cont(0.5) WITHIN GROUP (ORDER BY move_count)
    INTO v_med_seconds, v_med_moves
    FROM public.user_progress
    WHERE puzzle_id = p_id AND is_solved = true;

    -- 3. Trimmed Mean Calculations (Attempts, Hints)
    IF v_solve_count >= 5 THEN
        WITH ordered_stats AS (
            SELECT 
                attempts, 
                hints_revealed_count,
                ROW_NUMBER() OVER (ORDER BY (total_seconds_played + move_count + attempts)) as rn,
                count(*) OVER () as total_count
            FROM public.user_progress
            WHERE puzzle_id = p_id AND is_solved = true
        ),
        trimmed AS (
            SELECT * FROM ordered_stats
            WHERE rn > floor(total_count * 0.2) AND rn <= ceil(total_count * 0.8)
        )
        SELECT 
            avg(attempts), 
            avg(hints_revealed_count)
        INTO v_tm_attempts, v_tm_hints
        FROM trimmed;
    ELSE
        SELECT 
            avg(attempts), 
            avg(hints_revealed_count)
        INTO v_tm_attempts, v_tm_hints
        FROM public.user_progress
        WHERE puzzle_id = p_id AND is_solved = true;
    END IF;

    -- 4. Smoothed Difficulty Formula
    -- SolveRate = SolveCount / PlayCount
    v_solve_rate := CASE 
        WHEN COALESCE(v_play_count, 0) = 0 THEN 1.0
        ELSE (COALESCE(v_solve_count, 0)::FLOAT8 / v_play_count::FLOAT8)
    END;

    -- Base Score: Time/75 + Moves/30 + (Attempts-1) + Hints
    v_base_score := (
        (COALESCE(v_med_seconds, 120) / 75.0) + 
        (COALESCE(v_med_moves, 16) / 30.0) + 
        (COALESCE(v_tm_attempts, 1) - 1.0) + 
        COALESCE(v_tm_hints, 0)
    );

    -- New Formula: (Base / (SolveRate + 1.0)) / 5.0
    -- This means difficulty is scaled by a factor between 0.5 (100% solve rate) and 1.0 (0% solve rate)
    -- and then normalized by / 5.

    -- 5. Update the puzzles table
    UPDATE public.puzzles
    SET 
        play_count = COALESCE(v_play_count, 0),
        solve_count = COALESCE(v_solve_count, 0),
        likes_count = COALESCE(v_likes_count, 0),
        share_count = COALESCE(v_share_count, 0),
        author_profile_clicks = COALESCE(v_author_clicks, 0),
        trimmean_attempts_to_solve = COALESCE(v_tm_attempts, 1)::FLOAT8,
        median_time_to_solve = COALESCE(v_med_seconds, 120)::FLOAT8,
        median_moves_to_solve = COALESCE(v_med_moves, 16)::FLOAT8,
        trimmean_hints_used = COALESCE(v_tm_hints, 0)::FLOAT8,
        difficulty_score = (v_base_score / (v_solve_rate + 1.0)) / 5.0
    WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create Master Trigger
CREATE OR REPLACE FUNCTION public.on_user_progress_sync_v3()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM public.recalculate_puzzle_stats_v3(COALESCE(NEW.puzzle_id, OLD.puzzle_id));
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_user_progress_sync_v3 ON public.user_progress;
CREATE TRIGGER on_user_progress_sync_v3
AFTER INSERT OR UPDATE OR DELETE ON public.user_progress
FOR EACH ROW EXECUTE FUNCTION public.on_user_progress_sync_v3();

-- 6. RPC compatibility
CREATE OR REPLACE FUNCTION public.increment_puzzle_stats(p_id UUID, p_attempts INTEGER, p_seconds INTEGER, p_moves INTEGER)
RETURNS void AS $$
BEGIN
    PERFORM public.recalculate_puzzle_stats_v3(p_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Initial backfill
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.puzzles LOOP
        PERFORM public.recalculate_puzzle_stats_v3(r.id); 
    END LOOP;
END;
$$;
