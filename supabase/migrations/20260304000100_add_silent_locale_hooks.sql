-- Add locale column to puzzles and profiles
alter table public.puzzles add column if not exists locale text default 'en-US';
alter table public.profiles add column if not exists locale text default 'en-US';

-- Update the handle_new_user function to capture locale from metadata
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, nickname, locale)
  values (
    new.id, 
    new.raw_user_meta_data->>'nickname',
    coalesce(new.raw_user_meta_data->>'locale', 'en-US')
  );
  return new;
end;
$$ language plpgsql security definer;
