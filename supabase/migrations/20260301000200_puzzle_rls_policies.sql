-- Standard RLS policies for puzzles table
ALTER TABLE puzzles ENABLE ROW LEVEL SECURITY;

-- 1. Allow everyone to SELECT published puzzles
CREATE POLICY "Anyone can view published puzzles" 
ON puzzles FOR SELECT 
USING (is_published = true);

-- 2. Allow authenticated users to INSERT their own puzzles
CREATE POLICY "Authenticated users can insert puzzles" 
ON puzzles FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = created_by);

-- 3. Allow users to UPDATE their own puzzles
CREATE POLICY "Users can update their own puzzles" 
ON puzzles FOR UPDATE 
TO authenticated 
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);

-- 4. Allow users to DELETE their own puzzles
CREATE POLICY "Users can delete their own puzzles" 
ON puzzles FOR DELETE 
TO authenticated 
USING (auth.uid() = created_by);
