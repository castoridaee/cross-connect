-- Secure the comment_mentions table with Row Level Security
ALTER TABLE public.comment_mentions ENABLE ROW LEVEL SECURITY;

-- 1. Read Policy: Users can only see mentions explicitly targeting their auth identity
CREATE POLICY "Users can read own mentions" 
ON public.comment_mentions 
FOR SELECT 
USING (auth.uid() = mentioned_user_id);

-- Note: Insertions are securely handled intrinsically by parse_comment_mentions trigger (SECURITY DEFINER)
-- Note: Updates are securely handled natively by mark_mentions_read RPC (SECURITY DEFINER)
-- We therefore do NOT need public INSERT or UPDATE policies, effectively hardening data immutability against client tampering!
