-- Function to get eligible athletes for an event from all associated groups
-- This function fetches athletes from all groups associated with an event via the event_groups pivot table
-- It also includes personal best times for the specific race and course

CREATE OR REPLACE FUNCTION eligible_athletes(
  p_season_id INTEGER,
  p_event_gender TEXT,
  p_event_ms_id INTEGER,  -- Event ms_id to fetch from all associated groups
  p_race_id INTEGER,
  p_meet_course INTEGER
)
RETURNS TABLE (
  fincode INTEGER,
  lastname TEXT,
  firstname TEXT,
  gender TEXT,
  group_id INTEGER,
  personal_best NUMERIC,
  pb_string TEXT,
  pb_res_id INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH athlete_pbs AS (
    SELECT DISTINCT
      a.fincode,
      a.lastname,
      a.firstname,
      a.gender,
      c.cat_group_id AS group_id,
      (
        SELECT res.res_time_decimal
        FROM results res
        INNER JOIN events e ON e.meet_id = res.meet_id AND e.event_numb = res.event_numb
        INNER JOIN meets m ON m.meet_id = e.meet_id
        WHERE res.fincode = a.fincode
          AND e.ms_race_id = p_race_id
          AND m.meet_course = p_meet_course
          AND res.res_time_decimal > 0
        ORDER BY res.res_time_decimal ASC
        LIMIT 1
      ) AS personal_best,
      (
        SELECT res.res_id
        FROM results res
        INNER JOIN events e ON e.meet_id = res.meet_id AND e.event_numb = res.event_numb
        INNER JOIN meets m ON m.meet_id = e.meet_id
        WHERE res.fincode = a.fincode
          AND e.ms_race_id = p_race_id
          AND m.meet_course = p_meet_course
          AND res.res_time_decimal > 0
        ORDER BY res.res_time_decimal ASC
        LIMIT 1
      ) AS pb_res_id
    FROM athletes a
    INNER JOIN roster r ON r.fincode = a.fincode
    INNER JOIN _categories c ON c.cat_id = r.ros_cat_id
    INNER JOIN events ev ON ev.ms_id = p_event_ms_id
    LEFT JOIN event_groups eg ON eg.ms_id = p_event_ms_id AND eg.group_id = c.cat_group_id
    WHERE r.season_id = p_season_id
      AND (a.gender = p_event_gender OR p_event_gender = 'X')
      AND (
        EXISTS (
          SELECT 1 FROM event_groups eg_check WHERE eg_check.ms_id = p_event_ms_id
        )
        AND eg.group_id IS NOT NULL
        OR NOT EXISTS (
          SELECT 1 FROM event_groups eg_check WHERE eg_check.ms_id = p_event_ms_id
        )
        AND (ev.ms_group_id IS NULL OR c.cat_group_id = ev.ms_group_id)
      )
  )
  SELECT 
    athlete_pbs.fincode,
    athlete_pbs.lastname,
    athlete_pbs.firstname,
    athlete_pbs.gender,
    athlete_pbs.group_id,
    athlete_pbs.personal_best,
    totaltime_to_timestr(athlete_pbs.personal_best) AS pb_string,
    athlete_pbs.pb_res_id
  FROM athlete_pbs
  ORDER BY athlete_pbs.lastname, athlete_pbs.firstname;
END;
$$ LANGUAGE plpgsql;
