'use client'

import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { step2Schema, type Step2Values, STYLE_TAG_OPTIONS } from '@/lib/validations/onboarding'

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

  return (
    <form onSubmit={handleSubmit(onNext)} noValidate className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">Your profile</h2>
        <p className="text-white/60 text-sm">
          This information appears on your public booking page.
        </p>
      </div>

      {/* Display name */}
      <div className="space-y-2">
        <label htmlFor="displayName" className="block text-sm font-medium text-white/80">
          Display name <span className="text-red-400" aria-hidden="true">*</span>
        </label>
        <input
          id="displayName"
          type="text"
          autoComplete="name"
          placeholder="e.g. Alex Martinez"
          className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/25 text-sm focus:outline-none focus:border-white/60 transition-colors duration-150"
          aria-describedby={errors.displayName ? 'displayName-error' : undefined}
          aria-required="true"
          {...register('displayName')}
        />
        {errors.displayName && (
          <p id="displayName-error" className="text-red-400 text-sm" role="alert">
            {errors.displayName.message}
          </p>
        )}
      </div>

      {/* Bio */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label htmlFor="bio" className="block text-sm font-medium text-white/80">
            Bio
          </label>
          <span
            className={[
              'text-xs tabular-nums',
              bio.length > BIO_MAX * 0.9 ? 'text-amber-400' : 'text-white/30',
            ].join(' ')}
            aria-label={`${bio.length} of ${BIO_MAX} characters used`}
          >
            {bio.length}/{BIO_MAX}
          </span>
        </div>
        <textarea
          id="bio"
          rows={4}
          maxLength={BIO_MAX}
          placeholder="Tell clients about your style, experience, and what makes your work unique…"
          className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/25 text-sm focus:outline-none focus:border-white/60 transition-colors duration-150 resize-none"
          aria-describedby={errors.bio ? 'bio-error' : undefined}
          {...register('bio')}
        />
        {errors.bio && (
          <p id="bio-error" className="text-red-400 text-sm" role="alert">
            {errors.bio.message}
          </p>
        )}
      </div>

      {/* Style tags */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-white/80">
          Tattoo styles <span className="text-red-400" aria-hidden="true">*</span>
        </p>
        <p className="text-white/40 text-xs">Select all that apply.</p>
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
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      const next = selected
                        ? field.value.filter((t) => t !== tag)
                        : [...field.value, tag]
                      field.onChange(next)
                    }}
                    aria-pressed={selected}
                    className={[
                      'px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 border',
                      selected
                        ? 'bg-white text-black border-white'
                        : 'bg-transparent text-white/60 border-white/20 hover:border-white/50 hover:text-white',
                    ].join(' ')}
                  >
                    {tag}
                  </button>
                )
              })}
            </div>
          )}
        />
        {errors.styleTags && (
          <p id="styleTags-error" className="text-red-400 text-sm" role="alert">
            {errors.styleTags.message}
          </p>
        )}
      </div>

      {/* Instagram handle */}
      <div className="space-y-2">
        <label htmlFor="instagramHandle" className="block text-sm font-medium text-white/80">
          Instagram handle
        </label>
        <div className="flex items-center rounded-lg overflow-hidden ring-1 ring-white/20 focus-within:ring-white/60 transition-all duration-150 bg-white/5">
          <span className="pl-4 pr-1 text-white/40 text-sm select-none">@</span>
          <input
            id="instagramHandle"
            type="text"
            autoComplete="off"
            autoCapitalize="none"
            placeholder="yourhandle"
            className="flex-1 bg-transparent py-3 pr-4 text-white placeholder-white/25 focus:outline-none text-sm"
            aria-describedby={errors.instagramHandle ? 'instagram-error' : undefined}
            {...register('instagramHandle')}
          />
        </div>
        {errors.instagramHandle && (
          <p id="instagram-error" className="text-red-400 text-sm" role="alert">
            {errors.instagramHandle.message}
          </p>
        )}
      </div>

      {/* Navigation */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          className="flex-1 py-3 rounded-lg text-sm font-semibold text-white/60 border border-white/20 hover:border-white/50 hover:text-white transition-all duration-150 disabled:opacity-40"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={!isValid || busy}
          className={[
            'flex-[2] py-3 rounded-lg font-semibold text-sm transition-all duration-150',
            isValid && !busy
              ? 'bg-white text-black hover:bg-white/90 active:scale-[0.98]'
              : 'bg-white/10 text-white/30 cursor-not-allowed',
          ].join(' ')}
        >
          {busy ? 'Saving…' : 'Continue'}
        </button>
      </div>
    </form>
  )
}
