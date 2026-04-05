-- Add shadowban flags and counts to relevant tables
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS is_shadowbanned BOOLEAN DEFAULT FALSE;
ALTER TABLE public.puzzles ADD COLUMN IF NOT EXISTS is_shadowbanned BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_hard_shadowbanned BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS shadowban_total INTEGER DEFAULT 0;

-- Update RLS for comments to filter shadowbanned content for others
DROP POLICY IF EXISTS "Anyone can view comments" ON public.comments;
CREATE POLICY "Anyone can view comments" ON public.comments
    FOR SELECT USING (
        is_shadowbanned = FALSE 
        OR auth.uid() = user_id
    );

-- Update RLS for puzzles to filter shadowbanned content for others
-- Adjusting the existing puzzles view policy
-- Note: Assuming the original policy name was "Anyone can view published puzzles" 
-- or similar based on standard Supabase patterns.
DROP POLICY IF EXISTS "Anyone can view published puzzles" ON public.puzzles;
CREATE POLICY "Anyone can view published puzzles" ON public.puzzles
    FOR SELECT USING (
        (is_published = TRUE AND is_shadowbanned = FALSE)
        OR auth.uid() = created_by
    );

-- Index for shadowban filtering
CREATE INDEX IF NOT EXISTS idx_comments_is_shadowbanned ON public.comments(is_shadowbanned);
CREATE INDEX IF NOT EXISTS idx_puzzles_is_shadowbanned ON public.puzzles(is_shadowbanned);
