-- =============================================================================
-- Fix RLS Policies for Events Table
-- =============================================================================
-- Run this in your Supabase SQL Editor to enable full CRUD access for events
-- =============================================================================

-- Drop existing policies for events table
DROP POLICY IF EXISTS "Enable read access for all users" ON events;
DROP POLICY IF EXISTS "Enable insert access for all users" ON events;
DROP POLICY IF EXISTS "Enable update access for all users" ON events;
DROP POLICY IF EXISTS "Enable delete access for all users" ON events;

-- Create policies for all CRUD operations on events table
CREATE POLICY "Enable read access for all users" ON events
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON events
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for all users" ON events
    FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete access for all users" ON events
    FOR DELETE USING (true);

-- Also add policies for splits table if needed
DROP POLICY IF EXISTS "Enable read access for all users" ON splits;
DROP POLICY IF EXISTS "Enable insert access for all users" ON splits;
DROP POLICY IF EXISTS "Enable update access for all users" ON splits;
DROP POLICY IF EXISTS "Enable delete access for all users" ON splits;

CREATE POLICY "Enable read access for all users" ON splits
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON splits
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for all users" ON splits
    FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete access for all users" ON splits
    FOR DELETE USING (true);

-- =============================================================================
-- Verification - Check that policies were created
-- =============================================================================
SELECT 
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename IN ('events', 'splits')
ORDER BY tablename, cmd;
