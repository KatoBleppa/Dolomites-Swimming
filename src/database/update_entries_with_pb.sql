-- Update entry times for entries (status = 0) using previous best results by fincode, race, and course
create or replace function update_entries_with_pb()
returns integer
language plpgsql
as $$
declare
  updated_count integer;
begin
  update results r
  set
    entry_time_decimal = pb.best_time,
    entry_time_res_id = pb.best_res_id
  from (
    select
      r2.res_id,
      (
        select res.res_time_decimal
        from results res
        join events e on e.meet_id = res.meet_id and e.event_numb = res.event_numb
        join meets m on m.meet_id = e.meet_id
        where res.fincode = r2.fincode
          and e.ms_race_id = ev.ms_race_id
          and m.meet_course = meet.meet_course
          and res.res_time_decimal > 0
        order by res.res_time_decimal asc
        limit 1
      ) as best_time,
      (
        select res.res_id
        from results res
        join events e on e.meet_id = res.meet_id and e.event_numb = res.event_numb
        join meets m on m.meet_id = e.meet_id
        where res.fincode = r2.fincode
          and e.ms_race_id = ev.ms_race_id
          and m.meet_course = meet.meet_course
          and res.res_time_decimal > 0
        order by res.res_time_decimal asc
        limit 1
      ) as best_res_id
    from results r2
    join events ev on ev.meet_id = r2.meet_id and ev.event_numb = r2.event_numb
    join meets meet on meet.meet_id = r2.meet_id
    where r2.status = 0
  ) pb
  where r.res_id = pb.res_id
    and pb.best_time is not null;

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;
