-- Migration script to populate event_groups table with primary groups from existing events
-- This should be run once after creating the event_groups table to migrate existing data

-- Insert primary group associations for all existing events
-- This uses the ms_group_id field from the events table
INSERT INTO event_groups (ms_id, group_id)
SELECT 
  e.ms_id,
  e.ms_group_id
FROM events e
WHERE e.ms_group_id IS NOT NULL
  AND NOT EXISTS (
    -- Only insert if this association doesn't already exist
    SELECT 1 
    FROM event_groups eg 
    WHERE eg.ms_id = e.ms_id 
    AND eg.group_id = e.ms_group_id
  )
ORDER BY e.ms_id;

-- Verify the migration
SELECT 
  COUNT(*) as total_events,
  COUNT(DISTINCT eg.ms_id) as events_with_groups,
  COUNT(*) as total_associations
FROM events e
LEFT JOIN event_groups eg ON e.ms_id = eg.ms_id;
