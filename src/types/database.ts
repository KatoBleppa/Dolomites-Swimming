// Database types for Dolomites Swimming
// Generated from actual Supabase schema on December 22, 2025

export interface Database {
  public: {
    Tables: {
      athletes: {
        Row: Athlete
        Insert: Omit<Athlete, 'created_at' | 'updated_at'>
        Update: Partial<Omit<Athlete, 'fincode' | 'created_at' | 'updated_at'>>
      }
      meets: {
        Row: Meet
        Insert: Omit<Meet, 'created_at' | 'updated_at'>
        Update: Partial<Omit<Meet, 'meet_id' | 'created_at' | 'updated_at'>>
      }
      events: {
        Row: Event
        Insert: Omit<Event, 'created_at'>
        Update: Partial<Omit<Event, 'ms_id' | 'created_at'>>
      }
      results: {
        Row: Result
        Insert: Omit<Result, 'created_at' | 'updated_at'>
        Update: Partial<Omit<Result, 'res_id' | 'created_at' | 'updated_at'>>
      }
      splits: {
        Row: Split
        Insert: Omit<Split, 'created_at' | 'updated_at'>
        Update: Partial<Omit<Split, 'splits_id' | 'created_at' | 'updated_at'>>
      }
      sessions: {
        Row: Session
        Insert: Omit<Session, 'created_at' | 'updated_at'>
        Update: Partial<Omit<Session, 'sess_id' | 'created_at' | 'updated_at'>>
      }
      attendance: {
        Row: Attendance
        Insert: Omit<Attendance, 'created_at' | 'updated_at'>
        Update: Partial<Omit<Attendance, 'att_id' | 'created_at' | 'updated_at'>>
      }
      roster: {
        Row: Roster
        Insert: Omit<Roster, 'created_at' | 'updated_at'>
        Update: Partial<Omit<Roster, 'roster_id' | 'created_at' | 'updated_at'>>
      }
      _races: {
        Row: Race
        Insert: Omit<Race, 'created_at' | 'updated_at'>
        Update: Partial<Omit<Race, 'race_id' | 'created_at' | 'updated_at'>>
      }
      _categories: {
        Row: Category
        Insert: Omit<Category, 'created_at' | 'updated_at'>
        Update: Partial<Omit<Category, 'cat_id' | 'created_at' | 'updated_at'>>
      }
      _seasons: {
        Row: Season
        Insert: Omit<Season, 'created_at' | 'updated_at'>
        Update: Partial<Omit<Season, 'season_id' | 'created_at' | 'updated_at'>>
      }
      _status: {
        Row: Status
        Insert: Status
        Update: Partial<Omit<Status, 'status_id'>>
      }
      _limits: {
        Row: Limit
        Insert: Omit<Limit, 'created_at' | 'updated_at'>
        Update: Partial<Omit<Limit, 'lim_id' | 'created_at' | 'updated_at'>>
      }
    }
  }
}

// Core Tables

export interface Athlete {
  fincode: number
  firstname: string
  lastname: string
  birthdate: string
  gender: string
  email: string
  phone: string
  created_at: string
  updated_at: string
}

export interface Meet {
  meet_id: number
  meet_name: string
  pool_name: string
  place: string
  nation: string
  min_date: string
  max_date: string
  meet_course: number
  meet_groups: string[]
  created_at: string
  updated_at: string
}

export interface Event {
  ms_id: number
  meet_id: number
  event_numb: number
  ms_race_id: number
  gender: string
  ms_group_id: number
  created_at: string
}

export type ResultStatus = 'DNS' | 'DNF' | 'DSQ' | 'FINISHED'

export interface Result {
  res_id: number
  fincode: number
  meet_id: number
  event_numb: number
  res_time_decimal: number
  result_status: ResultStatus
  created_at: string
  updated_at: string
}

export interface Split {
  splits_id: number
  splits_res_id: number
  distance: number
  split_time: number
  created_at: string
  updated_at: string
}

export interface Session {
  sess_id: number
  date: string
  time: string
  type: string
  sector: string
  description: string
  volume: number
  location: string
  pool_name: string
  sess_course: number
  sess_group_id?: number
  group_name?: string
  created_at: string
  updated_at: string
}

export interface Attendance {
  att_id: number
  sess_id: number
  fincode: number
  status_code: number
  created_at: string
  updated_at: string
}

export interface Roster {
  roster_id: number
  fincode: number
  season_id: number
  group: string
  rost_cat_id: number
  created_at: string
  updated_at: string
}

// Reference Tables

export interface Race {
  race_id: number
  race_id_fin: number
  distance: number
  relay_count: number
  stroke_long_en: string
  stroke_short_en: string
  stroke_long_it: string
  stroke_short_it: string
  stroke_long_de: string
  stroke_short_de: string
  created_at: string
  updated_at: string
}

export interface Category {
  cat_id: number
  cat_name: string
  age: number
  gender: string
  group: string
  created_at: string
  updated_at: string
}

export interface Season {
  season_id: number
  season_name: string
  season_start: string
  season_end: string
  created_at: string
  updated_at: string
}

export interface Status {
  status_id: number
  description: string
}

export interface Limit {
  lim_id: number
  lim_course: number
  lim_gender: string
  lim_cat: number
  lim_race_id: number
  lim_time_str: string
  lim_time_sec: string
  lim_time_dec: string
  lim_season: string
  note: string
  created_at: string
  updated_at: string
}

export interface RelayResult {
  relay_result_id: number
  meet_id: number
  event_numb: number
  relay_name: string
  leg1_fincode: number
  leg1_entry_time: number
  leg1_res_time: number
  leg2_fincode: number
  leg2_entry_time: number
  leg2_res_time: number
  leg3_fincode: number
  leg3_entry_time: number
  leg3_res_time: number
  leg4_fincode: number
  leg4_entry_time: number
  leg4_res_time: number
  created_at: string
  updated_at: string
}
