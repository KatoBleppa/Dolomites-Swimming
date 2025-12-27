-- =============================================================================
-- Fix events sequence that's out of sync
-- =============================================================================
-- This resets the sequence to be ahead of the current max ms_id
-- =============================================================================

-- Check current sequence value and max ms_id
SELECT 
    'Current sequence value' as info,
    last_value 
FROM events_ms_id_seq;

SELECT 
    'Max ms_id in table' as info,
    COALESCE(MAX(ms_id), 0) as max_id 
FROM events;

-- Reset the sequence to be ahead of the max value in the table
SELECT setval('events_ms_id_seq', COALESCE((SELECT MAX(ms_id) FROM events), 0) + 1, false);

-- Verify the fix
SELECT 
    'New sequence value' as info,
    last_value 
FROM events_ms_id_seq;
