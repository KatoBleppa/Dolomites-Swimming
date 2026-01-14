-- Function to convert time string (MM:SS.CC) to total milliseconds
-- This is the reverse of the totaltime_to_timestr function
-- Input format: "01:30.45" (1 minute, 30.45 seconds where .45 is centiseconds)
-- Output: 90450 (milliseconds)

CREATE OR REPLACE FUNCTION timestr_to_totaltime(time_str TEXT)
RETURNS NUMERIC AS $$
DECLARE
  parts TEXT[];
  minutes NUMERIC;
  seconds_part TEXT;
  seconds NUMERIC;
  centiseconds NUMERIC;
  total_milliseconds NUMERIC;
BEGIN
  -- Handle null or empty input
  IF time_str IS NULL OR time_str = '' THEN
    RETURN 0;
  END IF;
  
  -- Split by colon to get minutes and seconds parts
  parts := string_to_array(time_str, ':');
  
  -- Handle different formats (MM:SS.CC or SS.CC or HH:MM:SS.CC)
  IF array_length(parts, 1) = 3 THEN
    -- Format: HH:MM:SS.CC
    minutes := (parts[1]::NUMERIC * 60) + parts[2]::NUMERIC;
    seconds_part := parts[3];
  ELSIF array_length(parts, 1) = 2 THEN
    -- Format: MM:SS.CC
    minutes := parts[1]::NUMERIC;
    seconds_part := parts[2];
  ELSE
    -- Format: SS.CC (no colon)
    minutes := 0;
    seconds_part := time_str;
  END IF;
  
  -- Split seconds part by decimal point
  IF position('.' IN seconds_part) > 0 THEN
    seconds := SUBSTRING(seconds_part FROM 1 FOR position('.' IN seconds_part) - 1)::NUMERIC;
    centiseconds := SUBSTRING(seconds_part FROM position('.' IN seconds_part) + 1)::NUMERIC;
    
    -- Handle case where centiseconds is single digit (e.g., "30.5" means 50 centiseconds)
    IF centiseconds < 10 THEN
      centiseconds := centiseconds * 10;
    END IF;
  ELSE
    seconds := seconds_part::NUMERIC;
    centiseconds := 0;
  END IF;
  
  -- Convert everything to milliseconds
  -- Total seconds * 1000 + centiseconds * 10
  total_milliseconds := (minutes * 60 + seconds) * 1000 + (centiseconds * 10);
  
  RETURN total_milliseconds;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Example usage:
-- SELECT timestr_to_totaltime('01:30.45'); -- Returns 90450 (1:30.45 = 90.45 seconds = 90450 milliseconds)
-- SELECT timestr_to_totaltime('00:59.99'); -- Returns 59990 (59.99 seconds = 59990 milliseconds)
-- SELECT timestr_to_totaltime('02:00.00'); -- Returns 120000 (2:00.00 = 120 seconds = 120000 milliseconds)
