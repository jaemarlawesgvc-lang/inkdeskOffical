import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function run() {
  const { createSupabaseAdminClient } = await import('./lib/supabase/server')
  const supabase = createSupabaseAdminClient()

  const tables = [
    'artists',
    'artist_availability',
    'artist_faqs',
    'artist_credentials',
    'portfolio_images',
    'reviews',
    'conversations',
    'messages',
    'consent_form_submissions',
    'bookings',
    'subscriptions'
  ]
  for (const table of tables) {
    const { error } = await supabase.from(table).select('id').limit(1)
    console.log(`Table '${table}' exists:`, !error, error ? error.message : 'OK')
  }
}

run()
