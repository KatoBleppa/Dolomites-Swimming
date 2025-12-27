-- Add result_status column to results table
-- This allows tracking of DNS (Did Not Start), DNF (Did Not Finish), DSQ (Disqualified), and FINISHED

-- Create enum type for result status
CREATE TYPE result_status AS ENUM ('DNS', 'DNF', 'DSQ', 'FINISHED');

-- Add column to results table with default value
ALTER TABLE results 
ADD COLUMN result_status result_status DEFAULT 'FINISHED';

-- Update existing records to FINISHED (for normal results) or DSQ (for 999999 times if any exist)
UPDATE results 
SET result_status = CASE 
    WHEN res_time_decimal >= 999999 THEN 'DSQ'::result_status
    WHEN res_time_decimal = 0 THEN 'DNS'::result_status
    ELSE 'FINISHED'::result_status
END;

-- Add index for better query performance
CREATE INDEX idx_results_status ON results(result_status);

-- Update RLS policies to include new column
DROP POLICY IF EXISTS "Enable read access for all users" ON results;
DROP POLICY IF EXISTS "Enable insert access for all users" ON results;
DROP POLICY IF EXISTS "Enable update access for all users" ON results;
DROP POLICY IF EXISTS "Enable delete access for all users" ON results;

CREATE POLICY "Enable read access for all users" ON results
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON results
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for all users" ON results
    FOR UPDATE USING (true);

CREATE POLICY "Enable delete access for all users" ON results
    FOR DELETE USING (true);

-- Add comment to explain the column
COMMENT ON COLUMN results.result_status IS 'Status of the result: DNS (Did Not Start), DNF (Did Not Finish), DSQ (Disqualified), or FINISHED (completed race with valid time)';
