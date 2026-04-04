-- =========================================================================
-- Cross Connect Master Initialization Schema
-- Consolidated Date: 2026-03-18
-- =========================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. TABLES
-- ==========================================

-- Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    nickname TEXT UNIQUE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE,
    locale TEXT DEFAULT 'en-US',
    skill_score FLOAT8 DEFAULT 1.0,
    difficulty_preference INTEGER DEFAULT 0,
    author_reputation FLOAT8 DEFAULT 50.0,
    CONSTRAINT nickname_length CHECK (char_length(nickname) >= 3 AND char_length(nickname) <= 30),
    CONSTRAINT difficulty_preference_check CHECK (difficulty_preference >= -5 AND difficulty_preference <= 5)
);

-- Puzzles Table
CREATE TABLE IF NOT EXISTS public.puzzles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    categories JSONB NOT NULL,
    layout JSONB NOT NULL,
    word_order TEXT[] NOT NULL,
    grid_data JSONB,
    is_published BOOLEAN DEFAULT true,
    locale TEXT DEFAULT 'en-US',
    
    -- Engagement Stats
    likes_count INTEGER DEFAULT 0,
    play_count INTEGER DEFAULT 0,
    solve_count INTEGER DEFAULT 0,
    share_count INTEGER DEFAULT 0,
    author_profile_clicks INTEGER DEFAULT 0,
    
    -- Performance Tracking Metrics
    trimmean_attempts_to_solve FLOAT8 DEFAULT 1.0,
    median_time_to_solve FLOAT8 DEFAULT 120.0,
    median_moves_to_solve FLOAT8 DEFAULT 16.0,
    trimmean_hints_used FLOAT8 DEFAULT 0.0,
    difficulty_score FLOAT8 DEFAULT 0.0,
    quality_score FLOAT8 DEFAULT 50.0
);

-- User Progress Table
CREATE TABLE IF NOT EXISTS public.user_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    puzzle_id UUID REFERENCES public.puzzles(id) ON DELETE CASCADE NOT NULL,
    
    -- Derived Status via generated column
    is_solved BOOLEAN DEFAULT false,
    is_skipped BOOLEAN DEFAULT false,
    status TEXT GENERATED ALWAYS AS (
        CASE 
            WHEN is_solved = true THEN 'solved'
            WHEN is_skipped = true THEN 'skipped'
            ELSE 'in_progress'
        END
    ) STORED,
    
    -- Engagement Flags
    is_liked BOOLEAN DEFAULT false,
    has_shared BOOLEAN DEFAULT false,
    has_clicked_author BOOLEAN DEFAULT false,
    
    -- Play State & Performance Metrics
    grid_state JSONB DEFAULT '{}'::jsonb,
    attempts INTEGER DEFAULT 0,
    move_count INTEGER DEFAULT 0,
    hints_revealed JSONB DEFAULT '[]'::jsonb,
    hints_revealed_count INTEGER DEFAULT 0,
    guess_history JSONB DEFAULT '[]'::jsonb,
    total_seconds_played INTEGER DEFAULT 0,
    
    -- Timestamps
    started_at TIMESTAMPTZ DEFAULT NOW(),
    solved_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, puzzle_id)
);

-- ==========================================
-- 2. ROW LEVEL SECURITY (RLS)
-- ==========================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.puzzles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Public profiles are viewable by everyone."
    ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile."
    ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile."
    ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Puzzles Policies
CREATE POLICY "Published puzzles are viewable by everyone" 
    ON public.puzzles FOR SELECT USING (is_published = true OR auth.uid() = created_by);

CREATE POLICY "Users can insert their own puzzles" 
    ON public.puzzles FOR INSERT WITH CHECK (auth.uid() = created_by OR created_by IS NULL);

CREATE POLICY "Users can update their own puzzles" 
    ON public.puzzles FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own puzzles" 
    ON public.puzzles FOR DELETE USING (auth.uid() = created_by);

-- User Progress Policies
CREATE POLICY "Users can view their own progress"
    ON public.user_progress FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own progress"
    ON public.user_progress FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own progress"
    ON public.user_progress FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own progress"
    ON public.user_progress FOR DELETE USING (auth.uid() = user_id);


-- ==========================================
-- 3. INDEXES
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_puzzles_created_by ON public.puzzles(created_by);
CREATE INDEX IF NOT EXISTS idx_puzzles_locale ON public.puzzles(locale);
CREATE INDEX IF NOT EXISTS idx_user_progress_status ON public.user_progress(user_id, status);
CREATE INDEX IF NOT EXISTS idx_user_progress_puzzle ON public.user_progress(puzzle_id);

