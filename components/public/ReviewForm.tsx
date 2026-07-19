'use client'

import { useRef, useState } from 'react'

interface ReviewFormProps {
  token: string
  artistName: string
  googleReviewUrl?: string | null
}

const MAX_FILE_SIZE = 10 * 1024 * 1024

export function ReviewForm({ token, artistName, googleReviewUrl }: ReviewFormProps) {
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [body, setBody] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (file: File | null) => {
    if (!file) {
      setPhotoFile(null)
      return
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > MAX_FILE_SIZE) {
      setError('Photo must be JPEG, PNG, or WEBP and under 10MB')
      return
    }
    setError(null)
    setPhotoFile(file)
  }

  const handleSubmit = async () => {
    if (rating === 0) {
      setError('Please select a star rating')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      let photoStoragePath: string | undefined

      if (photoFile) {
        const fd = new FormData()
        fd.append('file', photoFile)
        fd.append('token', token)
        const uploadRes = await fetch('/api/reviews/upload-photo', { method: 'POST', body: fd })
        const uploadJson = (await uploadRes.json()) as { storagePath?: string; error?: string }
        if (!uploadRes.ok || !uploadJson.storagePath) {
          throw new Error(uploadJson.error ?? 'Could not upload photo')
        }
        photoStoragePath = uploadJson.storagePath
      }

      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, rating, body: body.trim() || undefined, photoStoragePath }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Could not submit review')

      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit review')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="text-center space-y-3 py-8">
        <div className="w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="#22c55e" className="w-7 h-7" aria-hidden="true">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z" clipRule="evenodd" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white">Thank you!</h2>
        <p className="text-white/50 text-sm">Your review has been submitted.</p>
        {googleReviewUrl && (
          <a
            href={googleReviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-4 rounded-lg bg-white/10 hover:bg-white/15 px-5 py-2.5 text-sm font-medium text-white transition-colors"
          >
            Leave us a Google review
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
              <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
              <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
            </svg>
          </a>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-red-400 text-sm" role="alert">
          {error}
        </div>
      )}

      <div className="text-center space-y-2">
        <p className="text-white/60 text-sm">Rate your experience with {artistName}</p>
        <div className="flex items-center justify-center gap-1" role="radiogroup" aria-label="Star rating">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={rating === star}
              aria-label={`${star} star${star > 1 ? 's' : ''}`}
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className="p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-white rounded"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill={(hoverRating || rating) >= star ? '#fbbf24' : 'none'}
                stroke={(hoverRating || rating) >= star ? '#fbbf24' : '#525252'}
                strokeWidth="1.5"
                className="w-9 h-9"
              >
                <path d="M10 1l2.39 4.84 5.34.78-3.86 3.76.91 5.32L10 13.27l-4.78 2.43.91-5.32-3.86-3.76 5.34-.78L10 1z" />
              </svg>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="review-body" className="block text-sm font-medium text-white/70">
          Tell us more (optional)
        </label>
        <textarea
          id="review-body"
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
          className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/25 text-sm focus:outline-none focus:border-white/50 transition-colors resize-none"
          placeholder="What was your experience like?"
        />
      </div>

      <div className="space-y-1.5">
        <span className="block text-sm font-medium text-white/70">Photo (optional)</span>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full py-3 rounded-lg border border-dashed border-white/25 text-white/50 text-sm hover:border-white/50 hover:text-white transition-colors"
        >
          {photoFile ? photoFile.name : '+ Add a photo of the finished tattoo'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
          className="sr-only"
        />
      </div>

      <button
        type="button"
        onClick={() => void handleSubmit()}
        disabled={submitting}
        className="w-full py-3.5 rounded-lg font-bold text-sm bg-white text-black hover:bg-white/90 active:scale-[0.98] disabled:opacity-50 transition-all"
      >
        {submitting ? 'Submitting…' : 'Submit review'}
      </button>
    </div>
  )
}
