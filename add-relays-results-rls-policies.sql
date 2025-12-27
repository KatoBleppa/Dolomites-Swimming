-- =============================================================================
-- RLS Policies for relays_results table
-- =============================================================================
-- This script adds Row Level Security policies for the relays_results table
-- Run this in your Supabase SQL Editor
-- =============================================================================

-- Enable Row Level Security on relays_results table (if not already enabled)
ALTER TABLE relays_results ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable read access for all users" ON relays_results;
DROP POLICY IF EXISTS "Enable insert access for all users" ON relays_results;
DROP POLICY IF EXISTS "Enable update access for all users" ON relays_results;
DROP POLICY IF EXISTS "Enable delete access for all users" ON relays_results;

-- Create SELECT policy (read access)
CREATE POLICY "Enable read access for all users" ON relays_results
    FOR SELECT 
    USING (true);

-- Create INSERT policy (write access)
CREATE POLICY "Enable insert access for all users" ON relays_results
    FOR INSERT 
    WITH CHECK (true);

-- Create UPDATE policy (update access)
CREATE POLICY "Enable update access for all users" ON relays_results
    FOR UPDATE 
    USING (true) 
    WITH CHECK (true);

-- Create DELETE policy (delete access)
CREATE POLICY "Enable delete access for all users" ON relays_results
    FOR DELETE 
    USING (true);

-- =============================================================================
-- Verification Query
-- =============================================================================
-- Run this to verify the policies were created successfully
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename = 'relays_results'
ORDER BY cmd;

-- Expected output:
-- • Enable read access for all users (SELECT)
-- • Enable insert access for all users (INSERT)
-- • Enable update access for all users (UPDATE)
-- • Enable delete access for all users (DELETE)
