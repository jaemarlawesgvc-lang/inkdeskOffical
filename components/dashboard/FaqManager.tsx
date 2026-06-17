'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Faq {
  id: string
  question: string
  answer: string
  displayOrder: number
}

interface FaqManagerProps {
  initialFaqs: Faq[]
}

const inputCls =
  'w-full bg-white/5 border border-white/20 rounded-lg px-4 py-2.5 text-white placeholder-white/25 text-sm focus:outline-none focus:border-white/50 transition-colors'

export function FaqManager({ initialFaqs }: FaqManagerProps) {
  const router = useRouter()
  const [faqs, setFaqs] = useState<Faq[]>(initialFaqs)
  const [newQuestion, setNewQuestion] = useState('')
  const [newAnswer, setNewAnswer] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editQuestion, setEditQuestion] = useState('')
  const [editAnswer, setEditAnswer] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = () => router.refresh()

  const handleSeedDefaults = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/dashboard/faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seedDefaults: true }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Could not load default questions')
      refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load default questions')
    } finally {
      setBusy(false)
    }
  }

  const handleAdd = async () => {
    if (!newQuestion.trim() || !newAnswer.trim()) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/dashboard/faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: newQuestion.trim(), answer: newAnswer.trim() }),
      })
      const json = (await res.json()) as { faq?: { id: string; question: string; answer: string; display_order: number }; error?: string }
      const created = json.faq
      if (!res.ok || !created) throw new Error(json.error ?? 'Could not add question')
      setFaqs((prev) => [...prev, { id: created.id, question: created.question, answer: created.answer, displayOrder: created.display_order }])
      setNewQuestion('')
      setNewAnswer('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add question')
    } finally {
      setBusy(false)
    }
  }

  const startEdit = (faq: Faq) => {
    setEditingId(faq.id)
    setEditQuestion(faq.question)
    setEditAnswer(faq.answer)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditQuestion('')
    setEditAnswer('')
  }

  const handleSaveEdit = async () => {
    if (!editingId || !editQuestion.trim() || !editAnswer.trim()) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/dashboard/faq', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, question: editQuestion.trim(), answer: editAnswer.trim() }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Could not save changes')
      setFaqs((prev) =>
        prev.map((f) => (f.id === editingId ? { ...f, question: editQuestion.trim(), answer: editAnswer.trim() } : f)),
      )
      cancelEdit()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save changes')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (id: string) => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/dashboard/faq?id=${id}`, { method: 'DELETE' })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Could not delete question')
      setFaqs((prev) => prev.filter((f) => f.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete question')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-red-400 text-sm" role="alert">
          {error}
        </div>
      )}

      {faqs.length === 0 && (
        <button
          type="button"
          onClick={() => void handleSeedDefaults()}
          disabled={busy}
          className="text-sm font-medium text-white/70 hover:text-white underline underline-offset-2 disabled:opacity-40"
        >
          Load 6 common starter questions
        </button>
      )}

      {faqs.length > 0 && (
        <ul className="space-y-3" aria-label="FAQ entries">
          {faqs.map((faq) => (
            <li key={faq.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
              {editingId === faq.id ? (
                <div className="space-y-3">
                  <input value={editQuestion} onChange={(e) => setEditQuestion(e.target.value)} className={inputCls} maxLength={200} aria-label="Edit question" />
                  <textarea value={editAnswer} onChange={(e) => setEditAnswer(e.target.value)} rows={3} className={`${inputCls} resize-none`} maxLength={2000} aria-label="Edit answer" />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => void handleSaveEdit()} disabled={busy} className="px-3 py-1.5 rounded-lg bg-white text-black text-xs font-semibold hover:bg-white/90 disabled:opacity-40">Save</button>
                    <button type="button" onClick={cancelEdit} className="px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs font-semibold hover:bg-white/20">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-white font-medium text-sm">{faq.question}</p>
                    <p className="text-white/50 text-sm mt-1 leading-relaxed">{faq.answer}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button type="button" onClick={() => startEdit(faq)} aria-label={`Edit "${faq.question}"`} className="text-white/40 hover:text-white text-xs font-medium">Edit</button>
                    <button type="button" onClick={() => void handleDelete(faq.id)} disabled={busy} aria-label={`Delete "${faq.question}"`} className="text-red-400/70 hover:text-red-400 text-xs font-medium disabled:opacity-40">Delete</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-3 pt-2 border-t border-white/10">
        <p className="text-sm font-medium text-white/70">Add a question</p>
        <input value={newQuestion} onChange={(e) => setNewQuestion(e.target.value)} className={inputCls} placeholder="Question" maxLength={200} aria-label="New question" />
        <textarea value={newAnswer} onChange={(e) => setNewAnswer(e.target.value)} rows={3} className={`${inputCls} resize-none`} placeholder="Answer" maxLength={2000} aria-label="New answer" />
        <button
          type="button"
          onClick={() => void handleAdd()}
          disabled={busy || !newQuestion.trim() || !newAnswer.trim()}
          className="px-4 py-2 rounded-lg bg-white text-black text-sm font-semibold hover:bg-white/90 disabled:opacity-40 transition-colors"
        >
          Add question
        </button>
      </div>
    </div>
  )
}
