'use client'

import { useState, useRef, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import type { Plan } from '@/lib/stripe/plans'
import { PLAN_LIMITS } from '@/lib/stripe/plans'

interface PortfolioImage {
  id: string
  storagePath: string
  publicUrl: string
  displayOrder: number
  caption: string | null
}

interface PortfolioGridProps {
  artistId: string
  images: PortfolioImage[]
  plan: Plan
}

export function PortfolioGrid({ artistId, images: initialImages, plan }: PortfolioGridProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [images, setImages] = useState(initialImages)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [dragSrcId, setDragSrcId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = getSupabaseBrowserClient()

  const limit = PLAN_LIMITS[plan].portfolioImages
  const atLimit = limit !== Infinity && images.length >= limit

  const handleUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return
      setUploadError(null)
      setUploading(true)

      const newImages: PortfolioImage[] = []

      for (const file of Array.from(files)) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) continue
        if (file.size > 10 * 1024 * 1024) {
          setUploadError('One or more files exceed the 10 MB limit')
          continue
        }

        const ext = file.name.split('.').pop() ?? 'jpg'
        const path = `${artistId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('portfolio-images')
          .upload(path, file, { cacheControl: '31536000', upsert: false, contentType: file.type })

        if (uploadError) {
          setUploadError(uploadError.message)
          continue
        }

        const { data: urlData } = supabase.storage.from('portfolio-images').getPublicUrl(path)

        // Persist to DB
        const { data: row, error: dbError } = await supabase
          .from('portfolio_images')
          .insert({
            artist_id: artistId,
            storage_path: path,
            public_url: urlData.publicUrl,
            display_order: images.length + newImages.length,
            caption: '',
          })
          .select('id, storage_path, public_url, display_order, caption')
          .single()

        if (dbError || !row) {
          setUploadError(dbError?.message ?? 'Failed to save image')
          continue
        }

        newImages.push({
          id: row.id,
          storagePath: row.storage_path,
          publicUrl: row.public_url,
          displayOrder: row.display_order,
          caption: row.caption,
        })
      }

      setImages((prev) => [...prev, ...newImages])
      setUploading(false)
      startTransition(() => router.refresh())
    },
    [artistId, images.length, supabase, router],
  )

  const handleDelete = async (imageId: string, _storagePath: string) => {
    // Soft delete in DB
    const { error: dbError } = await supabase
      .from('portfolio_images')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', imageId)

    if (dbError) {
      setUploadError(dbError.message)
      return
    }

    setImages((prev) => prev.filter((img) => img.id !== imageId))
    setConfirmDeleteId(null)
    startTransition(() => router.refresh())
  }

  const handleDropReorder = async (targetId: string) => {
    if (!dragSrcId || dragSrcId === targetId) {
      setDragOverId(null)
      return
    }

    setImages((prev) => {
      const srcIdx = prev.findIndex((i) => i.id === dragSrcId)
      const tgtIdx = prev.findIndex((i) => i.id === targetId)
      if (srcIdx === -1 || tgtIdx === -1) return prev
      const next = [...prev]
      const [moved] = next.splice(srcIdx, 1)
      if (!moved) return prev
      next.splice(tgtIdx, 0, moved)
      return next.map((img, idx) => ({ ...img, displayOrder: idx }))
    })

    setDragOverId(null)
    setDragSrcId(null)

    // Persist new order
    const reordered = images.map((img, idx) => ({ id: img.id, displayOrder: idx }))

    await Promise.all(
      reordered.map(({ id, displayOrder }) =>
        supabase.from('portfolio_images').update({ display_order: displayOrder }).eq('id', id),
      ),
    )
  }

  return (
    <div className="space-y-5">
      {/* Upload bar */}
      <div className="flex items-center gap-4 flex-wrap">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || atLimit}
          className={[
            'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150',
            !uploading && !atLimit
              ? 'bg-white text-black hover:bg-white/90 active:scale-95'
              : 'bg-white/10 text-white/30 cursor-not-allowed',
          ].join(' ')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
          {uploading ? 'Uploading…' : 'Upload images'}
        </button>

        <p className="text-white/30 text-sm">
          {images.length}
          {limit !== Infinity ? ` / ${limit}` : ''} images
          {atLimit && (
            <span className="ml-2 text-amber-400">
              — Plan limit reached.{' '}
              <a href="/dashboard/settings#billing" className="underline">
                Upgrade
              </a>
            </span>
          )}
        </p>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => void handleUpload(e.target.files)}
          className="sr-only"
          aria-hidden="true"
        />
      </div>

      {uploadError && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-red-400 text-sm" role="alert">
          {uploadError}
        </div>
      )}

      {/* Grid */}
      {images.length === 0 ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click()
          }}
          className="border-2 border-dashed border-white/20 rounded-xl p-12 text-center cursor-pointer hover:border-white/40 transition-colors"
        >
          <p className="text-white/40 text-sm">No portfolio images yet. Click to upload.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" role="list" aria-label="Portfolio images">
          {images.map((img, idx) => {
            const overLimit = limit !== Infinity && idx >= limit
            return (
              <div
                key={img.id}
                role="listitem"
                draggable
                onDragStart={() => setDragSrcId(img.id)}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOverId(img.id)
                }}
                onDrop={() => void handleDropReorder(img.id)}
                onDragEnd={() => {
                  setDragOverId(null)
                  setDragSrcId(null)
                }}
                className={[
                  'relative aspect-square rounded-xl overflow-hidden group cursor-grab active:cursor-grabbing transition-all duration-150',
                  overLimit ? 'opacity-40 grayscale' : '',
                  dragOverId === img.id ? 'ring-2 ring-white scale-105' : '',
                ].join(' ')}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.publicUrl}
                  alt={img.caption ?? `Portfolio image ${idx + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />

                {overLimit && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <span className="text-white/70 text-xs font-medium text-center px-2">Over plan limit</span>
                  </div>
                )}

                {!overLimit && (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(img.id)}
                    aria-label="Delete image"
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5" aria-hidden="true">
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDeleteId &&
        (() => {
          const img = images.find((i) => i.id === confirmDeleteId)
          if (!img) return null
          return (
            <div
              className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
              role="dialog"
              aria-modal="true"
              aria-label="Confirm deletion"
            >
              <div className="bg-[#171717] border border-white/10 rounded-xl p-6 max-w-sm w-full space-y-4">
                <h3 className="text-white font-semibold text-lg">Delete image?</h3>
                <p className="text-white/50 text-sm">
                  This image will be removed from your portfolio. This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(null)}
                    className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white/60 border border-white/20 hover:text-white hover:border-white/50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(img.id, img.storagePath)}
                    className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-500 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )
        })()}
    </div>
  )
}