-- ==========================================
-- 4. SERVER FUNCTIONS & AUTOMATION
-- ==========================================

-- Function: Auto-create profile on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, nickname, locale)
    VALUES (new.id, 'User' || substr(new.id::text, 1, 6), 'en-US');
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- Function: Automatically update puzzle `updated_at`
CREATE OR REPLACE FUNCTION public.handle_puzzle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_puzzles_updated_at ON public.puzzles;
CREATE TRIGGER tr_puzzles_updated_at
BEFORE UPDATE ON public.puzzles
FOR EACH ROW EXECUTE FUNCTION public.handle_puzzle_updated_at();


-- Function: Enforce user progress reset when puzzle content is manually edited
CREATE OR REPLACE FUNCTION public.handle_puzzle_content_change()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.categories IS DISTINCT FROM NEW.categories) OR 
       (OLD.grid_data IS DISTINCT FROM NEW.grid_data) OR
       (OLD.layout IS DISTINCT FROM NEW.layout) OR
       (OLD.word_order IS DISTINCT FROM NEW.word_order) THEN
        
        -- A. Set session flag to disable recursive stats recalculation
        PERFORM set_config('app.puzzle_resetting', 'true', true);

        -- B. Delete all progress for this puzzle
        DELETE FROM public.user_progress WHERE puzzle_id = NEW.id;

        -- C. Reset session flag
        PERFORM set_config('app.puzzle_resetting', 'false', true);

        -- D. Reset stats to baseline since they describe the old content
        NEW.play_count := 0;
        NEW.solve_count := 0;
        NEW.likes_count := 0;
        NEW.share_count := 0;
        NEW.author_profile_clicks := 0;
        NEW.trimmean_attempts_to_solve := 1.0;
        NEW.median_time_to_solve := 120.0;
        NEW.median_moves_to_solve := 16.0;
        NEW.trimmean_hints_used := 0.0;
        NEW.difficulty_score := 0.0; 
        
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_puzzle_content_reset_progress ON public.puzzles;
CREATE TRIGGER tr_puzzle_content_reset_progress
BEFORE UPDATE ON public.puzzles
FOR EACH ROW EXECUTE FUNCTION public.handle_puzzle_content_change();


-- Function: Synchronize Hints Count Array
CREATE OR REPLACE FUNCTION public.sync_hints_count()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.hints_revealed IS NOT NULL THEN
        NEW.hints_revealed_count := jsonb_array_length(NEW.hints_revealed);
    ELSE
        NEW.hints_revealed_count := 0;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_sync_hints_count ON public.user_progress;
CREATE TRIGGER tr_sync_hints_count
BEFORE INSERT OR UPDATE ON public.user_progress
FOR EACH ROW EXECUTE FUNCTION public.sync_hints_count();


-- Function: Recalculate Player Skill Score (Performance-Adjusted)
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
            p.median_moves_to_solve
        FROM public.user_progress up
        JOIN public.puzzles p ON up.puzzle_id = p.id
        WHERE up.user_id = p_user_id AND up.is_solved = true
        ORDER BY up.solved_at DESC NULLS LAST, up.updated_at DESC
        LIMIT 50
    ),
    performance_scores AS (
        SELECT
            COALESCE(difficulty_score, 1.0) * 
            GREATEST(0.5, LEAST(2.0, COALESCE(median_time_to_solve, 120) / GREATEST(total_seconds_played::FLOAT8, 1.0))) *
            GREATEST(0.5, LEAST(2.0, COALESCE(median_moves_to_solve, 16) / GREATEST(move_count::FLOAT8, 1.0))) *
            GREATEST(0.4, 1.0 - (COALESCE(hints_revealed_count, 0) * 0.15)) *
            GREATEST(0.5, 1.0 - (GREATEST(COALESCE(attempts, 1) - 1, 0) * 0.1)) AS solve_performance
        FROM recent_solves
    )
    SELECT COALESCE(AVG(solve_performance), 1.0) INTO v_new_skill FROM performance_scores;

    UPDATE public.profiles SET skill_score = v_new_skill WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Update user skill on solve
CREATE OR REPLACE FUNCTION public.on_user_progress_solved_sync_skill()
RETURNS TRIGGER AS $$
BEGIN
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


