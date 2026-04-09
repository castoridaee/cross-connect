-- 1. Character length limit
-- This adds a check constraint to the content column to limit it to 1000 characters
ALTER TABLE public.comments 
ADD CONSTRAINT comments_content_length_check 
CHECK (char_length(content) <= 1000);

-- 2. Function to enforce comment cap per puzzle
-- This function counts comments for the target puzzle and prevents insertion if it exceeds 100
CREATE OR REPLACE FUNCTION public.enforce_comment_limit()
RETURNS TRIGGER AS $$
DECLARE
    v_comment_count INTEGER;
BEGIN
    SELECT count(*) INTO v_comment_count
    FROM public.comments
    WHERE puzzle_id = NEW.puzzle_id;

    IF v_comment_count >= 100 THEN
        RAISE EXCEPTION 'Maximum comment limit (100) reached for this puzzle.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Trigger
-- Hook the function into the BEFORE INSERT process
CREATE TRIGGER tr_enforce_comment_limit
BEFORE INSERT ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.enforce_comment_limit();
