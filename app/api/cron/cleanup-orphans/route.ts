import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { verifyCronAuth } from '@/lib/cron/auth'

export const runtime = 'nodejs'

// Process in batches to avoid hitting Supabase Storage API rate limits
const BATCH_SIZE = 50

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handler(request)
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handler(request)
}

async function handler(request: NextRequest): Promise<NextResponse> {
  const authError = verifyCronAuth(request)
  if (authError) return authError

  const supabase = createSupabaseAdminClient()

  const results = {
    found: 0,
    deleted: 0,
    failed: 0,
    errors: [] as string[],
  }

  // Find soft-deleted portfolio_images that still have a storage_path
  // Process in pages to avoid large result sets
  let offset = 0
  let hasMore = true

  while (hasMore) {
    const { data: images, error: queryError } = await supabase
      .from('portfolio_images')
      .select('id, storage_path')
      .not('deleted_at', 'is', null)
      .not('storage_path', 'is', null)
      .range(offset, offset + BATCH_SIZE - 1)

    if (queryError) {
      console.error('[cron/cleanup-orphans] query error:', queryError.message)
      results.errors.push(`Query failed at offset ${offset}: ${queryError.message}`)
      break
    }

    if (!images || images.length === 0) {
      hasMore = false
      break
    }

    results.found += images.length

    // Batch storage deletions
    const storagePaths = images.map((img) => img.storage_path as string)

    const { error: storageError } = await supabase.storage
      .from('portfolio-images')
      .remove(storagePaths)

    if (storageError) {
      console.error('[cron/cleanup-orphans] storage delete error:', storageError.message)
      results.failed += images.length
      results.errors.push(`Storage delete failed: ${storageError.message}`)
      // Continue — still null out storage_path in DB to prevent re-processing
    } else {
      results.deleted += images.length
    }

    // Null out storage_path on processed rows regardless of storage outcome
    // This prevents infinite re-processing if the file was already removed
    const imageIds = images.map((img) => img.id as string)

    const { error: updateError } = await supabase
      .from('portfolio_images')
      .update({ storage_path: null })
      .in('id', imageIds)

    if (updateError) {
      console.error('[cron/cleanup-orphans] DB update error:', updateError.message)
      results.errors.push(`DB nullify failed: ${updateError.message}`)
    }

    // If we got fewer than BATCH_SIZE, we've reached the end
    if (images.length < BATCH_SIZE) {
      hasMore = false
    } else {
      offset += BATCH_SIZE
    }
  }

  console.info('[cron/cleanup-orphans] complete:', results)
  return NextResponse.json(results)
}
