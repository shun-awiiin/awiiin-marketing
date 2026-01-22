import { createBrowserClient } from '@supabase/ssr'

// Note: For proper type safety, generate types using:
// npx supabase gen types typescript --project-id <project-id> > lib/types/supabase.ts

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
