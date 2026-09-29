import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let admin: SupabaseClient | undefined

/** Server-only Supabase client with the service role key. Bypasses RLS: never expose it to the browser. */
export function useSupabaseAdmin(): SupabaseClient {
  if (!admin) {
    const config = useRuntimeConfig()
    admin = createClient(config.public.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: { persistSession: false }
    })
  }
  return admin
}
