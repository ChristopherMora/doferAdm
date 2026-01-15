import { createClient } from '@supabase/supabase-js'

let supabaseClient: ReturnType<typeof createClient> | null = null

export const getSupabase = () => {
  if (!supabaseClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase credentials')
    }

    supabaseClient = createClient(supabaseUrl, supabaseAnonKey)
  }

  return supabaseClient
}

// Para compatibilidad con código existente
export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get: (target, prop) => {
    return getSupabase()[prop as keyof ReturnType<typeof createClient>]
  },
})
