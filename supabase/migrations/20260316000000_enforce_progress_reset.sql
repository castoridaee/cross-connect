-- Migration: Automatically reset user progress and stats when puzzle content changes
-- Date: 2026-03-16

-- 1. Add DELETE policy for user_progress (allows manual reset via frontend if needed)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_progress' AND policyname = 'Users can delete their own progress'
    ) THEN
        CREATE POLICY "Users can delete their own progress"
            ON public.user_progress FOR DELETE
            USING (auth.uid() = user_id);
    END IF;
END $$;

-- 2. Redefine the user_progress sync function to be "reset-aware"
-- This prevents the "tuple already modified" error during a mass reset
CREATE OR REPLACE FUNCTION public.on_user_progress_sync_v3()
RETURNS TRIGGER AS $$
BEGIN
    -- Skip recalculation if we are currently in a mass puzzle reset
    IF current_setting('app.puzzle_resetting', true) = 'true' THEN
        RETURN NULL;
    END IF;

    PERFORM public.recalculate_puzzle_stats_v3(COALESCE(NEW.puzzle_id, OLD.puzzle_id));
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create the reset function
CREATE OR REPLACE FUNCTION public.handle_puzzle_content_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only trigger if core content fields have changed
    IF (OLD.categories IS DISTINCT FROM NEW.categories) OR 
       (OLD.grid_data IS DISTINCT FROM NEW.grid_data) OR
       (OLD.layout IS DISTINCT FROM NEW.layout) OR
       (OLD.word_order IS DISTINCT FROM NEW.word_order) THEN
        
        -- A. Set session flag to disable recursive stats recalculation
        PERFORM set_config('app.puzzle_resetting', 'true', true);

        -- B. Delete all progress for this puzzle
        DELETE FROM public.user_progress WHERE puzzle_id = NEW.id;

        -- C. Reset session flag
        PERFORM set_config('app.puzzle_resetting', 'false', true);

        -- D. Reset stats to baseline since they describe the old content
        NEW.play_count := 0;
        NEW.solve_count := 0;
        NEW.likes_count := 0;
        NEW.share_count := 0;
        NEW.author_profile_clicks := 0;
        NEW.trimmean_attempts_to_solve := 1;
        NEW.median_time_to_solve := 120;
        NEW.median_moves_to_solve := 16;
        NEW.trimmean_hints_used := 0;
        NEW.difficulty_score := 0; 
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Attach the trigger
DROP TRIGGER IF EXISTS tr_puzzle_content_reset_progress ON public.puzzles;
CREATE TRIGGER tr_puzzle_content_reset_progress
BEFORE UPDATE ON public.puzzles
FOR EACH ROW EXECUTE FUNCTION public.handle_puzzle_content_change();
