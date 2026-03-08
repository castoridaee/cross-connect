-- Create user_progress table
CREATE TABLE IF NOT EXISTS public.user_progress (
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

-- Enable RLS
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own progress"
    ON public.user_progress FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own progress"
    ON public.user_progress FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own progress"
    ON public.user_progress FOR UPDATE
    USING (auth.uid() = user_id);

-- Index for faster filtering
CREATE INDEX IF NOT EXISTS idx_user_progress_status ON public.user_progress(user_id, status);
