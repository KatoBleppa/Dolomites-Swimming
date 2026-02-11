-- Returns all results for one athlete within a season
create or replace function individual_results(p_fincode integer, p_season_id integer)
returns table (
  race_id integer,
  distance integer,
  stroke_short_en text,
  meet_name text,
  meet_date date,
  meet_course integer,
  res_time_decimal numeric,
  res_time_str text,
  status text
)
language sql
stable
as $$
  select
    races.race_id,
    races.distance,
    races.stroke_short_en,
    meets.meet_name,
    meets.min_date as meet_date,
    meets.meet_course,
    res.res_time_decimal,
    totaltime_to_timestr(res.res_time_decimal) as res_time_str,
    res.status as status
  from results res
  join events ev
    on ev.meet_id = res.meet_id
    and ev.event_numb = res.event_numb
  join _races races
    on races.race_id = ev.ms_race_id
  join meets
    on meets.meet_id = res.meet_id
  join _seasons seasons
    on seasons.season_id = p_season_id
  where res.fincode = p_fincode
    and meets.min_date <= seasons.season_end
    and meets.max_date >= seasons.season_start
  order by races.race_id, res.res_time_decimal asc;
$$;
