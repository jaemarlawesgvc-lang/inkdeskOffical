import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

const ACCEPTED_MIME = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

const MIME_EXT: Record<'image/jpeg' | 'image/png' | 'image/webp', string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

// Verify the actual file bytes match an allowed image type rather than trusting
// the client-supplied Content-Type / filename extension. JPEG: FF D8 FF,
// PNG: 89 50 4E 47 0D 0A 1A 0A, WEBP: 'RIFF'….'WEBP'.
function sniffImageMime(
  buffer: Buffer,
): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg'
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
    buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) {
    return 'image/png'
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp'
  }
  return null
}

// Public endpoint: clients upload an optional photo of the completed tattoo
// when submitting a review. Token-gated the same way booking reference image
// uploads are gated by an active hold — the review must exist, be unused, and
// not be expired.
export async function POST(request: NextRequest): Promise<NextResponse> {
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file')
  const token = formData.get('token')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'A file is required' }, { status: 400 })
  }

  if (typeof token !== 'string' || token.length === 0) {
    return NextResponse.json({ error: 'A token is required' }, { status: 400 })
  }

  if (!ACCEPTED_MIME.includes(file.type)) {
    return NextResponse.json(
      { error: 'Only JPEG, PNG, and WEBP images are accepted' },
      { status: 422 },
    )
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'File must be under 10 MB' }, { status: 422 })
  }

  const supabase = createSupabaseAdminClient()

  const { data: review } = await supabase
    .from('reviews')
    .select('booking_id, token_used, token_expires_at')
    .eq('token', token)
    .maybeSingle()

  if (!review || review.token_used || new Date(review.token_expires_at) < new Date()) {
    return NextResponse.json(
      { error: 'This review link is no longer valid.' },
      { status: 410 },
    )
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  // Confirm the bytes really are one of the accepted image types, and derive
  // the stored extension + contentType from the sniffed MIME (not the client
  // filename/Content-Type).
  const sniffedMime = sniffImageMime(buffer)
  if (!sniffedMime) {
    return NextResponse.json(
      { error: 'Only JPEG, PNG, and WEBP images are accepted' },
      { status: 422 },
    )
  }

  const ext = MIME_EXT[sniffedMime]
  const path = `${review.booking_id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('review-photos')
    .upload(path, buffer, {
      cacheControl: '31536000',
      upsert: false,
      contentType: sniffedMime,
    })

  if (uploadError) {
    console.error('[reviews/upload-photo] storage error:', uploadError.message)
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ storagePath: path }, { status: 201 })
}
