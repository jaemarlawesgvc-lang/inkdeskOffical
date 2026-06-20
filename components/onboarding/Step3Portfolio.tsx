'use client'

import { useCallback, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import type { PortfolioImageMeta } from '@/lib/validations/onboarding'
import { StepIntro, WizardNav, Hint } from '@/components/onboarding/ui'

interface UploadItem {
  id: string
  storagePath: string
  publicUrl: string
  previewUrl: string
  caption: string
  displayOrder: number
  status: 'uploading' | 'done' | 'error'
  error?: string
}

interface Step3Props {
  artistId: string
  defaultImages?: PortfolioImageMeta[]
  onNext: (images: PortfolioImageMeta[]) => void
  onBack: () => void
  isSaving: boolean
}

function generateId() {
  return Math.random().toString(36).slice(2)
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export function Step3Portfolio({
  artistId,
  defaultImages = [],
  onNext,
  onBack,
  isSaving,
}: Step3Props) {
  const [items, setItems] = useState<UploadItem[]>(() =>
    (defaultImages ?? []).map((meta, index) => ({
      id: generateId(),
      storagePath: meta.storagePath,
      publicUrl: meta.publicUrl,
      previewUrl: meta.publicUrl,
      caption: meta.caption ?? '',
      displayOrder: meta.displayOrder ?? index,
      status: 'done' as const,
    })),
  )
  const [dragSrcId, setDragSrcId] = useState<string | null>(null)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [rejectNote, setRejectNote] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Monotonic small-integer counter for display_order. The DB column is a
  // Postgres `integer` (max 2,147,483,647), so a millisecond timestamp would
  // overflow it ("value out of range for type integer"). Final order is
  // re-indexed 0..n on save anyway — this just needs to be a valid, increasing int.
  const nextOrderRef = useRef<number>((defaultImages ?? []).length)
  const supabase = getSupabaseBrowserClient()

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return
      setRejectNote(null)

      // Validate first so we can tell the user *why* a file didn't upload
      // (previously rejected files were silently skipped — "nothing happens").
      const accepted: File[] = []
      const rejected: string[] = []
      for (const file of Array.from(files)) {
        if (!ALLOWED_TYPES.includes(file.type)) {
          rejected.push(`${file.name || 'file'} (must be JPEG, PNG or WebP)`)
        } else if (file.size > MAX_FILE_SIZE) {
          rejected.push(`${file.name || 'file'} (over 10MB)`)
        } else {
          accepted.push(file)
        }
      }

      if (rejected.length > 0) {
        setRejectNote(
          rejected.length === 1
            ? `Couldn't add ${rejected[0]}.`
            : `Couldn't add ${rejected.length} files: ${rejected.join(', ')}.`,
        )
      }

      for (const file of accepted) {
        const id = generateId()
        const previewUrl = URL.createObjectURL(file)
        const displayOrder = nextOrderRef.current++

        setItems((prev) => [
          ...prev,
          {
            id,
            storagePath: '',
            publicUrl: '',
            previewUrl,
            caption: '',
            displayOrder,
            status: 'uploading',
          },
        ])

        const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase()
        const path = `${artistId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('portfolio-images')
          .upload(path, file, {
            cacheControl: '31536000',
            upsert: false,
            contentType: file.type,
          })

        if (uploadError) {
          setItems((prev) =>
            prev.map((item) =>
              item.id === id
                ? { ...item, status: 'error', error: uploadError.message }
                : item,
            ),
          )
          continue
        }

        const { data: urlData } = supabase.storage
          .from('portfolio-images')
          .getPublicUrl(path)

        const { data: row, error: dbError } = await supabase
          .from('portfolio_images')
          .insert({
            artist_id: artistId,
            storage_path: path,
            public_url: urlData.publicUrl,
            display_order: displayOrder,
            caption: '',
          })
          .select('id, storage_path, public_url, display_order, caption')
          .single()

        if (dbError || !row) {
          setItems((prev) =>
            prev.map((item) =>
              item.id === id
                ? { ...item, status: 'error', error: dbError?.message ?? 'Failed to save image' }
                : item,
            ),
          )
          continue
        }

        // Swap the local object-URL preview for the stored public URL so the
        // image keeps rendering after the blob is revoked / page reloads.
        setItems((prev) =>
          prev.map((item) => {
            if (item.id !== id) return item
            if (item.previewUrl.startsWith('blob:')) URL.revokeObjectURL(item.previewUrl)
            return {
              ...item,
              storagePath: row.storage_path,
              publicUrl: row.public_url,
              previewUrl: row.public_url,
              status: 'done',
            }
          }),
        )
      }
    },
    [artistId, supabase],
  )

  const handleCaptionChange = (id: string, caption: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, caption } : item)))
  }

  const handleRemove = async (id: string) => {
    const item = items.find((i) => i.id === id)
    setItems((prev) => prev.filter((i) => i.id !== id))
    if (item?.storagePath) {
      await supabase.from('portfolio_images').delete().eq('storage_path', item.storagePath)
    }
  }

  const handleDrop = (targetId: string) => {
    if (!dragSrcId || dragSrcId === targetId) return
    setItems((prev) => {
      const srcIdx = prev.findIndex((i) => i.id === dragSrcId)
      const tgtIdx = prev.findIndex((i) => i.id === targetId)
      if (srcIdx === -1 || tgtIdx === -1) return prev
      const next = [...prev]
      const [moved] = next.splice(srcIdx, 1)
      if (!moved) return prev
      next.splice(tgtIdx, 0, moved)
      return next.map((item, idx) => ({ ...item, displayOrder: idx }))
    })
    setDragSrcId(null)
  }

  const handleNextClick = () => {
    const images: PortfolioImageMeta[] = items
      .filter((item) => item.status === 'done')
      .map((item, index) => ({
        storagePath: item.storagePath,
        publicUrl: item.publicUrl,
        caption: item.caption,
        displayOrder: index,
      }))
    onNext(images)
  }

  const uploadingCount = items.filter((item) => item.status === 'uploading').length
  const doneCount = items.filter((item) => item.status === 'done').length
  const busy = isSaving || uploadingCount > 0

  return (
    <div className="space-y-8">
      <StepIntro
        eyebrow="Step 3 · Portfolio"
        title="Show your best work"
        description="Upload a handful of standout pieces — three or more is ideal. Drag to reorder; you can always add more later."
      />

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setIsDraggingOver(true)
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsDraggingOver(false)
          void handleFiles(e.dataTransfer.files)
        }}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'group flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-12 text-center transition-all duration-200',
          isDraggingOver
            ? 'border-gold-500 bg-gold-500/[0.06]'
            : 'border-ink-700 bg-ink-900/30 hover:border-gold-500/50 hover:bg-ink-900/50',
        )}
      >
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-ink-700 bg-ink-900 text-gold-500 transition-colors group-hover:border-gold-500/40">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-5 w-5" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0L8 8m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
          </svg>
        </span>
        <p className="text-sm font-medium text-parchment-100">
          Drag &amp; drop your images, or <span className="text-gold-400">browse files</span>
        </p>
        <p className="mt-1 text-xs text-ink-500">JPEG, PNG, or WebP — up to 10MB each</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
      </div>

      {/* Rejected-file notice */}
      {rejectNote && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-crimson-500/30 bg-crimson-500/10 px-4 py-3 text-sm text-crimson-400"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          {rejectNote}
        </div>
      )}

      {/* Count */}
      {items.length > 0 && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-ink-400">
            <span className="font-semibold text-parchment-200">{doneCount}</span> image
            {doneCount === 1 ? '' : 's'} ready
            {doneCount < 3 && <span className="text-ink-600"> · 3+ recommended</span>}
          </span>
          {uploadingCount > 0 && (
            <span className="flex items-center gap-1.5 text-gold-400">
              <span className="h-1.5 w-1.5 animate-pulse-gold rounded-full bg-gold-500" />
              Uploading {uploadingCount}…
            </span>
          )}
        </div>
      )}

      {/* Grid */}
      {items.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.id}
              draggable={item.status === 'done'}
              onDragStart={() => setDragSrcId(item.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(item.id)}
              className={cn(
                'group overflow-hidden rounded-xl border bg-ink-900 transition-all duration-150',
                item.status === 'done'
                  ? 'cursor-grab border-ink-800 hover:border-gold-500/40 active:cursor-grabbing'
                  : 'border-ink-800',
              )}
            >
              <div className="relative aspect-square overflow-hidden bg-ink-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.previewUrl}
                  alt={item.caption || 'Portfolio image'}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                />
                {item.status === 'uploading' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-ink-950/70 backdrop-blur-sm">
                    <svg className="h-6 w-6 animate-spin text-gold-500" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </div>
                )}
                {item.status === 'done' && (
                  <button
                    type="button"
                    onClick={() => void handleRemove(item.id)}
                    aria-label="Remove image"
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-ink-950/70 text-parchment-200 opacity-0 backdrop-blur-sm transition-all duration-150 hover:bg-crimson-600 hover:text-white group-hover:opacity-100"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                    </svg>
                  </button>
                )}
              </div>
              <div className="p-2.5">
                {item.status === 'error' ? (
                  <p className="text-xs text-crimson-400">{item.error}</p>
                ) : (
                  <input
                    type="text"
                    value={item.caption}
                    onChange={(e) => handleCaptionChange(item.id, e.target.value)}
                    placeholder="Caption (optional)"
                    disabled={item.status !== 'done'}
                    className="w-full rounded-md border border-ink-800 bg-ink-950/50 px-2.5 py-1.5 text-xs text-parchment-100 placeholder:text-ink-600 focus:border-gold-500/40 focus:outline-none"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-ink-800 bg-ink-900/30 px-5 py-8 text-center">
          <Hint>No images yet — add a few to bring your page to life, or continue and upload later.</Hint>
        </div>
      )}

      <WizardNav
        onBack={onBack}
        submitType="button"
        onSubmit={handleNextClick}
        submitLabel="Continue"
        busy={busy}
        busyLabel={uploadingCount > 0 ? 'Uploading…' : 'Saving…'}
      />
    </div>
  )
}
