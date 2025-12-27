-- =============================================================================
-- Supabase RLS Policy Check and Fix
-- =============================================================================
-- Run this in your Supabase SQL Editor to check and enable public read access
-- =============================================================================

-- Check current RLS status for all tables
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Check existing policies
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
ORDER BY tablename, policyname;

-- =============================================================================
-- OPTION 1: Enable public read access (RECOMMENDED for development/testing)
-- =============================================================================
-- This allows anonymous users to read data from all tables

-- Drop existing policies if any
DROP POLICY IF EXISTS "Enable read access for all users" ON athletes;
DROP POLICY IF EXISTS "Enable read access for all users" ON meets;
DROP POLICY IF EXISTS "Enable read access for all users" ON events;
DROP POLICY IF EXISTS "Enable read access for all users" ON results;
DROP POLICY IF EXISTS "Enable read access for all users" ON splits;
DROP POLICY IF EXISTS "Enable read access for all users" ON sessions;
DROP POLICY IF EXISTS "Enable read access for all users" ON attendance;
DROP POLICY IF EXISTS "Enable read access for all users" ON roster;
DROP POLICY IF EXISTS "Enable read access for all users" ON _races;
DROP POLICY IF EXISTS "Enable read access for all users" ON _categories;
DROP POLICY IF EXISTS "Enable read access for all users" ON _seasons;
DROP POLICY IF EXISTS "Enable read access for all users" ON _status;
DROP POLICY IF EXISTS "Enable read access for all users" ON _limits;

-- Enable RLS on all tables
ALTER TABLE athletes ENABLE ROW LEVEL SECURITY;
ALTER TABLE meets ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;
ALTER TABLE splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE roster ENABLE ROW LEVEL SECURITY;
ALTER TABLE _races ENABLE ROW LEVEL SECURITY;
ALTER TABLE _categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE _seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE _status ENABLE ROW LEVEL SECURITY;
ALTER TABLE _limits ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access
CREATE POLICY "Enable read access for all users" ON athletes
    FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON meets
    FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON events
    FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON results
    FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON splits
    FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON sessions
    FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON attendance
    FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON roster
    FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON _races
    FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON _categories
    FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON _seasons
    FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON _status
    FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON _limits
    FOR SELECT USING (true);

-- =============================================================================
-- OPTION 2: Disable RLS (NOT RECOMMENDED for production)
-- =============================================================================
-- Uncomment these lines if you want to completely disable RLS

-- ALTER TABLE athletes DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE meets DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE events DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE results DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE splits DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE sessions DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE attendance DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE roster DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE _races DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE _categories DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE _seasons DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE _status DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE _limits DISABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Verification: Check if policies were created successfully
-- =============================================================================
SELECT 
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;
