-- 1. Create function to get puzzles with low play count
CREATE OR REPLACE FUNCTION public.get_low_play_puzzle(p_user_id UUID)
RETURNS SETOF public.puzzles AS $$
BEGIN
    RETURN QUERY 
    SELECT p.* FROM public.puzzles p
    WHERE p.is_published = true
      AND p.is_shadowbanned = false
      AND p.play_count < 5
      AND (p_user_id IS NULL OR p.created_by != p_user_id)
      AND NOT EXISTS (
          SELECT 1 FROM public.user_progress up 
          WHERE up.puzzle_id = p.id AND up.user_id = p_user_id AND up.status IN ('solved', 'skipped', 'in_progress')
      )
    ORDER BY random()
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update get_recommended_puzzle to be purely skill-based (remove starter logic)
CREATE OR REPLACE FUNCTION public.get_recommended_puzzle(p_user_id UUID)
RETURNS SETOF public.puzzles AS $$
DECLARE
    v_target_difficulty FLOAT8;
    v_skill FLOAT8;
    v_pref INTEGER;
BEGIN
    -- 1. Handling Guest / Not Logged In
    IF p_user_id IS NULL THEN
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

    -- Regular Recommendation Logic
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
