import type { Metadata } from 'next'
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { resolveInviteByToken } from '@/lib/studio/access'
import { AcceptInviteButton } from '@/components/studio/AcceptInviteButton'

export const metadata: Metadata = {
  title: 'Accept studio invitation',
  robots: { index: false, follow: false },
}

interface AcceptPageProps {
  searchParams: { token?: string }
}

// Shared page chrome — matches the auth pages' ink/parchment/gold language.
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-ink px-4 py-16">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="mb-10 block text-center font-display text-2xl font-bold text-parchment-100 transition-opacity hover:opacity-80"
        >
          Ink<span className="text-gold-500">quire</span>
        </Link>
        {children}
      </div>
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-900 p-8 shadow-lg">{children}</div>
  )
}

export default async function StudioAcceptPage({ searchParams }: AcceptPageProps) {
  const token = typeof searchParams.token === 'string' ? searchParams.token.trim() : ''

  // ── No token ──
  if (!token) {
    return (
      <Shell>
        <Card>
          <h1 className="mb-1 font-display text-2xl font-bold text-parchment-100">
            Invitation link incomplete
          </h1>
          <p className="text-sm text-ink-400">
            This link is missing its invitation code. Please open the link from your invitation
            email exactly as it was sent.
          </p>
        </Card>
      </Shell>
    )
  }

  const invite = await resolveInviteByToken(token)

  // ── Unknown / invalid token ──
  if (!invite) {
    return (
      <Shell>
        <Card>
          <h1 className="mb-1 font-display text-2xl font-bold text-parchment-100">
            Invitation not found
          </h1>
          <p className="text-sm text-ink-400">
            This invitation link isn&rsquo;t valid. It may have been withdrawn — ask the studio
            owner to send you a fresh invite.
          </p>
        </Card>
      </Shell>
    )
  }

  const invitedByLine = invite.inviterName
    ? `${invite.inviterName} invited you to join`
    : 'You have been invited to join'

  // ── Withdrawn ──
  if (invite.status === 'removed') {
    return (
      <Shell>
        <Card>
          <h1 className="mb-1 font-display text-2xl font-bold text-parchment-100">
            Invitation unavailable
          </h1>
          <p className="text-sm text-ink-400">
            This invitation to <strong className="text-parchment-100">{invite.studioName}</strong>{' '}
            is no longer available. Please contact the studio owner.
          </p>
        </Card>
      </Shell>
    )
  }

  // ── Expired ──
  if (invite.isExpired && invite.status !== 'active') {
    return (
      <Shell>
        <Card>
          <h1 className="mb-1 font-display text-2xl font-bold text-parchment-100">
            Invitation expired
          </h1>
          <p className="text-sm text-ink-400">
            Your invitation to <strong className="text-parchment-100">{invite.studioName}</strong>{' '}
            has expired. Ask the studio owner to send you a new one.
          </p>
        </Card>
      </Shell>
    )
  }

  // ── Who is looking at this page? ──
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const invitedEmail = (invite.invitedEmail ?? '').trim().toLowerCase()
  const loginHref = invitedEmail ? `/login?email=${encodeURIComponent(invitedEmail)}` : '/login'
  const signupHref = invitedEmail ? `/signup?email=${encodeURIComponent(invitedEmail)}` : '/signup'

  // ── Not signed in — prompt sign in / sign up with the invited email ──
  if (!user) {
    return (
      <Shell>
        <Card>
          <h1 className="mb-1 font-display text-2xl font-bold text-parchment-100">
            Join {invite.studioName}
          </h1>
          <p className="mb-6 text-sm text-ink-400">
            {invitedByLine} <strong className="text-parchment-100">{invite.studioName}</strong>
            {invite.invitedEmail ? (
              <>
                {' '}
                as <span className="text-parchment-200">{invite.invitedEmail}</span>
              </>
            ) : null}
            . Sign in — or create an account with that email — to accept.
          </p>
          <div className="space-y-3">
            <Link
              href={loginHref}
              className="inline-flex w-full items-center justify-center rounded-lg bg-gold-500 px-4 py-3 text-sm font-semibold text-ink-950 transition hover:bg-gold-400"
            >
              Sign in to accept
            </Link>
            <Link
              href={signupHref}
              className="inline-flex w-full items-center justify-center rounded-lg border border-ink-700 bg-ink-800 px-4 py-3 text-sm font-medium text-parchment-200 transition hover:border-ink-600 hover:bg-ink-700"
            >
              Create an account
            </Link>
          </div>
          <p className="mt-6 text-xs text-ink-500">
            Be sure to use{' '}
            <span className="text-ink-300">{invite.invitedEmail ?? 'the invited email address'}</span>{' '}
            — the invitation is tied to it.
          </p>
        </Card>
      </Shell>
    )
  }

  // ── Signed in, but as the wrong account ──
  const currentEmail = (user.email ?? '').trim().toLowerCase()
  if (!invitedEmail || currentEmail !== invitedEmail) {
    return (
      <Shell>
        <Card>
          <h1 className="mb-1 font-display text-2xl font-bold text-parchment-100">
            Wrong account
          </h1>
          <p className="mb-6 text-sm text-ink-400">
            This invitation was sent to{' '}
            <strong className="text-parchment-100">{invite.invitedEmail ?? 'a different email'}</strong>
            , but you&rsquo;re signed in as{' '}
            <span className="text-parchment-200">{user.email}</span>. Sign in with the invited
            email to accept.
          </p>
          <Link
            href={loginHref}
            className="inline-flex w-full items-center justify-center rounded-lg bg-gold-500 px-4 py-3 text-sm font-semibold text-ink-950 transition hover:bg-gold-400"
          >
            Switch account
          </Link>
        </Card>
      </Shell>
    )
  }

  // ── Already accepted (this account) ──
  if (invite.status === 'active') {
    return (
      <Shell>
        <Card>
          <h1 className="mb-1 font-display text-2xl font-bold text-parchment-100">
            You&rsquo;re already in
          </h1>
          <p className="mb-6 text-sm text-ink-400">
            You&rsquo;ve already accepted your invitation to{' '}
            <strong className="text-parchment-100">{invite.studioName}</strong>.
          </p>
          <Link
            href="/dashboard/studio"
            className="inline-flex w-full items-center justify-center rounded-lg bg-gold-500 px-4 py-3 text-sm font-semibold text-ink-950 transition hover:bg-gold-400"
          >
            Go to your studio
          </Link>
        </Card>
      </Shell>
    )
  }

  // ── Ready to accept ──
  return (
    <Shell>
      <Card>
        <h1 className="mb-1 font-display text-2xl font-bold text-parchment-100">
          Join {invite.studioName}
        </h1>
        <p className="mb-6 text-sm text-ink-400">
          {invitedByLine} <strong className="text-parchment-100">{invite.studioName}</strong> as{' '}
          {invite.role === 'front_desk' ? 'front-desk staff' : 'an artist'}. Accepting links your
          account to the studio&rsquo;s shared calendar and roster.
        </p>
        <AcceptInviteButton token={token} />
      </Card>
    </Shell>
  )
}
