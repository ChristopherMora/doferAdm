import { createClient } from '@supabase/supabase-js'

let supabase: ReturnType<typeof createClient> | null = null

export const getSupabase = () => {
  if (!supabase) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase credentials')
    }

    supabase = createClient(supabaseUrl, supabaseAnonKey)
  }

  return supabase
}

// Para compatibilidad con código existente
export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get: (target, prop) => {
    return getSupabase()[prop as keyof ReturnType<typeof createClient>]
  },
})
