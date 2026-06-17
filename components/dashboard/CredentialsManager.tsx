'use client'

import { useRef, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

type CredentialType = 'license' | 'award' | 'publication'

interface Credential {
  id: string
  type: CredentialType
  title: string
  issuingBody: string | null
  year: number | null
  expiryDate: string | null
  url: string | null
  storagePath: string | null
}

interface CredentialsManagerProps {
  artistId: string
  initialCredentials: Credential[]
}

const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

const inputCls =
  'w-full bg-white/5 border border-white/20 rounded-lg px-4 py-2.5 text-white placeholder-white/25 text-sm focus:outline-none focus:border-white/50 transition-colors'

const TYPE_LABELS: Record<CredentialType, string> = {
  license: 'License',
  award: 'Award',
  publication: 'Publication',
}

function generateId() {
  return Math.random().toString(36).slice(2)
}

export function CredentialsManager({ artistId, initialCredentials }: CredentialsManagerProps) {
  const supabase = getSupabaseBrowserClient()
  const [credentials, setCredentials] = useState<Credential[]>(initialCredentials)
  const [activeType, setActiveType] = useState<CredentialType>('license')
  const [title, setTitle] = useState('')
  const [issuingBody, setIssuingBody] = useState('')
  const [year, setYear] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [url, setUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const resetForm = () => {
    setTitle('')
    setIssuingBody('')
    setYear('')
    setExpiryDate('')
    setUrl('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleAdd = async (file: File | null) => {
    if (!title.trim()) {
      setError('Title is required')
      return
    }
    if (file && (!ALLOWED_FILE_TYPES.includes(file.type) || file.size > MAX_FILE_SIZE)) {
      setError('File must be JPEG, PNG, WEBP, or PDF and under 10MB')
      return
    }

    setUploading(true)
    setError(null)

    let storagePath: string | null = null

    if (file) {
      const ext = file.name.split('.').pop() ?? 'pdf'
      const path = `${artistId}/${Date.now()}-${generateId()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('credentials')
        .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type })

      if (uploadError) {
        setError(uploadError.message)
        setUploading(false)
        return
      }
      storagePath = path
    }

    const { data: row, error: dbError } = await supabase
      .from('artist_credentials')
      .insert({
        artist_id: artistId,
        type: activeType,
        title: title.trim(),
        issuing_body: issuingBody.trim() || null,
        year: year ? parseInt(year, 10) : null,
        expiry_date: expiryDate || null,
        url: url.trim() || null,
        storage_path: storagePath,
      })
      .select('id, type, title, issuing_body, year, expiry_date, url, storage_path')
      .single()

    setUploading(false)

    if (dbError || !row) {
      setError(dbError?.message ?? 'Failed to save credential')
      return
    }

    setCredentials((prev) => [
      ...prev,
      {
        id: row.id,
        type: row.type,
        title: row.title,
        issuingBody: row.issuing_body,
        year: row.year,
        expiryDate: row.expiry_date,
        url: row.url,
        storagePath: row.storage_path,
      },
    ])
    resetForm()
  }

  const handleDelete = async (cred: Credential) => {
    setError(null)
    const { error: deleteError } = await supabase
      .from('artist_credentials')
      .delete()
      .eq('id', cred.id)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    if (cred.storagePath) {
      await supabase.storage.from('credentials').remove([cred.storagePath])
    }

    setCredentials((prev) => prev.filter((c) => c.id !== cred.id))
  }

  const grouped: Record<CredentialType, Credential[]> = {
    license: credentials.filter((c) => c.type === 'license'),
    award: credentials.filter((c) => c.type === 'award'),
    publication: credentials.filter((c) => c.type === 'publication'),
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-red-400 text-sm" role="alert">
          {error}
        </div>
      )}

      {(['license', 'award', 'publication'] as CredentialType[]).map((type) => (
        <div key={type} className="space-y-2">
          <p className="text-sm font-medium text-white/70">{TYPE_LABELS[type]}s</p>
          {grouped[type].length === 0 ? (
            <p className="text-white/30 text-sm">None added yet.</p>
          ) : (
            <ul className="space-y-2" aria-label={`${TYPE_LABELS[type]} list`}>
              {grouped[type].map((cred) => (
                <li key={cred.id} className="flex items-start justify-between gap-4 rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="min-w-0 text-sm">
                    <p className="text-white font-medium">{cred.title}</p>
                    <p className="text-white/40 text-xs mt-0.5">
                      {[cred.issuingBody, cred.year, cred.expiryDate ? `expires ${cred.expiryDate}` : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDelete(cred)}
                    aria-label={`Delete ${cred.title}`}
                    className="text-red-400/70 hover:text-red-400 text-xs font-medium flex-shrink-0"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      <div className="space-y-3 pt-2 border-t border-white/10">
        <p className="text-sm font-medium text-white/70">Add a credential</p>

        <div className="flex gap-2" role="group" aria-label="Credential type">
          {(['license', 'award', 'publication'] as CredentialType[]).map((type) => (
            <button
              key={type}
              type="button"
              aria-pressed={activeType === type}
              onClick={() => setActiveType(type)}
              className={[
                'px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150',
                activeType === type ? 'bg-white text-black border-white' : 'border-white/20 text-white/50 hover:border-white/50 hover:text-white',
              ].join(' ')}
            >
              {TYPE_LABELS[type]}
            </button>
          ))}
        </div>

        <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="Title" maxLength={200} aria-label="Title" />
        <input value={issuingBody} onChange={(e) => setIssuingBody(e.target.value)} className={inputCls} placeholder={activeType === 'publication' ? 'Publication name' : 'Issuing authority / body'} maxLength={200} aria-label="Issuing body" />
        <div className="flex gap-3">
          <input value={year} onChange={(e) => setYear(e.target.value)} type="number" className={inputCls} placeholder="Year" aria-label="Year" />
          {activeType === 'license' && (
            <input value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} type="date" className={`${inputCls} [color-scheme:dark]`} aria-label="Expiry date" />
          )}
        </div>
        {activeType === 'publication' && (
          <input value={url} onChange={(e) => setUrl(e.target.value)} type="url" className={inputCls} placeholder="https://…" aria-label="Publication URL" />
        )}
        {(activeType === 'license' || activeType === 'award') && (
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="block w-full text-sm text-white/60"
            aria-label={activeType === 'license' ? 'License document' : 'Award image (optional)'}
          />
        )}

        <button
          type="button"
          onClick={() => void handleAdd(fileInputRef.current?.files?.[0] ?? null)}
          disabled={uploading || !title.trim()}
          className="px-4 py-2 rounded-lg bg-white text-black text-sm font-semibold hover:bg-white/90 disabled:opacity-40 transition-colors"
        >
          {uploading ? 'Saving…' : 'Add credential'}
        </button>
      </div>
    </div>
  )
}
