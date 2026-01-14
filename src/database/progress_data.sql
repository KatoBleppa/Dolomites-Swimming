CREATE OR REPLACE FUNCTION progress_data(
    athlete_fincode integer,
    ms_race integer
)
RETURNS TABLE (
    res_id bigint,
    fincode integer,
    meet_id smallint,
    res_time_decimal integer,
    status smallint,
    meet_name varchar(200),
    min_date date,
    ms_race_id smallint
) AS $$
BEGIN
        RETURN QUERY
                SELECT DISTINCT
                        r.res_id,
                        r.fincode,
                        r.meet_id,
                        r.res_time_decimal,
                        r.status,
                        m.meet_name,
                        m.min_date,
                        e.ms_race_id
                FROM results r
                INNER JOIN meets m ON r.meet_id = m.meet_id
                INNER JOIN events e ON r.event_numb = e.event_numb
                WHERE r.fincode = athlete_fincode
                    AND e.ms_race_id = ms_race
                    AND r.status = 4
                ORDER BY m.min_date ASC;
END;
$$ LANGUAGE plpgsql STABLE;