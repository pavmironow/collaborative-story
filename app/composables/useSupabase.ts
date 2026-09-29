import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | undefined

/** Browser Supabase client (anon key). The session persists in localStorage, so a refresh keeps the player's identity. */
export function useSupabase(): SupabaseClient {
  if (!client) {
    const { supabaseUrl, supabaseAnonKey } = useRuntimeConfig().public
    client = createClient(supabaseUrl, supabaseAnonKey)
  }
  return client
}
