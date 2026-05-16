-- ==========================================
-- Explicit Grants for Supabase Data API
-- Required for projects after May/October 2026
-- ==========================================

-- 1. Profiles
GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- 2. Puzzles
GRANT SELECT ON public.puzzles TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.puzzles TO authenticated;
GRANT ALL ON public.puzzles TO service_role;

-- 3. User Progress
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_progress TO authenticated;
GRANT ALL ON public.user_progress TO service_role;

-- 4. Comments
GRANT SELECT ON public.comments TO anon, authenticated;
GRANT INSERT, DELETE ON public.comments TO authenticated;
GRANT ALL ON public.comments TO service_role;

-- 5. Comment Likes
GRANT SELECT ON public.comment_likes TO anon, authenticated;
GRANT INSERT, DELETE ON public.comment_likes TO authenticated;
GRANT ALL ON public.comment_likes TO service_role;

-- 6. Comment Mentions
GRANT SELECT ON public.comment_mentions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.comment_mentions TO authenticated;
GRANT ALL ON public.comment_mentions TO service_role;
