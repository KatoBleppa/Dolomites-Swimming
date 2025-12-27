# Dolomites Swimming - Actual Database Schema

Retrieved on: December 22, 2025

## Overview
This document contains the actual database schema from your Supabase instance at `vupcplusmldrifueqpyp.supabase.co`.

---

## Tables

### 1. **athletes**
Core table storing athlete information.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `fincode` | integer | NO | - | Primary identifier (FIN code) |
| `firstname` | varchar | NO | - | Athlete's first name |
| `lastname` | varchar | NO | - | Athlete's last name |
| `birthdate` | date | NO | - | Date of birth |
| `gender` | char(1) | NO | - | Gender (M/F) |
| `email` | varchar | NO | - | Email address |
| `phone` | varchar | NO | - | Phone number |
| `created_at` | timestamptz | NO | now() | Record creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

**Required fields:** fincode, firstname, lastname, birthdate, gender

---

### 2. **meets**
Competition/meet information.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `meet_id` | smallint | NO | - | Primary key |
| `meet_name` | varchar | NO | - | Name of the meet |
| `pool_name` | varchar | NO | - | Pool name where meet is held |
| `place` | varchar | NO | - | City/location |
| `nation` | varchar | NO | - | Country |
| `min_date` | date | NO | - | Start date |
| `max_date` | date | NO | - | End date |
| `meet_course` | smallint | NO | - | Course type (25m/50m) |
| `meet_groups` | text[] | NO | - | Array of participating groups |
| `created_at` | timestamptz | NO | now() | Record creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

**Required fields:** meet_id, meet_name, min_date, max_date, meet_course

---

### 3. **events**
Individual events within meets.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `ms_id` | bigint | NO | - | Primary key |
| `meet_id` | integer | NO | - | Foreign key to meets |
| `event_numb` | smallint | NO | - | Event number within meet |
| `ms_race_id` | smallint | NO | - | Foreign key to _races |
| `gender` | varchar | NO | - | Gender category |
| `ms_cat` | varchar | NO | - | Category |
| `created_at` | timestamp | NO | now() | Record creation timestamp |

**Required fields:** ms_id

---

### 4. **results**
Competition results for athletes.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `res_id` | bigint | NO | - | Primary key |
| `fincode` | integer | NO | - | Foreign key to athletes |
| `meet_id` | smallint | NO | - | Foreign key to meets |
| `event_numb` | smallint | NO | - | Event number |
| `res_time_decimal` | integer | NO | - | Time in decimal format |
| `created_at` | timestamptz | NO | now() | Record creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

**Required fields:** res_id, fincode, meet_id, event_numb

---

### 5. **splits**
Split times for results.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `splits_id` | bigint | NO | - | Primary key |
| `splits_res_id` | bigint | NO | - | Foreign key to results |
| `distance` | smallint | NO | - | Distance at split |
| `split_time` | integer | NO | - | Time at this distance |
| `created_at` | timestamptz | NO | now() | Record creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

**Required fields:** splits_id, splits_res_id, distance

---

### 6. **sessions**
Training sessions.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `sess_id` | bigint | NO | - | Primary key |
| `date` | date | NO | - | Session date |
| `time` | time | NO | - | Session time |
| `type` | varchar | NO | - | Session type |
| `sector` | varchar | NO | - | Training sector |
| `description` | text | NO | - | Session description |
| `volume` | integer | NO | - | Training volume (meters) |
| `location` | varchar | NO | - | Location |
| `pool_name` | varchar | NO | - | Pool name |
| `sess_course` | smallint | NO | - | Pool course (25m/50m) |
| `created_at` | timestamptz | NO | now() | Record creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

**Required fields:** sess_id, date, time

---

### 7. **attendance**
Attendance tracking for training sessions.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `att_id` | bigint | NO | - | Primary key |
| `sess_id` | bigint | NO | - | Foreign key to sessions |
| `fincode` | integer | NO | - | Foreign key to athletes |
| `status_code` | smallint | NO | - | Foreign key to _status |
| `created_at` | timestamptz | NO | now() | Record creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

**Required fields:** att_id, sess_id, fincode, status_code

