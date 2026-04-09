-- Rename nickname to username in profiles table
-- Date: 2026-04-05

DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'nickname'
    ) THEN
        ALTER TABLE public.profiles RENAME COLUMN nickname TO username;
    END IF;

    -- Update the check constraint if it still exists with the old name
    -- (Supabase might have auto-renamed it, but we'll be explicit)
    ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS nickname_length;
    ALTER TABLE public.profiles ADD CONSTRAINT username_length CHECK (char_length(username) >= 3 AND char_length(username) <= 30);
    
    -- Ensure no spaces at the database level too (optional bonus)
    ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS username_no_spaces;
    ALTER TABLE public.profiles ADD CONSTRAINT username_no_spaces CHECK (username !~ '\s');

END $$;

-- Update the trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_username TEXT;
BEGIN
    default_username := 'User' || substr(new.id::text, 1, 6);
    INSERT INTO public.profiles (id, username, locale)
    VALUES (new.id, default_username, 'en-US');
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
