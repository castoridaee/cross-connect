-- Migration: Add updated_at column and trigger to puzzles table
-- This allows sorting by "last modify date" correctly.

-- 1. Add updated_at column
ALTER TABLE public.puzzles 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Create trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create/Update trigger
DROP TRIGGER IF EXISTS tr_puzzles_updated_at ON public.puzzles;
CREATE TRIGGER tr_puzzles_updated_at
BEFORE UPDATE ON public.puzzles
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- 4. Initial sync: Set updated_at to created_at for existing rows
UPDATE public.puzzles SET updated_at = created_at WHERE updated_at IS NULL;
