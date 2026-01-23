-- Pivot table for event-group associations
-- This allows events to be associated with multiple groups,
-- similar to how meets are associated with groups via meet_groups

CREATE TABLE IF NOT EXISTS event_groups (
  event_group_id SERIAL PRIMARY KEY,
  ms_id INTEGER NOT NULL REFERENCES events(ms_id) ON DELETE CASCADE,
  group_id INTEGER NOT NULL REFERENCES _groups(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(ms_id, group_id)
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_event_groups_ms_id ON event_groups(ms_id);
CREATE INDEX IF NOT EXISTS idx_event_groups_group_id ON event_groups(group_id);

-- Add comment for documentation
COMMENT ON TABLE event_groups IS 'Pivot table linking events to multiple groups';
COMMENT ON COLUMN event_groups.ms_id IS 'Foreign key to events table';
COMMENT ON COLUMN event_groups.group_id IS 'Foreign key to _groups table';
