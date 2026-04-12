-- Rebuild Puzzles INSERT & UPDATE to explicitly tolerate identical anonymous behavior safely
DROP POLICY IF EXISTS "Users can insert their own puzzles" ON public.puzzles;
CREATE POLICY "Users can insert their own puzzles" ON public.puzzles
    FOR INSERT 
    WITH CHECK (auth.uid() = created_by OR created_by IS NULL);

DROP POLICY IF EXISTS "Users can update their own puzzles" ON public.puzzles;
CREATE POLICY "Users can update their own puzzles" ON public.puzzles
    FOR UPDATE 
    USING (auth.uid() = created_by);


-- Fix Comments to actually allow Anons (They were strictly checking auth.role() = 'authenticated')
DROP POLICY IF EXISTS "Authenticated users can post comments" ON public.comments;
CREATE POLICY "Authenticated and Anon users can post comments" ON public.comments
    FOR INSERT 
    WITH CHECK (auth.role() IN ('authenticated', 'anon'));

DROP POLICY IF EXISTS "Authenticated users can toggle likes" ON public.comment_likes;
CREATE POLICY "Authenticated and Anon users can toggle likes" ON public.comment_likes
    FOR INSERT 
    WITH CHECK (auth.role() IN ('authenticated', 'anon'));
