-- Migration: Add user skill tracking
-- Date: 2026-03-15

-- 1. Add skill_score and preference to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS skill_score FLOAT8 DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS difficulty_preference INTEGER DEFAULT 0;

-- Ensure difficulty_preference stays within bounds (e.g., -5 to 5)
-- Explicitly drop first in case previous -2 to 2 constraint exists
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS difficulty_preference_check;

ALTER TABLE public.profiles ADD CONSTRAINT difficulty_preference_check 
    CHECK (difficulty_preference >= -5 AND difficulty_preference <= 5);

-- 2. Create the Skill Score calculation function
-- Approach 2: Performance-Adjusted Skill Score
CREATE OR REPLACE FUNCTION public.recalculate_user_skill_score(p_user_id UUID)
RETURNS void AS $$
DECLARE
    v_new_skill FLOAT8;
BEGIN
    WITH recent_solves AS (
        SELECT 
            up.puzzle_id,
            up.total_seconds_played,
            up.move_count,
            up.attempts,
            up.hints_revealed_count,
            p.difficulty_score,
            p.median_time_to_solve,
            p.median_moves_to_solve,
            p.trimmean_attempts_to_solve,
            p.trimmean_hints_used
        FROM public.user_progress up
        JOIN public.puzzles p ON up.puzzle_id = p.id
        WHERE up.user_id = p_user_id AND up.is_solved = true
        ORDER BY up.solved_at DESC NULLS LAST, up.updated_at DESC
        LIMIT 50
    ),
    performance_scores AS (
        SELECT
            COALESCE(difficulty_score, 1.0) * 
            -- Time Factor: Better time = higher score. Capped between 0.5 and 2.0
            GREATEST(0.5, LEAST(2.0, COALESCE(median_time_to_solve, 120) / GREATEST(total_seconds_played::FLOAT8, 1.0))) *
            -- Move Factor: Fewer moves = higher score. Capped between 0.5 and 2.0
            GREATEST(0.5, LEAST(2.0, COALESCE(median_moves_to_solve, 16) / GREATEST(move_count::FLOAT8, 1.0))) *
            -- Hint Penalty: 15% reduction per hint, floored at 0.4
            GREATEST(0.4, 1.0 - (COALESCE(hints_revealed_count, 0) * 0.15)) *
            -- Attempt Penalty: 10% reduction per extra attempt, floored at 0.5
            GREATEST(0.5, 1.0 - (GREATEST(COALESCE(attempts, 1) - 1, 0) * 0.1)) AS solve_performance
        FROM recent_solves
    )
    SELECT COALESCE(AVG(solve_performance), 1.0)
    INTO v_new_skill
    FROM performance_scores;

    -- Update the profile
    UPDATE public.profiles
    SET skill_score = v_new_skill
    WHERE id = p_user_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Create Trigger to recalculate on solve
CREATE OR REPLACE FUNCTION public.on_user_progress_solved_sync_skill()
RETURNS TRIGGER AS $$
BEGIN
    -- Only calculate if the puzzle was just solved
    IF (TG_OP = 'UPDATE' AND NEW.is_solved = true AND OLD.is_solved = false) 
       OR (TG_OP = 'INSERT' AND NEW.is_solved = true) THEN
        PERFORM public.recalculate_user_skill_score(NEW.user_id);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_user_progress_skill_sync ON public.user_progress;
CREATE TRIGGER tr_user_progress_skill_sync
AFTER INSERT OR UPDATE ON public.user_progress
FOR EACH ROW EXECUTE FUNCTION public.on_user_progress_solved_sync_skill();


-- 4. Initial Backfill
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.profiles LOOP
        PERFORM public.recalculate_user_skill_score(r.id); 
    END LOOP;
END;
$$;


-- 5. Create Recommendation Engine RPC
CREATE OR REPLACE FUNCTION public.get_recommended_puzzle(p_user_id UUID)
RETURNS SETOF public.puzzles AS $$
DECLARE
    v_target_difficulty FLOAT8;
    v_skill FLOAT8;
    v_pref INTEGER;
BEGIN
    -- If no user, just return a random puzzle
    IF p_user_id IS NULL THEN
        RETURN QUERY SELECT * FROM public.puzzles 
        WHERE is_published = true
        ORDER BY random() LIMIT 1;
        RETURN;
    END IF;

    -- Get user's skill and preference
    SELECT skill_score, difficulty_preference INTO v_skill, v_pref
    FROM public.profiles WHERE id = p_user_id;

    -- Offset difficulty by 0.3 per preference tick. Normal = 0, Much Harder (+5) = +1.5 difficulty
    v_target_difficulty := COALESCE(v_skill, 1.0) + (COALESCE(v_pref, 0) * 0.3);

    RETURN QUERY 
    SELECT p.* FROM public.puzzles p
    WHERE p.is_published = true
      AND p.created_by != p_user_id
      AND NOT EXISTS (
          SELECT 1 FROM public.user_progress up 
          WHERE up.puzzle_id = p.id AND up.user_id = p_user_id AND up.status IN ('solved', 'skipped')
      )
    ORDER BY 
      -- Closest to target difficulty, plus a much larger random factor (0 to 1.0) to ensure high variance
      ABS(COALESCE(p.difficulty_score, 1.0) - v_target_difficulty) + (random() * 1.0) ASC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
