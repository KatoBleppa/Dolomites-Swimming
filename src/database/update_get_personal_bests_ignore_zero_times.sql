-- Ensure get_personal_bests returns the real PB (fastest non-zero time)
-- and does not treat placeholder 00:00.00 / 0.00 as a valid best time.

CREATE OR REPLACE FUNCTION get_personal_bests(
  p_season_id INTEGER,
  p_group_id INTEGER,
  p_course INTEGER
)
RETURNS TABLE (
  fincode INTEGER,
  firstname TEXT,
  lastname TEXT,
  race_id INTEGER,
  distance INTEGER,
  stroke_short_en TEXT,
  best_time_decimal NUMERIC,
  pb_str TEXT,
  meet_name TEXT,
  meet_date DATE,
  meet_location TEXT
)
LANGUAGE SQL
STABLE
AS $$
  WITH ranked_results AS (
    SELECT
      a.fincode,
      a.firstname,
      a.lastname,
      races.race_id,
      races.distance,
      races.stroke_short_en,
      res.res_time_decimal AS best_time_decimal,
      totaltime_to_timestr(res.res_time_decimal) AS pb_str,
      m.meet_name,
      m.min_date AS meet_date,
      m.place AS meet_location,
      ROW_NUMBER() OVER (
        PARTITION BY a.fincode, races.race_id
        ORDER BY res.res_time_decimal ASC, m.min_date ASC, res.res_id ASC
      ) AS row_num
    FROM roster ro
    JOIN athletes a
      ON a.fincode = ro.fincode
    JOIN _categories c
      ON c.cat_id = ro.ros_cat_id
    JOIN results res
      ON res.fincode = a.fincode
    JOIN events ev
      ON ev.meet_id = res.meet_id
      AND ev.event_numb = res.event_numb
    JOIN _races races
      ON races.race_id = ev.ms_race_id
    JOIN meets m
      ON m.meet_id = res.meet_id
    JOIN _seasons seasons
      ON seasons.season_id = p_season_id
    WHERE ro.season_id = p_season_id
      AND (p_group_id IS NULL OR c.cat_group_id = p_group_id)
      AND m.meet_course = p_course
      AND res.res_time_decimal > 0
      AND m.min_date <= seasons.season_end
      AND m.max_date >= seasons.season_start
  )
  SELECT
    rr.fincode,
    rr.firstname,
    rr.lastname,
    rr.race_id,
    rr.distance,
    rr.stroke_short_en,
    rr.best_time_decimal,
    rr.pb_str,
    rr.meet_name,
    rr.meet_date,
    rr.meet_location
  FROM ranked_results rr
  WHERE rr.row_num = 1
  ORDER BY rr.lastname, rr.firstname, rr.race_id;
$$;
