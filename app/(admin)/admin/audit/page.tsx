import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AuditTable } from '@/components/admin/AuditTable'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Audit Log' }

export default async function AdminAuditPage() {
  const supabase = createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Fetch recent audit logs with user email
  const { data: logs } = await supabase
    .from('audit_logs')
    .select(`
      id,
      user_id,
      action,
      resource_type,
      resource_id,
      metadata,
      ip_address,
      created_at,
      profiles!audit_logs_user_id_fkey (
        email
      )
    `)
    .order('created_at', { ascending: false })
    .limit(500)

  const mappedLogs = (logs ?? []).map((l) => {
    const profile = Array.isArray(l.profiles) ? l.profiles[0] : l.profiles
    return {
      id: l.id,
      userId: l.user_id,
      userEmail: profile?.email ?? null,
      action: l.action,
      resourceType: l.resource_type,
      resourceId: l.resource_id,
      metadata: (l.metadata ?? null) as Record<string, unknown> | null,
      ipAddress: l.ip_address,
      createdAt: l.created_at,
    }
  })

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Audit Log</h1>
        <p className="text-white/40 text-sm mt-0.5">
          All system events and user actions
        </p>
      </div>

      <AuditTable initialLogs={mappedLogs} />
    </div>
  )
}
