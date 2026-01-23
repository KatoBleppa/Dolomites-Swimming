-- Row Level Security Policies for relay_splits table
-- This allows authenticated users to read, insert, update, and delete relay splits

-- Enable Row Level Security on relay_splits table (if not already enabled)
ALTER TABLE relay_splits ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to view all relay splits
CREATE POLICY "Allow authenticated users to view relay splits"
ON relay_splits
FOR SELECT
TO authenticated
USING (true);

-- Policy: Allow authenticated users to insert relay splits
CREATE POLICY "Allow authenticated users to insert relay splits"
ON relay_splits
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy: Allow authenticated users to update relay splits
CREATE POLICY "Allow authenticated users to update relay splits"
ON relay_splits
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Policy: Allow authenticated users to delete relay splits
CREATE POLICY "Allow authenticated users to delete relay splits"
ON relay_splits
FOR DELETE
TO authenticated
USING (true);

-- Optional: If you want to allow anonymous access (not recommended for production)
-- Uncomment the following policies:

-- CREATE POLICY "Allow public to view relay splits"
-- ON relay_splits
-- FOR SELECT
-- TO public
-- USING (true);

-- CREATE POLICY "Allow public to insert relay splits"
-- ON relay_splits
-- FOR INSERT
-- TO public
-- WITH CHECK (true);

-- CREATE POLICY "Allow public to update relay splits"
-- ON relay_splits
-- FOR UPDATE
-- TO public
-- USING (true)
-- WITH CHECK (true);

-- CREATE POLICY "Allow public to delete relay splits"
-- ON relay_splits
-- FOR DELETE
-- TO public
-- USING (true);
