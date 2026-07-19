import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import { resolveActivePlan, checkMeteredFeature } from '@/lib/stripe/plans'

// Portfolio uploads run through this authenticated endpoint (rather than a
// direct browser-to-storage upload) so that file bytes are validated
// server-side via magic-byte sniffing — mirroring app/api/booking/upload-reference.
// Both images and short videos are supported for the artist's public gallery.

type SniffedMime =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'video/mp4'
  | 'video/webm'
  | 'video/quicktime'

const IMAGE_MAX_BYTES = 10 * 1024 * 1024 // 10 MB
const VIDEO_MAX_BYTES = 50 * 1024 * 1024 // 50 MB

const MIME_EXT: Record<SniffedMime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
}

// Verify the actual file bytes rather than trusting the client Content-Type.
//   JPEG:  FF D8 FF
//   PNG:   89 50 4E 47 0D 0A 1A 0A
//   WEBP:  'RIFF'....'WEBP'
//   MP4/MOV: ISO base-media 'ftyp' box at offset 4; QuickTime brands → mov
//   WEBM/MKV: EBML header 1A 45 DF A3 → webm
function sniffMediaMime(buffer: Buffer): SniffedMime | null {
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
  // ISO base media (MP4 / MOV): 'ftyp' box starts at byte 4, brand at byte 8.
  if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buffer.toString('ascii', 8, 12).toLowerCase()
    if (brand.startsWith('qt')) return 'video/quicktime'
    return 'video/mp4'
  }
  // EBML header shared by WebM and Matroska.
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3
  ) {
    return 'video/webm'
  }
  return null
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { data: artist } = await supabase
    .from('artists')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!artist) {
    return NextResponse.json({ error: 'Artist not found' }, { status: 404 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'A file is required' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const sniffedMime = sniffMediaMime(buffer)

  if (!sniffedMime) {
    return NextResponse.json(
      { error: 'Only JPEG, PNG, WEBP images and MP4, WEBM, MOV videos are accepted' },
      { status: 422 },
    )
  }

  const isVideo = sniffedMime.startsWith('video/')
  const mediaType: 'image' | 'video' = isVideo ? 'video' : 'image'
  const maxBytes = isVideo ? VIDEO_MAX_BYTES : IMAGE_MAX_BYTES

  if (buffer.length > maxBytes) {
    return NextResponse.json(
      { error: isVideo ? 'Videos must be under 50 MB' : 'Images must be under 10 MB' },
      { status: 422 },
    )
  }

  // Enforce the plan's portfolio-item limit server-side (defence in depth on top
  // of the client-side gate). Images and videos share the portfolioImages quota.
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', user.id)
    .maybeSingle()

  const plan = resolveActivePlan(subscription)

  const { count } = await supabase
    .from('portfolio_images')
    .select('id', { count: 'exact', head: true })
    .eq('artist_id', artist.id)
    .is('deleted_at', null)

  const gate = checkMeteredFeature(plan, 'portfolio_images', count ?? 0)
  if (!gate.allowed) {
    return NextResponse.json(
      { error: gate.reason, currentPlan: gate.currentPlan, requiredPlan: gate.requiredPlan, upgradeUrl: gate.upgradeUrl },
      { status: 403 },
    )
  }

  // Upload with the admin client (server-side, RLS bypassed — the caller is
  // already authorised above). Path is namespaced by artist id per the bucket
  // convention: portfolio-images/{artist_id}/{filename}.
  const admin = createSupabaseAdminClient()
  const ext = MIME_EXT[sniffedMime]
  const path = `${artist.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const { error: uploadError } = await admin.storage
    .from('portfolio-images')
    .upload(path, buffer, { cacheControl: '31536000', upsert: false, contentType: sniffedMime })

  if (uploadError) {
    console.error('[portfolio/upload] storage error:', uploadError.message)
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 })
  }

  const { data: urlData } = admin.storage.from('portfolio-images').getPublicUrl(path)

  const { data: row, error: dbError } = await admin
    .from('portfolio_images')
    .insert({
      artist_id: artist.id,
      storage_path: path,
      public_url: urlData.publicUrl,
      media_type: mediaType,
      display_order: count ?? 0,
      caption: '',
    })
    .select('id, storage_path, public_url, display_order, caption, media_type, poster_url')
    .single()

  if (dbError || !row) {
    // Roll back the orphaned storage object so a failed insert doesn't leak files.
    await admin.storage.from('portfolio-images').remove([path])
    console.error('[portfolio/upload] db error:', dbError?.message)
    return NextResponse.json({ error: 'Failed to save item' }, { status: 500 })
  }

  return NextResponse.json(
    {
      id: row.id,
      storagePath: row.storage_path,
      publicUrl: row.public_url,
      displayOrder: row.display_order,
      caption: row.caption,
      mediaType: row.media_type,
      posterUrl: row.poster_url,
    },
    { status: 201 },
  )
}
