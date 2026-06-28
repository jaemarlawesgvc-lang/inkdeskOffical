'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { step5Schema, type Step5Values } from '@/lib/validations/onboarding'
import {
  StepIntro,
  FieldLabel,
  FieldError,
  WizardNav,
  fieldClass,
} from '@/components/onboarding/ui'

interface Step5Props {
  defaultValue: string
  onNext: (data: { zoomLink: string | null }) => Promise<void>
  onBack: () => void
  isSaving: boolean
}

export function Step5Zoom({ defaultValue, onNext, onBack, isSaving }: Step5Props) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Step5Values>({
    resolver: zodResolver(step5Schema),
    defaultValues: {
      zoomLink: defaultValue,
    },
  })

  const onSubmit = async (values: Step5Values) => {
    await onNext({ zoomLink: values.zoomLink || null })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <StepIntro
        eyebrow="Integrations"
        title="Set up your Google Meet consultations"
        description="Meet clients online face-to-face to discuss design details, sizing, placement, and final pricing before upgrading them to a live booking slot."
      />

      {/* Why Google Meet */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
        <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-gold-400" aria-hidden="true">
            <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
          </svg>
          Why Google Meet?
        </h3>
        <ul className="space-y-2 text-sm text-white/60">
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 mt-0.5">✓</span>
            <span><strong className="text-white/80">No download required</strong> — clients join straight from their browser, no app needed</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 mt-0.5">✓</span>
            <span><strong className="text-white/80">Completely free</strong> — unlimited 1-to-1 video calls with a Google account</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 mt-0.5">✓</span>
            <span><strong className="text-white/80">Works on any device</strong> — phone, tablet, laptop</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 mt-0.5">✓</span>
            <span><strong className="text-white/80">Permanent link</strong> — one link you paste once, clients always use the same one</span>
          </li>
        </ul>
      </div>

      {/* How to get your link */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5 space-y-4">
        <h3 className="font-semibold text-white text-sm flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-gold-400" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
          </svg>
          How to get your Google Meet link
        </h3>

        <ol className="space-y-3 text-sm text-white/60 list-none">
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gold-500/10 border border-gold-500/30 text-gold-400 text-xs font-bold flex items-center justify-center">1</span>
            <span>Go to <a href="https://meet.google.com" target="_blank" rel="noopener noreferrer" className="text-gold-400 hover:text-gold-300 underline font-medium">meet.google.com</a> and sign in with your Google account (or create a free one)</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gold-500/10 border border-gold-500/30 text-gold-400 text-xs font-bold flex items-center justify-center">2</span>
            <span>Click <strong className="text-white/80">&quot;New meeting&quot;</strong> then select <strong className="text-white/80">&quot;Create a meeting for later&quot;</strong></span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gold-500/10 border border-gold-500/30 text-gold-400 text-xs font-bold flex items-center justify-center">3</span>
            <span>A link like <code className="text-xs bg-white/5 px-1.5 py-0.5 rounded text-blue-400">https://meet.google.com/abc-defg-hij</code> will appear — copy it</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gold-500/10 border border-gold-500/30 text-gold-400 text-xs font-bold flex items-center justify-center">4</span>
            <span>Paste it in the field below — clients will receive it automatically with every confirmed consultation booking</span>
          </li>
        </ol>

        {/* Visual mockup of the Google Meet UI */}
        <div className="rounded-lg border border-white/10 bg-zinc-950 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-zinc-900">
            <div className="flex gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
            </div>
            <div className="flex-1 bg-white/5 rounded px-2 py-0.5 text-[10px] text-white/50 font-mono">
              meet.google.com
            </div>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-[10px] font-bold text-white">G</div>
              <span className="text-[11px] font-semibold text-white/80">Google Meet</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="px-3 py-1.5 rounded-full bg-blue-600 text-[10px] font-semibold text-white cursor-default">New meeting</button>
              <button type="button" className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] text-white/60 cursor-default">Enter a code</button>
            </div>
            <div className="rounded-lg border-2 border-dashed border-gold-500/60 bg-gold-500/5 p-3 relative">
              <div className="absolute -top-2.5 right-2 bg-gold-500 text-black text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                ← Your link appears here
              </div>
              <p className="text-[10px] text-white/40 mb-1">Your meeting link</p>
              <p className="text-[11px] text-blue-400 font-mono">https://meet.google.com/abc-defg-hij</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <a
            href="https://meet.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded bg-gold-500/10 border border-gold-500/20 px-3.5 py-2 text-xs font-semibold text-gold-400 hover:bg-gold-500/20 transition-all"
          >
            Open Google Meet ↗
          </a>
        </div>
      </div>

      <div className="space-y-1.5">
        <FieldLabel htmlFor="zoomLink">Your Google Meet Link</FieldLabel>
        <input
          id="zoomLink"
          type="url"
          {...register('zoomLink')}
          className={fieldClass}
          placeholder="https://meet.google.com/abc-defg-hij"
          disabled={isSaving}
        />
        {errors.zoomLink && <FieldError>{errors.zoomLink.message}</FieldError>}
        <p className="text-xs text-ink-500 leading-normal">
          Leave empty if you prefer clients to contact you directly to arrange a call.
        </p>
      </div>

      <WizardNav onBack={onBack} submitLabel="Save & Continue" busy={isSaving} />
    </form>
  )
}
