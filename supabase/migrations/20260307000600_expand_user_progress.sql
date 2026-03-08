-- Add hints_revealed and guess_history columns to user_progress
ALTER TABLE public.user_progress 
ADD COLUMN IF NOT EXISTS hints_revealed JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS guess_history JSONB DEFAULT '[]'::jsonb;

-- Documentation:
-- hints_revealed stores: [{ index: number, level: number }]
-- guess_history stores: [{ attempt: number, messages: string[] }]
