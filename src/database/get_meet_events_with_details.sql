-- Function to get meet events with race and group details, including event-group associations
-- This function returns all events for a specific meet with joined race and group information
-- It also includes arrays of all associated group IDs and names from the event_groups pivot table

CREATE OR REPLACE FUNCTION get_meet_events_with_details(p_meet_id INTEGER)
RETURNS TABLE (
  ms_id INTEGER,
  meet_id INTEGER,
  event_numb INTEGER,
  ms_race_id INTEGER,
  gender TEXT,
  ms_group_id INTEGER,
  created_at TIMESTAMP,
  race_id INTEGER,
  race_id_fin INTEGER,
  distance INTEGER,
  stroke_short_en TEXT,
  stroke_long_en TEXT,
  stroke_long_it TEXT,
  relay_count INTEGER,
  group_id INTEGER,
  group_name TEXT,
  group_ids INTEGER[],
  group_names TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.ms_id,
    e.meet_id,
    e.event_numb,
    e.ms_race_id,
    e.gender,
    e.ms_group_id,
    e.created_at,
    r.race_id,
    r.race_id_fin,
    r.distance,
    r.stroke_short_en,
    r.stroke_long_en,
    r.stroke_long_it,
    r.relay_count,
    g.id AS group_id,
    g.group_name,
    -- Aggregate all associated group IDs from event_groups pivot table
    ARRAY(
      SELECT eg.group_id 
      FROM event_groups eg 
      WHERE eg.ms_id = e.ms_id
      ORDER BY eg.group_id
    ) AS group_ids,
    -- Aggregate all associated group names from event_groups pivot table
    ARRAY(
      SELECT _g.group_name 
      FROM event_groups eg
      JOIN _groups _g ON eg.group_id = _g.id
      WHERE eg.ms_id = e.ms_id
      ORDER BY eg.group_id
    ) AS group_names
  FROM events e
  LEFT JOIN _races r ON e.ms_race_id = r.race_id
  LEFT JOIN _groups g ON e.ms_group_id = g.id
  WHERE e.meet_id = p_meet_id
  ORDER BY e.event_numb;
END;
$$ LANGUAGE plpgsql;
