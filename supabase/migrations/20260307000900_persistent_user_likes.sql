-- Migration: Persistent per-user likes
-- Date: 2026-03-07

-- 1. Add is_liked column to user_progress
ALTER TABLE public.user_progress 
ADD COLUMN IF NOT EXISTS is_liked BOOLEAN DEFAULT false;

-- 2. Create RPC to toggle like state and update global count
CREATE OR REPLACE FUNCTION public.toggle_puzzle_like(p_id UUID, u_id UUID)
RETURNS boolean AS $$
DECLARE
    v_is_liked boolean;
BEGIN
    -- 1. Ensure progress row exists and toggle is_liked
    INSERT INTO public.user_progress (user_id, puzzle_id, is_liked)
    VALUES (u_id, p_id, true)
    ON CONFLICT (user_id, puzzle_id) 
    DO UPDATE SET is_liked = NOT user_progress.is_liked
    RETURNING is_liked INTO v_is_liked;

    -- 2. Update the global likes_count on the puzzle
    IF v_is_liked THEN
        UPDATE public.puzzles 
        SET likes_count = COALESCE(likes_count, 0) + 1
        WHERE id = p_id;
    ELSE
        UPDATE public.puzzles 
        SET likes_count = GREATEST(0, COALESCE(likes_count, 0) - 1)
        WHERE id = p_id;
    END IF;

    RETURN v_is_liked;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
