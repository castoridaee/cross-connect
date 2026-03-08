-- Fix the status constraint to allow 'skipped'
ALTER TABLE public.user_progress DROP CONSTRAINT IF EXISTS user_progress_status_check;

ALTER TABLE public.user_progress ADD CONSTRAINT user_progress_status_check 
    CHECK (status IN ('in_progress', 'solved', 'skipped'));

-- Ensure any existing 'in_progress' or legacy rows are still valid
-- (This is a safety measure)
UPDATE public.user_progress SET status = 'in_progress' WHERE status NOT IN ('in_progress', 'solved', 'skipped');
