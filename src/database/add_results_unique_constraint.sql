-- Ensure entries can be upserted by (fincode, meet_id, event_numb)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'results_fincode_meet_event_uniq'
  ) THEN
    ALTER TABLE results
      ADD CONSTRAINT results_fincode_meet_event_uniq
      UNIQUE (fincode, meet_id, event_numb, res_time_decimal);
  END IF;
END $$;
