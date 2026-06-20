import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import { ResetPasswordSchema } from '@/lib/validations/admin'
import { getAppUrl } from '@/lib/app-url'

export const runtime = 'nodejs'

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── 1. Verify admin session ────────────────────────────────────────────────
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── 2. Validate input ─────────────────────────────────────────────────────
  const body = await request.json()
  const parsed = ResetPasswordSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const { userId } = parsed.data

  // ── 3. Look up user email ──────────────────────────────────────────────────
  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .single()

  if (!targetProfile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // ── 4. Generate password reset link via Admin API ──────────────────────────
  const adminClient = createSupabaseAdminClient()

  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: 'recovery',
    email: targetProfile.email,
    options: {
      redirectTo: `${getAppUrl()}/reset-password`,
    },
  })

  if (linkError || !linkData) {
    console.error('[admin] generate reset link error:', linkError?.message)
    return NextResponse.json({ error: 'Failed to generate password reset link' }, { status: 500 })
  }

  // ── 5. Log audit event ─────────────────────────────────────────────────────
  await adminClient.from('audit_logs').insert({
    user_id: user.id,
    action: 'admin_password_reset',
    resource_type: 'profile',
    resource_id: userId,
    metadata: { target_email: targetProfile.email },
    ip_address: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? null,
  })

  return NextResponse.json({
    success: true,
    message: `Password reset link generated for ${targetProfile.email}`,
  })
}
