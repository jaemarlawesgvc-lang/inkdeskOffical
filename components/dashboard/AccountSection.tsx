'use client'

import { useState } from 'react'
import { forgotPasswordAction } from '@/lib/auth/actions'

interface AccountSectionProps {
  userEmail: string
  lastSignIn: string | null
  username: string
}

export function AccountSection({ userEmail, lastSignIn, username }: AccountSectionProps) {
  const [newEmail, setNewEmail] = useState('')
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [emailError, setEmailError] = useState<string | null>(null)

  const [resetStatus, setResetStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [resetError, setResetError] = useState<string | null>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordStatus, setPasswordStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [showPasswords, setShowPasswords] = useState(false)

  const [newUsername, setNewUsername] = useState('')
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [usernameError, setUsernameError] = useState<string | null>(null)

  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteStatus, setDeleteStatus] = useState<'idle' | 'deleting'>('idle')

  const handleResetPassword = async () => {
    setResetStatus('sending')
    setResetError(null)
    try {
      // Route through the shared forgot-password server action, which only ever
      // emails the address passed in. userEmail is the authenticated session's
      // own email (server-provided prop), so this cannot be used to bomb others.
      const formData = new FormData()
      formData.set('email', userEmail)
      const result = await forgotPasswordAction(
        { success: false, message: '' },
        formData,
      )
      if (!result.success) throw new Error(result.message || 'Failed to send reset email')
      setResetStatus('sent')
      setTimeout(() => setResetStatus('idle'), 5000)
    } catch (err) {
      setResetStatus('error')
      setResetError(err instanceof Error ? err.message : 'Failed to send reset email')
    }
  }

  const handleChangePassword = async () => {
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters')
      setPasswordStatus('error')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match')
      setPasswordStatus('error')
      return
    }

    setPasswordStatus('sending')
    setPasswordError(null)
    try {
      const res = await fetch('/api/dashboard/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Failed to change password')
      setPasswordStatus('sent')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPasswordStatus('idle'), 5000)
    } catch (err) {
      setPasswordStatus('error')
      setPasswordError(err instanceof Error ? err.message : 'Failed to change password')
    }
  }

  const handleChangeEmail = async () => {
    if (!newEmail || !newEmail.includes('@')) {
      setEmailError('Please enter a valid email address')
      setEmailStatus('error')
      return
    }

    setEmailStatus('sending')
    setEmailError(null)
    try {
      const res = await fetch('/api/dashboard/change-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Failed to update email')
      setEmailStatus('sent')
      setNewEmail('')
      setTimeout(() => setEmailStatus('idle'), 5000)
    } catch (err) {
      setEmailStatus('error')
      setEmailError(err instanceof Error ? err.message : 'Failed to update email')
    }
  }

  const handleChangeUsername = async () => {
    const slug = newUsername.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')
    if (!slug || slug.length < 3) {
      setUsernameError('Username must be at least 3 characters (letters, numbers, hyphens)')
      setUsernameStatus('error')
      return
    }

    setUsernameStatus('sending')
    setUsernameError(null)
    try {
      const res = await fetch('/api/dashboard/change-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newUsername: slug }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Failed to update username')
      setUsernameStatus('sent')
      setNewUsername('')
      setTimeout(() => {
        setUsernameStatus('idle')
        window.location.reload()
      }, 2000)
    } catch (err) {
      setUsernameStatus('error')
      setUsernameError(err instanceof Error ? err.message : 'Failed to update username')
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') return
    setDeleteStatus('deleting')
    try {
      const res = await fetch('/api/dashboard/delete-account', { method: 'POST' })
      if (res.ok) {
        window.location.href = '/login?message=account_deleted'
      } else {
        const json = (await res.json()) as { error?: string }
        alert(json.error ?? 'Failed to delete account')
        setDeleteStatus('idle')
      }
    } catch {
      alert('Failed to delete account')
      setDeleteStatus('idle')
    }
  }

  const inputCls =
    'w-full bg-white/5 border border-white/20 rounded-lg px-4 py-2.5 text-white placeholder-white/25 text-sm focus:outline-none focus:border-white/50 transition-colors'

  const formattedSignIn = lastSignIn
    ? new Date(lastSignIn).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Unknown'

  return (
    <section
      id="account"
      className="bg-white/5 border border-white/10 rounded-xl p-5 sm:p-6 space-y-6 max-w-2xl"
    >
      <div>
        <h2 className="text-base font-semibold text-white flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-5 h-5 text-white/50"
          >
            <path
              fillRule="evenodd"
              d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
              clipRule="evenodd"
            />
          </svg>
          Account &amp; Security
        </h2>
        <p className="text-white/40 text-sm mt-0.5">
          Manage your login credentials and account security.
        </p>
      </div>

      {/* ── Session Info ── */}
      <div className="bg-white/[0.03] rounded-lg border border-white/[0.06] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-white/40">
              Email
            </p>
            <p className="text-sm text-white mt-0.5 font-mono">{userEmail}</p>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
            </span>
            <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
              Active
            </span>
          </div>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-white/40">
            Last sign in
          </p>
          <p className="text-sm text-white/60 mt-0.5">{formattedSignIn}</p>
        </div>
      </div>

      {/* ── Change Password (inline) ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white">Change password</p>
            <p className="text-xs text-white/40 mt-0.5">
              Update your password directly.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowPasswords(!showPasswords)}
            className="text-xs text-white/40 hover:text-white/60 transition-colors"
          >
            {showPasswords ? 'Hide' : 'Show'}
          </button>
        </div>

        <div className="space-y-2.5">
          <input
            type={showPasswords ? 'text' : 'password'}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className={inputCls}
            placeholder="Current password"
          />
          <input
            type={showPasswords ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={inputCls}
            placeholder="New password (min. 8 characters)"
          />
          <input
            type={showPasswords ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={inputCls}
            placeholder="Confirm new password"
          />
        </div>

        {passwordError && (
          <p className="text-red-400 text-xs">{passwordError}</p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void handleChangePassword()}
            disabled={passwordStatus === 'sending' || !currentPassword || !newPassword || !confirmPassword}
            className={[
              'px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200',
              passwordStatus === 'sending'
                ? 'bg-white/10 text-white/40 cursor-not-allowed'
                : passwordStatus === 'sent'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-white/10 text-white hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed',
            ].join(' ')}
          >
            {passwordStatus === 'sending'
              ? 'Updating…'
              : passwordStatus === 'sent'
                ? '✓ Password updated'
                : 'Update password'}
          </button>
        </div>
      </div>

      {/* ── Divider ── */}
      <div className="border-t border-white/[0.06]" />

      {/* ── Reset via Email (fallback) ── */}
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium text-white">
            Forgot your password?
          </p>
          <p className="text-xs text-white/40 mt-0.5">
            We&apos;ll send a password reset link to{' '}
            <span className="text-white/60">{userEmail}</span>
          </p>
        </div>

        {resetError && (
          <p className="text-red-400 text-xs">{resetError}</p>
        )}

        <button
          type="button"
          onClick={() => void handleResetPassword()}
          disabled={resetStatus === 'sending' || resetStatus === 'sent'}
          className={[
            'px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200',
            resetStatus === 'sending'
              ? 'bg-white/10 text-white/40 cursor-not-allowed'
              : resetStatus === 'sent'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-white/10 text-white hover:bg-white/20',
          ].join(' ')}
        >
          {resetStatus === 'sending'
            ? 'Sending…'
            : resetStatus === 'sent'
              ? '✓ Reset email sent — check your inbox'
              : 'Send reset link'}
        </button>
      </div>

      {/* ── Divider ── */}
      <div className="border-t border-white/[0.06]" />

      {/* ── Change Email ── */}
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium text-white">Change email</p>
          <p className="text-xs text-white/40 mt-0.5">
            A confirmation link will be sent to both your current and new email
            address.
          </p>
        </div>

        <div className="flex gap-3">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className={`${inputCls} flex-1`}
            placeholder="new@example.com"
          />
          <button
            type="button"
            onClick={() => void handleChangeEmail()}
            disabled={emailStatus === 'sending' || !newEmail}
            className={[
              'px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all duration-200',
              emailStatus === 'sending'
                ? 'bg-white/10 text-white/40 cursor-not-allowed'
                : emailStatus === 'sent'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-white/10 text-white hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed',
            ].join(' ')}
          >
            {emailStatus === 'sending'
              ? 'Sending…'
              : emailStatus === 'sent'
                ? '✓ Sent'
                : 'Update'}
          </button>
        </div>

        {emailError && (
          <p className="text-red-400 text-xs">{emailError}</p>
        )}
        {emailStatus === 'sent' && (
          <p className="text-emerald-400 text-xs">
            Confirmation sent — check both your old and new email inboxes.
          </p>
        )}
      </div>

      {/* ── Divider ── */}
      <div className="border-t border-white/[0.06]" />

      {/* ── Change Username ── */}
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium text-white">Change username</p>
          <p className="text-xs text-white/40 mt-0.5">
            Your public page URL is <span className="text-white/60 font-mono">/{username}</span>. Changing this will break existing links.
          </p>
        </div>

        <div className="flex gap-3">
          <input
            type="text"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
            className={`${inputCls} flex-1`}
            placeholder="new-username"
            maxLength={30}
          />
          <button
            type="button"
            onClick={() => void handleChangeUsername()}
            disabled={usernameStatus === 'sending' || !newUsername}
            className={[
              'px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all duration-200',
              usernameStatus === 'sending'
                ? 'bg-white/10 text-white/40 cursor-not-allowed'
                : usernameStatus === 'sent'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-white/10 text-white hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed',
            ].join(' ')}
          >
            {usernameStatus === 'sending'
              ? 'Updating…'
              : usernameStatus === 'sent'
                ? '✓ Updated'
                : 'Update'}
          </button>
        </div>

        {usernameError && (
          <p className="text-red-400 text-xs">{usernameError}</p>
        )}
      </div>

      {/* ── Divider ── */}
      <div className="border-t border-red-500/20" />

      {/* ── Danger Zone: Delete Account ── */}
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium text-red-400 flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            Danger Zone
          </p>
          <p className="text-xs text-white/40 mt-0.5">
            Permanently delete your account, public page, and all associated data. This action cannot be undone.
          </p>
        </div>

        <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4 space-y-3">
          <p className="text-xs text-white/50">
            Type <span className="font-mono font-bold text-red-400">DELETE</span> to confirm:
          </p>
          <div className="flex gap-3">
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              className={`${inputCls} flex-1 border-red-500/30 focus:border-red-500/60`}
              placeholder="Type DELETE"
            />
            <button
              type="button"
              onClick={() => void handleDeleteAccount()}
              disabled={deleteConfirm !== 'DELETE' || deleteStatus === 'deleting'}
              className="px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap bg-red-600 text-white hover:bg-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {deleteStatus === 'deleting' ? 'Deleting…' : 'Delete Account'}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
