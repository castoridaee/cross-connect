-- Migration: Track puzzle engagement (profile clicks, shares, and likes)
-- Date: 2026-03-07

-- 1. Add tracking columns to puzzles table
ALTER TABLE public.puzzles 
ADD COLUMN IF NOT EXISTS author_profile_clicks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS share_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;

-- 2. Create RPC function to increment engagement metrics safely
CREATE OR REPLACE FUNCTION public.increment_puzzle_engagement(p_id UUID, metric TEXT)
RETURNS void AS $$
BEGIN
    IF metric = 'profile_click' THEN
        UPDATE public.puzzles 
        SET author_profile_clicks = author_profile_clicks + 1
        WHERE id = p_id;
    ELSIF metric = 'share' THEN
        UPDATE public.puzzles 
        SET share_count = share_count + 1
        WHERE id = p_id;
    ELSIF metric = 'like' THEN
        UPDATE public.puzzles 
        SET likes_count = likes_count + 1
        WHERE id = p_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
