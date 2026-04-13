DO $$
DECLARE
    fk_constraint_name text;
BEGIN
    -- Find the existing foreign key constraint on user_id
    SELECT tc.constraint_name INTO fk_constraint_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'user_progress'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'user_id';

    -- Drop the existing foreign key constraint linking to auth.users
    IF fk_constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.user_progress DROP CONSTRAINT ' || fk_constraint_name;
    END IF;
END $$;

-- Add new foreign key constraint linking directly to public.profiles
-- This ensures that when a profile is manually deleted, all related progress is cascaded away
ALTER TABLE public.user_progress 
ADD CONSTRAINT user_progress_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;
