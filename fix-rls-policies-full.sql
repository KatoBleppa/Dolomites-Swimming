-- =============================================================================
-- Supabase RLS Policy - Full CRUD Access
-- =============================================================================
-- Run this in your Supabase SQL Editor to enable INSERT, UPDATE, DELETE
-- =============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Enable read access for all users" ON meets;
DROP POLICY IF EXISTS "Enable insert access for all users" ON meets;
DROP POLICY IF EXISTS "Enable update access for all users" ON meets;
DROP POLICY IF EXISTS "Enable delete access for all users" ON meets;

-- Create policies for all CRUD operations on meets table
CREATE POLICY "Enable read access for all users" ON meets
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON meets
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for all users" ON meets
    FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete access for all users" ON meets
    FOR DELETE USING (true);

-- =============================================================================
-- Apply same policies to other tables that need CRUD operations
-- =============================================================================

-- Athletes table
DROP POLICY IF EXISTS "Enable read access for all users" ON athletes;
DROP POLICY IF EXISTS "Enable insert access for all users" ON athletes;
DROP POLICY IF EXISTS "Enable update access for all users" ON athletes;
DROP POLICY IF EXISTS "Enable delete access for all users" ON athletes;

CREATE POLICY "Enable read access for all users" ON athletes FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON athletes FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON athletes FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable delete access for all users" ON athletes FOR DELETE USING (true);

-- Sessions table
DROP POLICY IF EXISTS "Enable read access for all users" ON sessions;
DROP POLICY IF EXISTS "Enable insert access for all users" ON sessions;
DROP POLICY IF EXISTS "Enable update access for all users" ON sessions;
DROP POLICY IF EXISTS "Enable delete access for all users" ON sessions;

CREATE POLICY "Enable read access for all users" ON sessions FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON sessions FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable delete access for all users" ON sessions FOR DELETE USING (true);

-- Results table
DROP POLICY IF EXISTS "Enable read access for all users" ON results;
DROP POLICY IF EXISTS "Enable insert access for all users" ON results;
DROP POLICY IF EXISTS "Enable update access for all users" ON results;
DROP POLICY IF EXISTS "Enable delete access for all users" ON results;

CREATE POLICY "Enable read access for all users" ON results FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON results FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON results FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable delete access for all users" ON results FOR DELETE USING (true);

-- Roster table
DROP POLICY IF EXISTS "Enable read access for all users" ON roster;
DROP POLICY IF EXISTS "Enable insert access for all users" ON roster;
DROP POLICY IF EXISTS "Enable update access for all users" ON roster;
DROP POLICY IF EXISTS "Enable delete access for all users" ON roster;

CREATE POLICY "Enable read access for all users" ON roster FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON roster FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON roster FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable delete access for all users" ON roster FOR DELETE USING (true);

-- Attendance table
DROP POLICY IF EXISTS "Enable read access for all users" ON attendance;
DROP POLICY IF EXISTS "Enable insert access for all users" ON attendance;
DROP POLICY IF EXISTS "Enable update access for all users" ON attendance;
DROP POLICY IF EXISTS "Enable delete access for all users" ON attendance;

CREATE POLICY "Enable read access for all users" ON attendance FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON attendance FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON attendance FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable delete access for all users" ON attendance FOR DELETE USING (true);

-- =============================================================================
-- Verification
-- =============================================================================
SELECT 
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename IN ('meets', 'athletes', 'sessions', 'results', 'roster', 'attendance')
ORDER BY tablename, cmd;
