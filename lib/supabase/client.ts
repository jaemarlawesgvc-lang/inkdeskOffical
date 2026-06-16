/**
 * lib/supabase/client.ts
 *
 * Browser-side Supabase client. Safe to import in Client Components.
 * Uses NEXT_PUBLIC_* vars only — no secrets.
 *
 * Exported as a factory function (not a bare singleton constant) so that
 * this module is safe to import during SSR: the singleton is created lazily
 * on first call, which only happens in the browser.
 */

import { createBrowserClient } from '@supabase/ssr'

let _client: ReturnType<typeof createBrowserClient> | undefined

/**
 * Returns the shared Supabase browser client.
 *
 * Creates it on first call; returns the cached instance on subsequent calls.
 * Prevents multiple GoTrue auth state machines from running in a single tab,
 * which would cause race conditions on token refresh.
 *
 * @example
 * // In a Client Component:
 * const supabase = getSupabaseBrowserClient()
 * const { data } = await supabase.from('artists').select('username')
 */
export function getSupabaseBrowserClient(): ReturnType<typeof createBrowserClient> {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!url || !anonKey) {
      throw new Error(
        'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY',
      )
    }

    _client = createBrowserClient(url, anonKey)
  }
  return _client
}
