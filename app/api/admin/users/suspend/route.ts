import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import { SuspendUserSchema } from '@/lib/validations/admin'

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
  const parsed = SuspendUserSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const { userId, suspend } = parsed.data

  // ── 3. Prevent self-suspension ─────────────────────────────────────────────
  if (userId === user.id) {
    return NextResponse.json({ error: 'Cannot suspend your own account' }, { status: 400 })
  }

  // ── 4. Prevent suspension of other admins ──────────────────────────────────
  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  if (!targetProfile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  if (targetProfile.role === 'admin') {
    return NextResponse.json({ error: 'Cannot suspend admin users' }, { status: 400 })
  }

  // ── 5. Suspend or unsuspend via Supabase Admin Auth ────────────────────────
  const adminClient = createSupabaseAdminClient()

  if (suspend) {
    // Set deleted_at on profile (soft-delete)
    const { error: profileError } = await adminClient
      .from('profiles')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', userId)

    if (profileError) {
      return NextResponse.json({ error: 'Failed to suspend user' }, { status: 500 })
    }

    // Ban user in Supabase Auth (prevents login)
    const { error: banError } = await adminClient.auth.admin.updateUserById(userId, {
      ban_duration: '876000h', // ~100 years
    })

    if (banError) {
      console.error('[admin] ban user error:', banError.message)
      // Profile is already soft-deleted; the ban is secondary
    }
  } else {
    // Remove soft-delete
    const { error: profileError } = await adminClient
      .from('profiles')
      .update({ deleted_at: null })
      .eq('id', userId)

    if (profileError) {
      return NextResponse.json({ error: 'Failed to unsuspend user' }, { status: 500 })
    }

    // Unban user in Supabase Auth
    const { error: unbanError } = await adminClient.auth.admin.updateUserById(userId, {
      ban_duration: 'none',
    })

    if (unbanError) {
      console.error('[admin] unban user error:', unbanError.message)
    }
  }

  // ── 6. Log audit event ─────────────────────────────────────────────────────
  await adminClient.from('audit_logs').insert({
    user_id: user.id,
    action: suspend ? 'user_suspended' : 'user_unsuspended',
    resource_type: 'profile',
    resource_id: userId,
    metadata: { target_user_id: userId },
    ip_address: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? null,
  })

  return NextResponse.json({ success: true })
}
