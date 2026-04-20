-- Add a granular mark-as-read RPC
-- This allows marking specific mentions as read without clearing the entire puzzle's notifications
CREATE OR REPLACE FUNCTION public.mark_specific_mentions_read(p_mention_ids UUID[])
RETURNS void AS $$
BEGIN
    UPDATE public.comment_mentions
    SET is_read = true
    WHERE id = ANY(p_mention_ids) 
      AND mentioned_user_id = auth.uid() 
      AND is_read = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
