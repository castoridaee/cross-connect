-- Create comments table
CREATE TABLE IF NOT EXISTS public.comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    puzzle_id UUID REFERENCES public.puzzles(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    likes_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create comment_likes table
CREATE TABLE IF NOT EXISTS public.comment_likes (
    comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    PRIMARY KEY (comment_id, user_id)
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_comments_puzzle_id ON public.comments(puzzle_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON public.comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON public.comments(created_at DESC);

-- Enable RLS
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for comments
CREATE POLICY "Anyone can view comments" ON public.comments
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can post comments" ON public.comments
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can delete their own comments" ON public.comments
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for comment_likes
CREATE POLICY "Anyone can view comment likes" ON public.comment_likes
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can toggle likes" ON public.comment_likes
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can remove their likes" ON public.comment_likes
    FOR DELETE USING (auth.uid() = user_id);

-- RPC for toggling comment likes
CREATE OR REPLACE FUNCTION public.toggle_comment_like(p_comment_id UUID, p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_liked BOOLEAN;
BEGIN
    IF EXISTS (SELECT 1 FROM public.comment_likes WHERE comment_id = p_comment_id AND user_id = p_user_id) THEN
        DELETE FROM public.comment_likes WHERE comment_id = p_comment_id AND user_id = p_user_id;
        UPDATE public.comments SET likes_count = GREATEST(0, likes_count - 1) WHERE id = p_comment_id;
        v_liked := FALSE;
    ELSE
        INSERT INTO public.comment_likes (comment_id, user_id) VALUES (p_comment_id, p_user_id);
        UPDATE public.comments SET likes_count = likes_count + 1 WHERE id = p_comment_id;
        v_liked := TRUE;
    END IF;
    
    RETURN jsonb_build_object('liked', v_liked);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
