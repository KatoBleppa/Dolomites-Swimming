-- SQL Function to retrieve Personal Bests data
-- This function returns the best time for each athlete-race combination
-- Parameters:
--   p_season_id: The season ID to filter by
--   p_group_id: The group ID to filter by
--   p_course: The course type (1 = 50m, 2 = 25m)

CREATE OR REPLACE FUNCTION get_personal_bests(
  p_season_id INTEGER,
  p_group_id INTEGER,
  p_course INTEGER
)
RETURNS TABLE (
  fincode INTEGER,
  firstname VARCHAR,
  lastname VARCHAR,
  race_id SMALLINT,
  distance SMALLINT,
  stroke_short_en VARCHAR,
  best_time_decimal INTEGER,
  pb_str TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ath.fincode,
    ath.firstname,
    ath.lastname,
    r.race_id,
    r.distance,
    r.stroke_short_en,
    MIN(res.res_time_decimal)::INTEGER as best_time_decimal,
    totaltime_to_timestr(MIN(res.res_time_decimal)::INTEGER) as pb_str
  FROM get_athletes_details(p_season_id, p_group_id) ath
  INNER JOIN results res ON ath.fincode = res.fincode
  INNER JOIN events e ON res.meet_id = e.meet_id AND res.event_numb = e.event_numb
  INNER JOIN meets m ON e.meet_id = m.meet_id
  INNER JOIN _races r ON e.ms_race_id = r.race_id
  WHERE m.meet_course = p_course
    AND res.result_status = 'FINISHED'
    AND r.relay_count != 1
  GROUP BY ath.fincode, ath.firstname, ath.lastname, r.race_id, r.distance, r.stroke_short_en
  ORDER BY ath.lastname, ath.firstname, r.distance, r.race_id;
END;
$$ LANGUAGE plpgsql;

-- Example usage:
-- SELECT * FROM get_personal_bests(1, 1, 2);
-- This would return personal bests for season 1, group 1, short course (25m)
