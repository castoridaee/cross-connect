-- 1. Backfill profiles for any users who created puzzles but are missing from the profiles table
INSERT INTO public.profiles (id)
SELECT DISTINCT p.created_by 
FROM public.puzzles p
LEFT JOIN public.profiles prof ON p.created_by = prof.id
WHERE p.created_by IS NOT NULL 
  AND prof.id IS NULL;

-- 2. Explicitly link created_by to public.profiles to fix PostgREST join errors
ALTER TABLE public.puzzles
DROP CONSTRAINT IF EXISTS puzzles_created_by_fkey,
ADD CONSTRAINT puzzles_created_by_fkey 
    FOREIGN KEY (created_by) 
    REFERENCES public.profiles(id)
    ON DELETE SET NULL;