-- Function: Recalculate Puzzle Stats
CREATE OR REPLACE FUNCTION public.recalculate_puzzle_stats_v3(p_id UUID)
RETURNS void AS $$
DECLARE
    v_play_count INTEGER;
    v_solve_count INTEGER;
    v_likes_count INTEGER;
    v_share_count INTEGER;
    v_author_clicks INTEGER;
    v_med_seconds FLOAT8;
    v_med_moves FLOAT8;
    v_tm_attempts FLOAT8;
    v_tm_hints FLOAT8;
    v_solve_rate FLOAT8;
    v_base_score FLOAT8;
BEGIN
    -- Aggregate flat counts
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE is_solved = true),
        COUNT(*) FILTER (WHERE is_liked = true),
        COUNT(*) FILTER (WHERE has_shared = true),
        COUNT(*) FILTER (WHERE has_clicked_author = true)
    INTO v_play_count, v_solve_count, v_likes_count, v_share_count, v_author_clicks
    FROM public.user_progress WHERE puzzle_id = p_id;

    -- Aggregate performance medians
    WITH solved_stats AS (
        SELECT 
            total_seconds_played,
            move_count,
            attempts,
            hints_revealed_count,
            PERCENT_RANK() OVER (ORDER BY attempts) AS attempt_pct,
            PERCENT_RANK() OVER (ORDER BY hints_revealed_count) AS hint_pct
        FROM public.user_progress
        WHERE puzzle_id = p_id AND is_solved = true
    )
    SELECT
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_seconds_played),
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY move_count),
        COALESCE(AVG(attempts) FILTER (WHERE attempt_pct BETWEEN 0.1 AND 0.9), 1.0),
        COALESCE(AVG(hints_revealed_count) FILTER (WHERE hint_pct BETWEEN 0.1 AND 0.9), 0.0)
    INTO v_med_seconds, v_med_moves, v_tm_attempts, v_tm_hints
    FROM solved_stats;

    v_solve_rate := GREATEST(v_solve_count::FLOAT8 / GREATEST(v_play_count::FLOAT8, 1.0), 0.01);
    
    -- difficulty rating formula
    v_base_score := (COALESCE(v_med_seconds, 120) / 75.0) + (COALESCE(v_med_moves, 16) / 30.0) + GREATEST(COALESCE(v_tm_attempts, 1) - 1.0, 0.0) + COALESCE(v_tm_hints, 0);

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


-- Function: Recalculate Puzzle Quality (Bayesian)
CREATE OR REPLACE FUNCTION public.recalculate_puzzle_quality(p_puzzle_id UUID)
RETURNS void AS $$
DECLARE
    v_author_id UUID;
    v_author_rep FLOAT8;
    v_total_plays INTEGER := 0;
    v_event_score_sum FLOAT8 := 0;
    v_bayes_constant CONSTANT FLOAT8 := 5.0; 
    v_new_quality FLOAT8;
