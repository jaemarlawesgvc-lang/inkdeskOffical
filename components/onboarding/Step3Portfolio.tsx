'use client'

import { useCallback, useRef, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import type { PortfolioImageMeta } from '@/lib/validations/onboarding'

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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = getSupabaseBrowserClient()

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return

      for (const file of Array.from(files)) {
        if (!ALLOWED_TYPES.includes(file.type)) continue
        if (file.size > MAX_FILE_SIZE) continue

        const id = generateId()
        const previewUrl = URL.createObjectURL(file)

        setItems((prev) => [
          ...prev,
          {
            id,
            storagePath: '',
            publicUrl: '',
            previewUrl,
            caption: '',
            displayOrder: prev.length,
            status: 'uploading',
          },
        ])

        const ext = file.name.split('.').pop() ?? 'jpg'
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
            display_order: items.length,
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

        setItems((prev) =>
          prev.map((item) =>
            item.id === id
              ? {
                  ...item,
                  storagePath: row.storage_path,
                  publicUrl: row.public_url,
                  status: 'done',
                }
              : item,
          ),
        )
      }
    },
    [artistId, items.length, supabase],
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

  return (
    <div>
      <h2 className="text-lg font-semibold text-parchment-100 mb-4">
        Portfolio images
      </h2>
      <p className="text-sm text-ink-400 mb-6">
        Upload a few of your best pieces to showcase your style. You can skip
        this step and add images later. Minimum 3 images recommended.
      </p>

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
        className={[
          'mb-6 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors duration-150',
          isDraggingOver ? 'border-white bg-white/5' : 'border-ink-700 hover:border-ink-500',
        ].join(' ')}
      >
        <p className="text-sm text-parchment-100 font-medium">
          Drag and drop images here, or click to select
        </p>
        <p className="text-xs text-ink-500 mt-1">JPEG, PNG, or WebP — max 10MB each</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        {items.map((item) => (
          <div
            key={item.id}
            draggable={item.status === 'done'}
            onDragStart={() => setDragSrcId(item.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(item.id)}
            className="rounded-lg border border-ink-800 bg-ink-900 p-3 text-sm text-parchment-100"
          >
            <div className="relative mb-2 aspect-square overflow-hidden rounded bg-ink-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.previewUrl}
                alt={item.caption || 'Portfolio image'}
                className="h-full w-full object-cover"
              />
              {item.status === 'uploading' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                  <svg
                    className="h-6 w-6 animate-spin text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              )}
            </div>
            {item.status === 'error' && (
              <p className="mb-2 text-xs text-red-400">{item.error}</p>
            )}
            <input
              type="text"
              value={item.caption}
              onChange={(e) => handleCaptionChange(item.id, e.target.value)}
              placeholder="Caption (optional)"
              disabled={item.status !== 'done'}
              className="mb-2 w-full rounded border border-ink-700 bg-ink-800 px-2 py-1 text-xs text-parchment-100 placeholder:text-ink-500"
            />
            <button
              type="button"
              onClick={() => void handleRemove(item.id)}
              className="text-xs text-red-400 hover:text-red-300"
            >
              Remove
            </button>
          </div>
        ))}
        {items.length === 0 && (
          <div className="text-sm text-ink-500 col-span-2">
            No images yet — add some to continue, or skip this step and upload
            later.
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-ink-400 hover:text-ink-200"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleNextClick}
          disabled={isSaving || uploadingCount > 0}
          className="rounded-md bg-white text-black text-sm font-medium px-4 py-2 disabled:opacity-60"
        >
          {isSaving ? 'Saving…' : uploadingCount > 0 ? 'Uploading…' : 'Next'}
        </button>
      </div>
    </div>
  )
}
