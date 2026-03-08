-- Migration to allow anonymous users to save drafts in their own name
-- Anonymous users in Supabase often have the 'anon' role before they are fully authenticated with an email.
-- Since they have a valid sub/uid from signInAnonymously, we should allow them to manage their own puzzles.

-- 1. Update INSERT policy to include 'anon' role or just drop the role restriction
DROP POLICY IF EXISTS "Authenticated users can insert puzzles" ON puzzles;
CREATE POLICY "Users can insert their own puzzles" 
ON puzzles FOR INSERT 
-- No TO restriction, or explicitly TO authenticated, anon
WITH CHECK (auth.uid() = created_by);

-- 2. Update UPDATE policy to include 'anon' role
DROP POLICY IF EXISTS "Users can update their own puzzles" ON puzzles;
CREATE POLICY "Users can update their own puzzles" 
ON puzzles FOR UPDATE 
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);

-- 3. Update DELETE policy to include 'anon' role
DROP POLICY IF EXISTS "Users can delete their own puzzles" ON puzzles;
CREATE POLICY "Users can delete their own puzzles" 
ON puzzles FOR DELETE 
USING (auth.uid() = created_by);

-- 4. Ensure users (even anonymous) can SELECT their own unpublished drafts
DROP POLICY IF EXISTS "Users can view their own drafts" ON puzzles;
CREATE POLICY "Users can view their own drafts" 
ON puzzles FOR SELECT 
USING (auth.uid() = created_by);