BEGIN
    SELECT created_by INTO v_author_id FROM public.puzzles WHERE id = p_puzzle_id;
    SELECT COALESCE(author_reputation, 50.0) INTO v_author_rep FROM public.profiles WHERE id = v_author_id;

    SELECT 
        COUNT(*),
        SUM(
            CASE 
                WHEN is_skipped = true THEN 10.0 
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

    v_new_quality := ((v_bayes_constant * v_author_rep) + COALESCE(v_event_score_sum, 0)) / (v_bayes_constant + COALESCE(v_total_plays,0));
    UPDATE public.puzzles SET quality_score = GREATEST(0.0, LEAST(100.0, v_new_quality)) WHERE id = p_puzzle_id;

    PERFORM public.recalculate_author_reputation(v_author_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Function: Recalculate Author Reputation (Bayesian)
CREATE OR REPLACE FUNCTION public.recalculate_author_reputation(p_author_id UUID)
RETURNS void AS $$
DECLARE
    v_avg_quality FLOAT8;
    v_puzzle_count INTEGER;
    v_new_rep FLOAT8;
    v_bayes_constant CONSTANT FLOAT8 := 3.0;
    v_baseline CONSTANT FLOAT8 := 50.0;
BEGIN
    SELECT count(*), COALESCE(avg(quality_score), 50.0) INTO v_puzzle_count, v_avg_quality
    FROM public.puzzles WHERE created_by = p_author_id AND is_published = true;

    v_new_rep := ((v_bayes_constant * v_baseline) + (v_puzzle_count * v_avg_quality)) / (v_bayes_constant + v_puzzle_count);
    UPDATE public.profiles SET author_reputation = v_new_rep WHERE id = p_author_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Master Trigger: Sync Puzzle Performance and Quality on Progress change
CREATE OR REPLACE FUNCTION public.on_user_progress_sync_v3()
RETURNS TRIGGER AS $$
BEGIN
    -- Skip if puzzle is currently being reset
    IF current_setting('app.puzzle_resetting', true) = 'true' THEN RETURN NULL; END IF;

    PERFORM public.recalculate_puzzle_stats_v3(COALESCE(NEW.puzzle_id, OLD.puzzle_id));
    PERFORM public.recalculate_puzzle_quality(COALESCE(NEW.puzzle_id, OLD.puzzle_id));
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_user_progress_sync_v3 ON public.user_progress;
CREATE TRIGGER on_user_progress_sync_v3
AFTER INSERT OR UPDATE OR DELETE ON public.user_progress
FOR EACH ROW EXECUTE FUNCTION public.on_user_progress_sync_v3();


-- ==========================================
-- 5. RPC ENDPOINTS
-- ==========================================

-- Endpoint to fetch the next best puzzle based on skill, preferences, and quality
CREATE OR REPLACE FUNCTION public.get_recommended_puzzle(p_user_id UUID)
RETURNS SETOF public.puzzles AS $$
DECLARE
    v_target_difficulty FLOAT8;
    v_skill FLOAT8;
    v_pref INTEGER;
BEGIN
    IF p_user_id IS NULL THEN
        -- 0. Priority: Starter Puzzle
        RETURN QUERY 
        SELECT * FROM public.puzzles 
        WHERE id = '1834b762-a70b-4dcc-9403-e40d55f5ab07' 
          AND is_published = true;
        
        IF FOUND THEN
            RETURN;
        END IF;

        -- Fallback to Quality Score
        RETURN QUERY SELECT * FROM public.puzzles 
        WHERE is_published = true ORDER BY quality_score DESC, random() LIMIT 1;
        RETURN;
    END IF;

    SELECT skill_score, difficulty_preference INTO v_skill, v_pref FROM public.profiles WHERE id = p_user_id;
    v_target_difficulty := COALESCE(v_skill, 1.0) + (COALESCE(v_pref, 0) * 0.3);

    -- 0. Priority: Starter Puzzle for brand new users
    -- If the user has NO solved or skipped progress, try to serve the tutorial/starter puzzle
    IF NOT EXISTS (
        SELECT 1 FROM public.user_progress up 
        WHERE up.user_id = p_user_id AND up.status IN ('solved', 'skipped')
    ) THEN
        RETURN QUERY 
        SELECT * FROM public.puzzles 
        WHERE id = '1834b762-a70b-4dcc-9403-e40d55f5ab07' 
          AND is_published = true;
        
        IF FOUND THEN
            RETURN;
        END IF;
    END IF;

    -- 1. Regular Recommendation Logic
    RETURN QUERY 
    SELECT p.* FROM public.puzzles p
    WHERE p.is_published = true
      AND p.created_by != p_user_id
      AND NOT EXISTS (
          SELECT 1 FROM public.user_progress up 
          WHERE up.puzzle_id = p.id AND up.user_id = p_user_id AND up.status IN ('solved', 'skipped')
      )
    ORDER BY 
      (ABS(COALESCE(p.difficulty_score, 1.0) - v_target_difficulty) * 50)
      - COALESCE(p.quality_score, 50.0)
      + (random() * 15.0) ASC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Endpoint to sync guest (anonymous) performance data when signing up
CREATE OR REPLACE FUNCTION public.sync_guest_progress(guest_id UUID, p_user_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE public.user_progress
    SET user_id = p_user_id
    WHERE user_id = guest_id
      AND NOT EXISTS (
          SELECT 1 FROM public.user_progress existing 
          WHERE existing.user_id = p_user_id AND existing.puzzle_id = public.user_progress.puzzle_id
      );

    DELETE FROM public.user_progress WHERE user_id = guest_id;
    DELETE FROM public.puzzles WHERE created_by = guest_id AND is_published = false;
    UPDATE public.puzzles SET created_by = p_user_id WHERE created_by = guest_id;
    
    -- Cleanup guest profile and auth user natively handled by GoTrue cascade, but this ensures explicit cleaning
    DELETE FROM public.profiles WHERE id = guest_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