---

### 8. **roster**
Team roster by season.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `roster_id` | bigint | NO | - | Primary key |
| `fincode` | integer | NO | - | Foreign key to athletes |
| `season_id` | smallint | NO | - | Foreign key to _seasons |
| `group` | varchar | NO | - | Training group |
| `rost_cat_id` | smallint | NO | - | Category ID |
| `created_at` | timestamptz | NO | now() | Record creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

**Required fields:** roster_id, fincode, season_id

---

## Reference Tables (with underscore prefix)

### 9. **_races**
Race/event type definitions.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `race_id` | smallint | NO | - | Primary key |
| `race_id_fin` | smallint | NO | - | FIN standard race ID |
| `distance` | smallint | NO | - | Race distance |
| `relay_count` | smallint | NO | - | Number of relay swimmers |
| `stroke_long_en` | varchar | NO | - | English stroke name (long) |
| `stroke_short_en` | varchar | NO | - | English stroke code |
| `stroke_long_it` | varchar | NO | - | Italian stroke name |
| `stroke_short_it` | varchar | NO | - | Italian stroke code |
| `stroke_long_de` | varchar | NO | - | German stroke name |
| `stroke_short_de` | varchar | NO | - | German stroke code |
| `created_at` | timestamptz | NO | now() | Record creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

**Required fields:** race_id, distance

---

### 10. **_categories**
Age categories definitions.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `cat_id` | smallint | NO | - | Primary key |
| `cat_name` | varchar | NO | - | Category name |
| `age` | smallint | NO | - | Age for category |
| `gender` | char(1) | NO | - | Gender (M/F) |
| `group` | varchar | NO | - | Group name |
| `created_at` | timestamptz | NO | now() | Record creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

**Required fields:** cat_id, cat_name, age, gender

---

### 11. **_seasons**
Season definitions.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `season_id` | smallint | NO | - | Primary key |
| `season_name` | varchar | NO | - | Season name |
| `season_start` | date | NO | - | Season start date |
| `season_end` | date | NO | - | Season end date |
| `created_at` | timestamptz | NO | now() | Record creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

**Required fields:** season_id, season_name, season_start, season_end

---

### 12. **_status**
Status codes for attendance.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `status_id` | smallint | NO | - | Primary key |
| `description` | varchar | NO | - | Status description |

**Required fields:** status_id, description

---

### 13. **_limits**
Qualifying time limits.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `lim_id` | smallint | NO | - | Primary key |
| `lim_course` | smallint | NO | - | Course type |
| `lim_gender` | char(1) | NO | - | Gender |
| `lim_cat` | integer | NO | - | Category |
| `lim_race_id` | integer | NO | - | Race ID |
| `lim_time_str` | varchar | NO | - | Time as string |
| `lim_time_sec` | varchar | NO | - | Seconds |
| `lim_time_dec` | varchar | NO | - | Decimals |
| `lim_season` | varchar | NO | - | Season |
| `note` | text | NO | - | Notes |
| `created_at` | timestamptz | NO | now() | Record creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

**Required fields:** lim_id, lim_course, lim_gender

---

## Key Relationships

1. **athletes** ← (fincode) → **results** ← (res_id) → **splits**
2. **meets** ← (meet_id) → **events** ← (ms_id, meet_id, event_numb) → **results**
3. **_races** ← (race_id) → **events** (ms_race_id)
4. **sessions** ← (sess_id) → **attendance** → (fincode) **athletes**
5. **_seasons** ← (season_id) → **roster** → (fincode) **athletes**
6. **_status** ← (status_code) → **attendance**
7. **_categories** ← (cat_id) → **roster** (rost_cat_id)

---

## Notes

- Tables prefixed with `_` are reference/lookup tables
- All tables have `created_at` and `updated_at` timestamps
- Primary identifiers follow naming conventions:
  - `fincode`: Athlete identifier (FIN federation code)
  - `meet_id`: Meet/competition identifier
  - `sess_id`: Training session identifier
  - `res_id`: Result identifier
  - etc.
- Row Level Security (RLS) is likely enabled on these tables
