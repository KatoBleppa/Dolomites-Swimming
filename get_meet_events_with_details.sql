-- SQL function to get events with all joined data
CREATE OR REPLACE FUNCTION get_meet_events_with_details(p_meet_id INTEGER)
RETURNS TABLE (
  ms_id INTEGER,
  meet_id INTEGER,
  event_numb INTEGER,
  ms_race_id INTEGER,
  gender TEXT,
  ms_group_id INTEGER,
  created_at TIMESTAMPTZ,
  group_id INTEGER,
  group_name TEXT,
  race_id INTEGER,
  race_id_fin INTEGER,
  distance INTEGER,
  stroke_code TEXT,
  stroke_long_en TEXT,
  stroke_long_it TEXT,
  relay_count INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
    g.id AS group_id,
    g.group_name,
    r.race_id,
    r.race_id_fin,
    r.distance,
    r.stroke_code,
    r.stroke_long_en,
    r.stroke_long_it,
    r.relay_count
  FROM events e
  LEFT JOIN _groups g ON g.id = e.ms_group_id
  LEFT JOIN _races r ON r.race_id = e.ms_race_id
  WHERE e.meet_id = p_meet_id
  ORDER BY e.event_numb ASC;
END;
$$;
