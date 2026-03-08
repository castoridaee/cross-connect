-- Ensure user_progress has the required columns if it already exists
DO $$ 
BEGIN
    -- 1. Create table if it doesn't exist at all
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_progress') THEN
        CREATE TABLE public.user_progress (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
            puzzle_id UUID REFERENCES public.puzzles(id) ON DELETE CASCADE NOT NULL,
            status TEXT NOT NULL DEFAULT 'in_progress',
            grid_state JSONB DEFAULT '{}'::jsonb,
            attempts INTEGER DEFAULT 0,
            move_count INTEGER DEFAULT 0,
            started_at TIMESTAMPTZ DEFAULT now(),
            solved_at TIMESTAMPTZ,
            updated_at TIMESTAMPTZ DEFAULT now(),
            total_seconds_played INTEGER DEFAULT 0,
            UNIQUE(user_id, puzzle_id)
        );
    ELSE
        -- 2. Add status column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_progress' AND column_name='status') THEN
            ALTER TABLE public.user_progress ADD COLUMN status TEXT NOT NULL DEFAULT 'in_progress';
        END IF;

        -- 3. Add updated_at if missing
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_progress' AND column_name='updated_at') THEN
            ALTER TABLE public.user_progress ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
        END IF;

        -- 4. Ensure UNIQUE constraint exists (if possible to check, otherwise rely on the existing one)
        -- The previous migration had UNIQUE(user_id, puzzle_id), so we should be good.
    END IF;
END $$;

-- Re-apply RLS and Policies (idempotent)
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own progress" ON public.user_progress;
CREATE POLICY "Users can view their own progress"
    ON public.user_progress FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own progress" ON public.user_progress;
CREATE POLICY "Users can insert their own progress"
    ON public.user_progress FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own progress" ON public.user_progress;
CREATE POLICY "Users can update their own progress"
    ON public.user_progress FOR UPDATE
    USING (auth.uid() = user_id);
