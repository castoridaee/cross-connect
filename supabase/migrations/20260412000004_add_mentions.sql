CREATE TABLE IF NOT EXISTS public.comment_mentions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
    puzzle_id UUID REFERENCES public.puzzles(id) ON DELETE CASCADE,
    mentioned_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for speedy queries
CREATE INDEX IF NOT EXISTS comment_mentions_user_idx ON public.comment_mentions(mentioned_user_id);
CREATE INDEX IF NOT EXISTS comment_mentions_puzzle_idx ON public.comment_mentions(puzzle_id);

CREATE OR REPLACE FUNCTION public.parse_comment_mentions()
RETURNS trigger AS $$
DECLARE
    matched_un text;
    matched_id UUID;
BEGIN
    -- Only trigger on new comments or if content changed
    IF TG_OP = 'UPDATE' AND OLD.content = NEW.content THEN
        RETURN NEW;
    END IF;

    FOR matched_un IN 
        SELECT (regexp_matches(NEW.content, '@([A-Za-z0-9_-]+)', 'g'))[1]
    LOOP
        SELECT p.id INTO matched_id 
        FROM public.profiles p
        JOIN auth.users u ON p.id = u.id
        WHERE p.username = matched_un AND u.is_anonymous = false 
        LIMIT 1;
        
        -- Prevent self-mention and ensure user exists
        IF matched_id IS NOT NULL AND matched_id != NEW.user_id THEN
            -- Check if not already mentioned in this comment to prevent duplicates
            IF NOT EXISTS (SELECT 1 FROM public.comment_mentions WHERE comment_id = NEW.id AND mentioned_user_id = matched_id) THEN
                INSERT INTO public.comment_mentions (comment_id, puzzle_id, mentioned_user_id)
                VALUES (NEW.id, NEW.puzzle_id, matched_id);
            END IF;
        END IF;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_parse_comment_mentions ON public.comments;
CREATE TRIGGER tr_parse_comment_mentions
AFTER INSERT OR UPDATE OF content ON public.comments
FOR EACH ROW EXECUTE PROCEDURE public.parse_comment_mentions();

CREATE OR REPLACE FUNCTION public.mark_mentions_read(p_user_id UUID, p_puzzle_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE public.comment_mentions
    SET is_read = true
    WHERE mentioned_user_id = p_user_id AND puzzle_id = p_puzzle_id AND is_read = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
