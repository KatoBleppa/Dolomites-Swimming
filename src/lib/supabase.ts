import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || ''

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

if (!isSupabaseConfigured) {
	console.warn(
		'Supabase environment variables are missing. Create a .env file from .env.example and set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
	)
}

// Keep app startup resilient even when env vars are absent.
export const supabase = createClient(
	isSupabaseConfigured ? supabaseUrl : 'http://localhost',
	isSupabaseConfigured ? supabaseAnonKey : 'placeholder-anon-key'
)
