-- Prevent guest progress on the user's own puzzles/comments from merging
CREATE OR REPLACE FUNCTION public.sync_guest_progress(guest_id UUID, p_user_id UUID)
RETURNS void AS $$
BEGIN
    -- 1. Migrate user_progress
    UPDATE public.user_progress
    SET user_id = p_user_id
    WHERE user_id = guest_id
      AND NOT EXISTS (
          SELECT 1 FROM public.user_progress existing 
          WHERE existing.user_id = p_user_id AND existing.puzzle_id = public.user_progress.puzzle_id
      )
      AND NOT EXISTS (
          SELECT 1 FROM public.puzzles p
          WHERE p.id = public.user_progress.puzzle_id AND p.created_by IN (p_user_id, guest_id)
      );
    DELETE FROM public.user_progress WHERE user_id = guest_id;

    -- 2. Migrate comment_likes
    UPDATE public.comment_likes cl
    SET user_id = p_user_id
    WHERE user_id = guest_id
      AND NOT EXISTS (
          SELECT 1 FROM public.comment_likes existing 
          WHERE existing.user_id = p_user_id AND existing.comment_id = cl.comment_id
      )
      AND NOT EXISTS (
          SELECT 1 FROM public.comments c
          WHERE c.id = cl.comment_id AND c.user_id IN (p_user_id, guest_id)
      );
    DELETE FROM public.comment_likes WHERE user_id = guest_id;

    -- 3. Migrate comments
    UPDATE public.comments SET user_id = p_user_id WHERE user_id = guest_id;

    -- 4. Migrate puzzles (Including both published and unpublished drafts)
    UPDATE public.puzzles SET created_by = p_user_id WHERE created_by = guest_id;
    
    -- 5. Cleanup guest profile
    DELETE FROM public.profiles WHERE id = guest_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
