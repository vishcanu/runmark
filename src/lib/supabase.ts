import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Supabase client — null when env vars are not configured.
 * The app gracefully falls back to localStorage-only mode in that case.
 */
export const supabase: SupabaseClient | null =
  url && key && !url.includes('your-project-id')
    ? createClient(url, key)
    : null;

export const isSupabaseReady = supabase !== null;
