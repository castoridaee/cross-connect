-- Migration to add metadata columns to puzzles table
ALTER TABLE puzzles 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;
