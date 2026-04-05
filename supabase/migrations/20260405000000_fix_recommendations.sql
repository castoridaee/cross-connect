-- Update get_recommended_puzzle to exclude shadowbanned and self-authored puzzles
CREATE OR REPLACE FUNCTION public.get_recommended_puzzle(p_user_id UUID)
RETURNS SETOF public.puzzles AS $$
DECLARE
    v_target_difficulty FLOAT8;
    v_skill FLOAT8;
    v_pref INTEGER;
BEGIN
    -- 1. Handling Guest / Not Logged In
    IF p_user_id IS NULL THEN
        -- Priority: Starter Puzzle (Only if not shadowbanned and published)
        RETURN QUERY 
        SELECT * FROM public.puzzles 
        WHERE id = '1834b762-a70b-4dcc-9403-e40d55f5ab07' 
          AND is_published = true
          AND is_shadowbanned = false;
        
        IF FOUND THEN
            RETURN;
        END IF;

        -- Fallback to Quality Score (Excluding shadowbanned)
        RETURN QUERY SELECT * FROM public.puzzles 
        WHERE is_published = true 
          AND is_shadowbanned = false
        ORDER BY quality_score DESC, random() LIMIT 1;
        RETURN;
    END IF;

    -- 2. Handling Logged In User
    SELECT skill_score, difficulty_preference INTO v_skill, v_pref FROM public.profiles WHERE id = p_user_id;
    v_target_difficulty := COALESCE(v_skill, 1.0) + (COALESCE(v_pref, 0) * 0.3);

    -- Priority: Starter Puzzle for brand new users (Excluding shadowbanned and self)
    IF NOT EXISTS (
        SELECT 1 FROM public.user_progress up 
        WHERE up.user_id = p_user_id AND up.status IN ('solved', 'skipped')
    ) THEN
        RETURN QUERY 
        SELECT * FROM public.puzzles 
        WHERE id = '1834b762-a70b-4dcc-9403-e40d55f5ab07' 
          AND is_published = true
          AND is_shadowbanned = false
          AND created_by != p_user_id;
        
        IF FOUND THEN
            RETURN;
        END IF;
    END IF;

    -- Regular Recommendation Logic
    -- 1. Exclude published=false
    -- 2. Exclude shadowbanned=true
    -- 3. Exclude self-authored
    -- 4. Exclude already playing/solved/skipped
    RETURN QUERY 
    SELECT p.* FROM public.puzzles p
    WHERE p.is_published = true
      AND p.is_shadowbanned = false
      AND p.created_by != p_user_id
      AND NOT EXISTS (
          SELECT 1 FROM public.user_progress up 
          WHERE up.puzzle_id = p.id AND up.user_id = p_user_id AND up.status IN ('solved', 'skipped', 'in_progress')
      )
    ORDER BY 
      (ABS(COALESCE(p.difficulty_score, 1.0) - v_target_difficulty) * 50)
      - COALESCE(p.quality_score, 50.0)
      + (random() * 15.0) ASC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
