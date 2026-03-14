-- Migration: Backfill missing profiles for all existing users
-- Resolves foreign key errors on puzzles_created_by_fkey for early anonymous users

INSERT INTO public.profiles (id, nickname)
SELECT id, raw_user_meta_data->>'nickname'
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles);
