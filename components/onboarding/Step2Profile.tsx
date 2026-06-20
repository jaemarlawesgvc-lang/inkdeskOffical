'use client'

import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { step2Schema, type Step2Values, STYLE_TAG_OPTIONS } from '@/lib/validations/onboarding'
import {
  StepIntro,
  FieldLabel,
  FieldError,
  Hint,
  CharCount,
  TagPill,
  WizardNav,
  fieldClass,
  textareaClass,
  prefixWrapClass,
} from '@/components/onboarding/ui'

interface Step2Props {
  defaultValues: Partial<Step2Values>
  onNext: (data: Step2Values) => Promise<void>
  onBack: () => void
  isSaving: boolean
}

const BIO_MAX = 500

export function Step2Profile({ defaultValues, onNext, onBack, isSaving }: Step2Props) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    getValues,
    formState: { errors, isSubmitting, isValid },
  } = useForm<Step2Values>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      displayName: defaultValues.displayName ?? '',
      bio: defaultValues.bio ?? '',
      styleTags: defaultValues.styleTags ?? [],
      instagramHandle: defaultValues.instagramHandle ?? '',
    },
    mode: 'onTouched',
  })

  const bio = watch('bio') ?? ''
  const busy = isSubmitting || isSaving

  // ── AI bio: blank → generate from scratch, otherwise enhance the draft. ──
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  const handleEnhanceBio = async () => {
    if (aiBusy) return
    setAiError(null)
    setAiBusy(true)
    try {
      const res = await fetch('/api/onboarding/generate-bio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: getValues('displayName'),
          bio: getValues('bio'),
          styleTags: getValues('styleTags'),
          instagramHandle: getValues('instagramHandle'),
        }),
      })
      const json = (await res.json()) as { bio?: string; error?: string }
      if (!res.ok || !json.bio) {
        throw new Error(json.error ?? 'Could not generate a bio. Please try again.')
      }
      // Populate but keep it fully editable — just sets the field value.
      setValue('bio', json.bio, { shouldValidate: true, shouldDirty: true, shouldTouch: true })
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Could not generate a bio. Please try again.')
    } finally {
      setAiBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onNext)} noValidate className="space-y-8">
      <StepIntro
        eyebrow="Step 2 · Profile"
        title="Introduce your craft"
        description="This is what clients read first on your public page. Make it sound like you."
      />

      {/* Display name */}
      <div className="space-y-2">
        <FieldLabel htmlFor="displayName" required>
          Display name
        </FieldLabel>
        <input
          id="displayName"
          type="text"
          autoComplete="name"
          placeholder="e.g. Alex Martinez"
          className={fieldClass}
          aria-describedby={errors.displayName ? 'displayName-error' : undefined}
          aria-required="true"
          {...register('displayName')}
        />
        {errors.displayName && (
          <FieldError id="displayName-error">{errors.displayName.message}</FieldError>
        )}
      </div>

      {/* Bio */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <FieldLabel htmlFor="bio">Bio</FieldLabel>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleEnhanceBio}
              disabled={aiBusy || busy}
              data-tour="ai-bio"
              className="inline-flex items-center gap-1.5 rounded-full border border-gold-500/40 bg-gold-500/10 px-3 py-1 text-xs font-semibold text-gold-300 transition-colors duration-150 hover:border-gold-500/70 hover:bg-gold-500/15 hover:text-gold-200 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={bio.trim() ? 'Enhance bio with AI' : 'Generate bio with AI'}
            >
              {aiBusy ? (
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
                  <path d="M10 1.5l1.6 4.3 4.4 1.7-4.4 1.7L10 13.5l-1.6-4.3L4 7.5l4.4-1.7L10 1.5zM4.5 12.5l.8 2.1 2.2.8-2.2.8-.8 2.1-.8-2.1-2.2-.8 2.2-.8.8-2.1zM15.5 11l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6.6-1.6z" />
                </svg>
              )}
              {aiBusy ? 'Writing…' : bio.trim() ? 'Enhance with AI' : 'Generate with AI'}
            </button>
            <CharCount value={bio.length} max={BIO_MAX} />
          </div>
        </div>
        <textarea
          id="bio"
          rows={4}
          maxLength={BIO_MAX}
          placeholder="Tell clients about your style, experience, and what makes your work unique — or let AI draft it for you."
          className={textareaClass}
          aria-describedby={errors.bio ? 'bio-error' : undefined}
          {...register('bio')}
        />
        <Hint>AI fills this in for you — you can edit every word before continuing.</Hint>
        {aiError && <FieldError id="bio-ai-error">{aiError}</FieldError>}
        {errors.bio && <FieldError id="bio-error">{errors.bio.message}</FieldError>}
      </div>

      {/* Style tags */}
      <div className="space-y-3">
        <FieldLabel required>Tattoo styles</FieldLabel>
        <Hint>Select all that apply — these power search and your page styling.</Hint>
        <Controller
          name="styleTags"
          control={control}
          render={({ field }) => (
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="Tattoo style tags"
              aria-describedby={errors.styleTags ? 'styleTags-error' : undefined}
            >
              {STYLE_TAG_OPTIONS.map((tag) => {
                const selected = field.value.includes(tag)
                return (
                  <TagPill
                    key={tag}
                    selected={selected}
                    onClick={() => {
                      const next = selected
                        ? field.value.filter((t) => t !== tag)
                        : [...field.value, tag]
                      field.onChange(next)
                    }}
                  >
                    {tag}
                  </TagPill>
                )
              })}
            </div>
          )}
        />
        {errors.styleTags && (
          <FieldError id="styleTags-error">{errors.styleTags.message}</FieldError>
        )}
      </div>

      {/* Instagram profile */}
      <div className="space-y-2">
        <FieldLabel htmlFor="instagramHandle">Instagram Profile</FieldLabel>
        <div className={prefixWrapClass}>
          <span className="select-none border-r border-ink-700 bg-ink-950/40 py-3 px-4 text-sm text-ink-400">
            @
          </span>
          <input
            id="instagramHandle"
            type="text"
            autoComplete="off"
            autoCapitalize="none"
            placeholder="your.username"
            className="flex-1 bg-transparent py-3 px-3 text-sm text-parchment-100 placeholder:text-ink-600 focus:outline-none"
            aria-describedby={errors.instagramHandle ? 'instagram-error' : undefined}
            {...register('instagramHandle')}
          />
        </div>
        {errors.instagramHandle && (
          <FieldError id="instagram-error">{errors.instagramHandle.message}</FieldError>
        )}
      </div>

      <WizardNav onBack={onBack} submitLabel="Continue" busy={busy} disabled={!isValid} />
    </form>
  )
}
