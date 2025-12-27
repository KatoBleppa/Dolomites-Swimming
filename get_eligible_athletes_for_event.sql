-- SQL function to get eligible athletes for an event with their personal bests
CREATE OR REPLACE FUNCTION get_eligible_athletes_for_event(
  p_season_id INTEGER,
  p_event_gender TEXT,
  p_event_group_id INTEGER,
  p_race_id INTEGER,
  p_meet_course INTEGER
)
RETURNS TABLE (
  fincode INTEGER,
  lastname character varying(100),
  firstname character varying(100),
  gender character (1),
  group_id INTEGER,
  personal_best INTEGER,
  pb_string TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
        SELECT MIN(res.res_time_decimal)
        FROM results res
        INNER JOIN events e ON e.meet_id = res.meet_id AND e.event_numb = res.event_numb
        INNER JOIN meets m ON m.meet_id = e.meet_id
        WHERE res.fincode = a.fincode
          AND e.ms_race_id = p_race_id
          AND m.meet_course = p_meet_course
          AND res.res_time_decimal > 0
      ) AS personal_best
    FROM athletes a
    INNER JOIN roster r ON r.fincode = a.fincode
    INNER JOIN _categories c ON c.cat_id = r.ros_cat_id
    WHERE r.season_id = p_season_id
      AND c.cat_group_id = p_event_group_id
      AND (a.gender = p_event_gender OR p_event_gender = 'X')
  )
  SELECT 
    athlete_pbs.fincode,
    athlete_pbs.lastname,
    athlete_pbs.firstname,
    athlete_pbs.gender,
    athlete_pbs.group_id,
    athlete_pbs.personal_best,
    totaltime_to_timestr(athlete_pbs.personal_best) AS pb_string
  FROM athlete_pbs
  ORDER BY athlete_pbs.lastname, athlete_pbs.firstname;
END;
$$;
