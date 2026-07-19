'use client'

import { useEffect, useState, useCallback } from 'react'

interface TxtRecord {
  host: string
  value: string
}

interface DomainState {
  domain: string | null
  verified: boolean
  verifiedAt: string | null
  txtRecord: TxtRecord | null
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="space-y-1">
      <p className="text-white/40 text-xs font-medium uppercase tracking-wider">{label}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 min-w-0 truncate rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-white/90">
          {value}
        </code>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(value)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
          className="shrink-0 px-3 py-2 rounded-lg text-xs font-semibold text-white/70 border border-white/20 hover:text-white hover:border-white/50 transition-colors"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  )
}

export function CustomDomainManager() {
  const [state, setState] = useState<DomainState | null>(null)
  const [loading, setLoading] = useState(true)
  const [upgradeRequired, setUpgradeRequired] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/dashboard/custom-domain')
      if (res.status === 403) {
        setUpgradeRequired(true)
        return
      }
      if (!res.ok) throw new Error('Failed to load domain settings')
      const json = (await res.json()) as DomainState
      setState(json)
      setInput(json.domain ?? '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load domain settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleSave = async () => {
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      const res = await fetch('/api/dashboard/custom-domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: input }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setError(json?.error ?? 'Could not save domain')
        return
      }
      setNotice('Domain saved. Add the TXT record below, then verify.')
      await load()
    } finally {
      setBusy(false)
    }
  }

  const handleVerify = async () => {
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      const res = await fetch('/api/dashboard/custom-domain', { method: 'PATCH' })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setError(json?.error ?? 'Verification failed')
        return
      }
      if (json?.verified) {
        setNotice('Domain verified. Your public page is now live on your custom domain.')
      } else {
        setError(json?.error ?? 'Not verified yet.')
      }
      await load()
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async () => {
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      const res = await fetch('/api/dashboard/custom-domain', { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        setError(json?.error ?? 'Could not remove domain')
        return
      }
      setInput('')
      setNotice('Domain removed.')
      await load()
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  if (upgradeRequired) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center space-y-4">
        <div className="w-12 h-12 mx-auto bg-amber-500/20 rounded-full flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6 text-amber-400">
            <path fillRule="evenodd" d="M4.083 9h1.946c.089-1.546.383-2.97.837-4.118A6.004 6.004 0 004.083 9zM10 2a8 8 0 100 16 8 8 0 000-16zm0 2c-.076 0-.232.032-.465.262-.238.234-.497.623-.737 1.182-.389.907-.673 2.142-.766 3.556h3.936c-.093-1.414-.377-2.649-.766-3.556-.24-.56-.5-.948-.737-1.182C10.232 4.032 10.076 4 10 4z" clipRule="evenodd" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-white">Custom domains require Studio</h2>
        <p className="text-white/50 text-sm max-w-md mx-auto">
          Upgrade to the Studio plan to point your own domain (e.g. book.yourstudio.com) at your Inkquire page.
        </p>
        <a
          href="/dashboard/settings/billing"
          className="inline-block px-5 py-2.5 bg-white text-black text-sm font-semibold rounded-lg hover:bg-white/90 transition-colors"
        >
          Upgrade Plan
        </a>
      </div>
    )
  }

  const verified = state?.verified ?? false

  return (
    <div className="space-y-6 max-w-2xl">
      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-red-400 text-sm" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-4 py-3 text-emerald-300 text-sm" role="status">
          {notice}
        </div>
      )}

      {/* Domain input */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="custom-domain" className="text-sm font-semibold text-white">
            Your domain
          </label>
          {state?.domain && (
            <span
              className={[
                'text-xs font-semibold px-2 py-0.5 rounded-full',
                verified ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300',
              ].join(' ')}
            >
              {verified ? 'Verified' : 'Pending verification'}
            </span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            id="custom-domain"
            type="text"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="book.yourstudio.com"
            className="flex-1 rounded-lg bg-black/40 border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/40"
          />
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={busy || input.trim().length === 0 || input.trim() === (state?.domain ?? '')}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold bg-white text-black hover:bg-white/90 disabled:bg-white/10 disabled:text-white/30 disabled:cursor-not-allowed transition-colors"
          >
            {state?.domain ? 'Update' : 'Add domain'}
          </button>
        </div>
        <p className="text-white/40 text-xs">
          Enter a domain or subdomain you own. You&apos;ll add a DNS record to prove ownership.
        </p>
      </div>

      {/* DNS instructions */}
      {state?.txtRecord && !verified && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Step 1 — Verify ownership</h3>
            <p className="text-white/40 text-xs mt-0.5">
              Add this TXT record at your DNS provider, then click Verify. Propagation can take a few minutes.
            </p>
          </div>
          <CopyField label="TXT record host" value={state.txtRecord.host} />
          <CopyField label="TXT record value" value={state.txtRecord.value} />

          <div className="pt-1">
            <h3 className="text-sm font-semibold text-white">Step 2 — Point the domain here</h3>
            <p className="text-white/40 text-xs mt-0.5">
              Add a CNAME record for your domain pointing to{' '}
              <code className="text-white/70">cname.vercel-dns.com</code>. Once both records resolve, your
              page will load on the custom domain.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void handleVerify()}
            disabled={busy}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold bg-white text-black hover:bg-white/90 disabled:bg-white/10 disabled:text-white/30 disabled:cursor-not-allowed transition-colors"
          >
            {busy ? 'Checking…' : 'Verify domain'}
          </button>
        </div>
      )}

      {verified && state?.domain && (
        <div className="bg-emerald-500/[0.06] border border-emerald-500/20 rounded-xl p-5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">Live on your custom domain</p>
            <a
              href={`https://${state.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-300 text-sm hover:underline truncate block"
            >
              {state.domain}
            </a>
          </div>
        </div>
      )}

      {state?.domain && (
        <button
          type="button"
          onClick={() => void handleRemove()}
          disabled={busy}
          className="text-sm font-medium text-red-400/80 hover:text-red-400 transition-colors disabled:opacity-40"
        >
          Remove domain
        </button>
      )}
    </div>
  )
}
