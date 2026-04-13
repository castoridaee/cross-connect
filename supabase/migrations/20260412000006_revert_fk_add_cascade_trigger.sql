DO $$
DECLARE
    fk_constraint_name text;
BEGIN
    -- Drop the foreign key constraint that linked to public.profiles
    SELECT tc.constraint_name INTO fk_constraint_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'user_progress'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'user_id';

    IF fk_constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.user_progress DROP CONSTRAINT ' || fk_constraint_name;
    END IF;
END $$;

-- Restore the original foreign key constraint linking to auth.users natively
ALTER TABLE public.user_progress 
ADD CONSTRAINT user_progress_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;

-- Create an explicit trigger to cascade delete progress when a profile is removed
CREATE OR REPLACE FUNCTION public.cascade_profile_delete_progress()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM public.user_progress WHERE user_id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_cascade_profile_delete ON public.profiles;
CREATE TRIGGER trg_cascade_profile_delete
BEFORE DELETE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.cascade_profile_delete_progress();
