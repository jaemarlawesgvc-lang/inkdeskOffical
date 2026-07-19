import type { NextRequest} from 'next/server';
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

// Public endpoint: clients upload tattoo reference images before submitting a
// booking. Files are namespaced by the active booking hold ID and stored in the
// private reference-images bucket. reference_image_paths stores storage paths,
// not URLs (per approved architecture decision).
export async function POST(request: NextRequest): Promise<NextResponse> {
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file')
  const holdId = formData.get('holdId')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'A file is required' }, { status: 400 })
  }

  if (typeof holdId !== 'string' || holdId.length === 0) {
    return NextResponse.json({ error: 'A holdId is required' }, { status: 400 })
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

  // Validate the hold exists and is still active to prevent orphan uploads
  const { data: hold } = await supabase
    .from('booking_holds')
    .select('id, expires_at')
    .eq('id', holdId)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (!hold) {
    return NextResponse.json(
      { error: 'Your booking session has expired. Please start again.' },
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
  const path = `${holdId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('reference-images')
    .upload(path, buffer, {
      cacheControl: '31536000',
      upsert: false,
      contentType: sniffedMime,
    })

  if (uploadError) {
    console.error('[upload-reference] storage error:', uploadError.message)
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ storagePath: path }, { status: 201 })
}
