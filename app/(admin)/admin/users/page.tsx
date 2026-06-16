import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { UsersTable } from '@/components/admin/UsersTable'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Users' }

export default async function AdminUsersPage() {
  const supabase = createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Fetch all profiles joined with their subscription plan
  const { data: profiles } = await supabase
    .from('profiles')
    .select(`
      id,
      email,
      full_name,
      role,
      created_at,
      deleted_at,
      subscriptions (
        plan,
        status
      )
    `)
    .order('created_at', { ascending: false })
    .limit(500)

  const users = (profiles ?? []).map((p) => {
    const sub = Array.isArray(p.subscriptions) ? p.subscriptions[0] : p.subscriptions
    const isActive = sub?.status === 'active' || sub?.status === 'trialing'
    return {
      id: p.id,
      email: p.email,
      fullName: p.full_name,
      role: p.role,
      plan: isActive && sub ? sub.plan : 'free',
      subscriptionStatus: sub?.status ?? null,
      createdAt: p.created_at,
      deletedAt: p.deleted_at,
    }
  })

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-white">User Management</h1>
        <p className="text-white/40 text-sm mt-0.5">
          View and manage all registered users
        </p>
      </div>

      <UsersTable initialUsers={users} />
    </div>
  )
}
