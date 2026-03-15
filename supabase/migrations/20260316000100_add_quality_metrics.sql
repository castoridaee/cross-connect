-- Migration: Add Puzzle Quality and Author Reputation Metrics
-- Date: 2026-03-16

-- 1. Schema Additions
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS author_reputation FLOAT8 DEFAULT 50.0;

ALTER TABLE public.puzzles 
ADD COLUMN IF NOT EXISTS quality_score FLOAT8 DEFAULT 50.0;

-- 2. Quality Calculation Function
CREATE OR REPLACE FUNCTION public.recalculate_puzzle_quality(p_puzzle_id UUID)
RETURNS void AS $$
DECLARE
    v_author_id UUID;
    v_author_rep FLOAT8;
    v_total_plays INTEGER := 0;
    v_event_score_sum FLOAT8 := 0;
    v_bayes_constant CONSTANT FLOAT8 := 5.0; -- The "C" constant (weight of the prior)
    v_new_quality FLOAT8;
BEGIN
    -- Get puzzle author and their current reputation (the Bayesian prior 'm')
    SELECT created_by INTO v_author_id FROM public.puzzles WHERE id = p_puzzle_id;
    
    SELECT COALESCE(author_reputation, 50.0) INTO v_author_rep 
    FROM public.profiles WHERE id = v_author_id;

    -- Calculate total events for this puzzle
    SELECT 
        COUNT(*),
        SUM(
            CASE 
                WHEN is_liked = true THEN 2.0
                WHEN has_shared = true THEN 2.0
                WHEN has_clicked_author = true THEN 1.0
                WHEN is_skipped = true THEN -1.0
                WHEN is_solved = true THEN 1.0
                ELSE 0.0 -- just uncompleted "in_progress" plays have no impact yet, or maybe 0 weight
            END
        )
    INTO v_total_plays, v_event_score_sum
    FROM public.user_progress
    WHERE puzzle_id = p_puzzle_id AND status IN ('solved', 'skipped'); -- Only count finished interactions

    -- Normalize scores so they map nicely to a 0-100 scale.
    -- If a perfect play (solve + like) gives +3.0, let's say average expected is +1.0.
    -- We can map the raw event sum to a 100-point scale per play.
    -- E.g., solve = +30, like = +40, share = +30 (max 100). skip = 0.
    
    -- Let's redefine the sums here using the 0-100 scale directly:
    SELECT 
        COUNT(*),
        SUM(
            CASE 
                WHEN is_skipped = true THEN 10.0 -- Baseline 10 for trying
                WHEN is_solved = true THEN 50.0 + 
                    (CASE WHEN is_liked THEN 25.0 ELSE 0.0 END) + 
                    (CASE WHEN has_shared THEN 15.0 ELSE 0.0 END) +
                    (CASE WHEN has_clicked_author THEN 10.0 ELSE 0.0 END)
                ELSE 0.0
            END
        )
    INTO v_total_plays, v_event_score_sum
    FROM public.user_progress
    WHERE puzzle_id = p_puzzle_id AND status IN ('solved', 'skipped');

    v_total_plays := COALESCE(v_total_plays, 0);
    v_event_score_sum := COALESCE(v_event_score_sum, 0);

    -- Bayesian Average Formula: (C*m + SUM) / (C + N)
    v_new_quality := ((v_bayes_constant * v_author_rep) + v_event_score_sum) / (v_bayes_constant + v_total_plays);

    -- Clamp between 0 and 100 for safety
    v_new_quality := GREATEST(0.0, LEAST(100.0, v_new_quality));

    -- Update puzzle
    UPDATE public.puzzles SET quality_score = v_new_quality WHERE id = p_puzzle_id;

    -- Update the author's reputation
    PERFORM public.recalculate_author_reputation(v_author_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Author Reputation Calculation Function
CREATE OR REPLACE FUNCTION public.recalculate_author_reputation(p_author_id UUID)
RETURNS void AS $$
DECLARE
    v_avg_quality FLOAT8;
    v_puzzle_count INTEGER;
    v_bayes_constant CONSTANT FLOAT8 := 3.0; -- Weight of baseline 50
    v_baseline CONSTANT FLOAT8 := 50.0;
    v_new_rep FLOAT8;
BEGIN
    -- Get average quality of all of their published puzzles
    SELECT count(*), COALESCE(avg(quality_score), 50.0) 
    INTO v_puzzle_count, v_avg_quality
    FROM public.puzzles 
    WHERE created_by = p_author_id AND is_published = true;

    -- Calculate Bayesian average for the author
    v_new_rep := ((v_bayes_constant * v_baseline) + (v_puzzle_count * v_avg_quality)) / (v_bayes_constant + v_puzzle_count);

    UPDATE public.profiles SET author_reputation = v_new_rep WHERE id = p_author_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. Hook into existing Puzzle Stats Trigger
-- Update the existing on_user_progress_sync_v3 to also trigger quality calculation
CREATE OR REPLACE FUNCTION public.on_user_progress_sync_v3()
RETURNS TRIGGER AS $$
BEGIN
    -- Skip recalculation if we are currently in a mass puzzle reset
    IF current_setting('app.puzzle_resetting', true) = 'true' THEN
        RETURN NULL;
    END IF;

    -- Existing stats calc (difficulty, play count, medians...)
    PERFORM public.recalculate_puzzle_stats_v3(COALESCE(NEW.puzzle_id, OLD.puzzle_id));
    
    -- New quality calc
    PERFORM public.recalculate_puzzle_quality(COALESCE(NEW.puzzle_id, OLD.puzzle_id));

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. Update Recommendation Engine
CREATE OR REPLACE FUNCTION public.get_recommended_puzzle(p_user_id UUID)
RETURNS SETOF public.puzzles AS $$
DECLARE
    v_target_difficulty FLOAT8;
    v_skill FLOAT8;
    v_pref INTEGER;
BEGIN
    -- If no user, just return a highly-rated random puzzle
    IF p_user_id IS NULL THEN
        RETURN QUERY SELECT * FROM public.puzzles 
        WHERE is_published = true
        ORDER BY quality_score DESC, random() LIMIT 1;
        RETURN;
    END IF;

    -- Get user's skill and preference
    SELECT skill_score, difficulty_preference INTO v_skill, v_pref
    FROM public.profiles WHERE id = p_user_id;

    -- Offset difficulty by 0.3 per preference tick.
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
      -- Penalty for being far from target difficulty (e.g., max 50 points penalty if 1.0 diff away)
      (ABS(COALESCE(p.difficulty_score, 1.0) - v_target_difficulty) * 50)
      -- Minus the puzzle's quality score (we want high quality to sort to the top)
      - COALESCE(p.quality_score, 50.0)
      -- Plus a random factor (0 to 15) to ensure high variance
      + (random() * 15.0) ASC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Initial Backfill
DO $$
DECLARE
    r RECORD;
    u RECORD;
BEGIN
    -- Calculate puzzles first
    FOR r IN SELECT id FROM public.puzzles LOOP
        PERFORM public.recalculate_puzzle_quality(r.id); 
    END LOOP;

    -- The author rep generates from the puzzle loop, but just in case, sync all profiles
    FOR u IN SELECT id FROM public.profiles LOOP
        PERFORM public.recalculate_author_reputation(u.id); 
    END LOOP;
END;
$$;
