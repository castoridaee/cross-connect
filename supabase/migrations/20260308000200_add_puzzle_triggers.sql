-- Migration: Robust Heart and Play Count Triggers
-- Date: 2026-03-08

-- 1. Function to handle play_count increments (on FIRST start)
CREATE OR REPLACE FUNCTION public.handle_puzzle_play_increment()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.puzzles
    SET play_count = COALESCE(play_count, 0) + 1
    WHERE id = NEW.puzzle_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger for play_count (Fires only on initial insert of progress)
DROP TRIGGER IF EXISTS on_puzzle_play_start ON public.user_progress;
CREATE TRIGGER on_puzzle_play_start
AFTER INSERT ON public.user_progress
FOR EACH ROW EXECUTE FUNCTION public.handle_puzzle_play_increment();


-- 3. Function to handle likes_count synchronization
CREATE OR REPLACE FUNCTION public.handle_puzzle_like_sync()
RETURNS TRIGGER AS $$
BEGIN
    -- Handle INSERT (Initial like)
    IF (TG_OP = 'INSERT') THEN
        IF NEW.is_liked = true THEN
            UPDATE public.puzzles SET likes_count = COALESCE(likes_count, 0) + 1 WHERE id = NEW.puzzle_id;
        END IF;
    
    -- Handle UPDATE (Like/Unlike)
    ELSIF (TG_OP = 'UPDATE') THEN
        IF OLD.is_liked = false AND NEW.is_liked = true THEN
            UPDATE public.puzzles SET likes_count = COALESCE(likes_count, 0) + 1 WHERE id = NEW.puzzle_id;
        ELSIF OLD.is_liked = true AND NEW.is_liked = false THEN
            UPDATE public.puzzles SET likes_count = GREATEST(0, COALESCE(likes_count, 0) - 1) WHERE id = NEW.puzzle_id;
        END IF;

    -- Handle DELETE (User removed/Self-cleanup)
    ELSIF (TG_OP = 'DELETE') THEN
        IF OLD.is_liked = true THEN
            UPDATE public.puzzles SET likes_count = GREATEST(0, COALESCE(likes_count, 0) - 1) WHERE id = OLD.puzzle_id;
        END IF;
    END IF;
    
    RETURN NULL; -- result is ignored since this is an AFTER trigger
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Trigger for likes_count
DROP TRIGGER IF EXISTS on_puzzle_like_change ON public.user_progress;
CREATE TRIGGER on_puzzle_like_change
AFTER INSERT OR UPDATE OR DELETE ON public.user_progress
FOR EACH ROW EXECUTE FUNCTION public.handle_puzzle_like_sync();


-- 5. SIMPLIFIED RPC: Reset toggle_puzzle_like to just update user_progress
-- The trigger now handles the global count automatically.
CREATE OR REPLACE FUNCTION public.toggle_puzzle_like(p_id UUID, u_id UUID)
RETURNS boolean AS $$
DECLARE
    v_is_liked boolean;
BEGIN
    INSERT INTO public.user_progress (user_id, puzzle_id, is_liked)
    VALUES (u_id, p_id, true)
    ON CONFLICT (user_id, puzzle_id) 
    DO UPDATE SET is_liked = NOT user_progress.is_liked
    RETURNING is_liked INTO v_is_liked;

    RETURN v_is_liked;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
