-- Migration: Refactor engagement tracking (shares and profile clicks) to user_progress
-- Date: 2026-03-08

-- 1. Add boolean flags to user_progress
ALTER TABLE public.user_progress 
ADD COLUMN IF NOT EXISTS has_shared BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS has_clicked_author BOOLEAN DEFAULT false;

-- 2. Create function to sync engagement counts to puzzles table
CREATE OR REPLACE FUNCTION public.handle_puzzle_engagement_sync()
RETURNS TRIGGER AS $$
BEGIN
    -- Handle INSERT (Initial action)
    IF (TG_OP = 'INSERT') THEN
        IF NEW.has_shared = true THEN
            UPDATE public.puzzles SET share_count = COALESCE(share_count, 0) + 1 WHERE id = NEW.puzzle_id;
        END IF;
        IF NEW.has_clicked_author = true THEN
            UPDATE public.puzzles SET author_profile_clicks = COALESCE(author_profile_clicks, 0) + 1 WHERE id = NEW.puzzle_id;
        END IF;
    
    -- Handle UPDATE (Action toggled/completed)
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Share count sync
        IF OLD.has_shared = false AND NEW.has_shared = true THEN
            UPDATE public.puzzles SET share_count = COALESCE(share_count, 0) + 1 WHERE id = NEW.puzzle_id;
        END IF;
        
        -- Profile click sync
        IF OLD.has_clicked_author = false AND NEW.has_clicked_author = true THEN
            UPDATE public.puzzles SET author_profile_clicks = COALESCE(author_profile_clicks, 0) + 1 WHERE id = NEW.puzzle_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create Trigger
DROP TRIGGER IF EXISTS on_puzzle_engagement_change ON public.user_progress;
CREATE TRIGGER on_puzzle_engagement_change
AFTER INSERT OR UPDATE ON public.user_progress
FOR EACH ROW EXECUTE FUNCTION public.handle_puzzle_engagement_sync();

-- 4. Update RPC function to use user_progress (instead of direct increments)
-- This function now ensures per-user tracking.
CREATE OR REPLACE FUNCTION public.record_puzzle_engagement(p_id UUID, u_id UUID, metric TEXT)
RETURNS void AS $$
BEGIN
    IF metric = 'share' THEN
        INSERT INTO public.user_progress (user_id, puzzle_id, has_shared)
        VALUES (u_id, p_id, true)
        ON CONFLICT (user_id, puzzle_id)
        DO UPDATE SET has_shared = true;
    ELSIF metric = 'profile_click' THEN
        INSERT INTO public.user_progress (user_id, puzzle_id, has_clicked_author)
        VALUES (u_id, p_id, true)
        ON CONFLICT (user_id, puzzle_id)
        DO UPDATE SET has_clicked_author = true;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Drop old function if it has a different name or to stay clean
DROP FUNCTION IF EXISTS public.increment_puzzle_engagement(UUID, TEXT);
