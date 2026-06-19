'use client'

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
        <div className="flex items-center justify-between">
          <FieldLabel htmlFor="bio">Bio</FieldLabel>
          <CharCount value={bio.length} max={BIO_MAX} />
        </div>
        <textarea
          id="bio"
          rows={4}
          maxLength={BIO_MAX}
          placeholder="Tell clients about your style, experience, and what makes your work unique…"
          className={textareaClass}
          aria-describedby={errors.bio ? 'bio-error' : undefined}
          {...register('bio')}
        />
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

      {/* Instagram handle */}
      <div className="space-y-2">
        <FieldLabel htmlFor="instagramHandle">Instagram handle</FieldLabel>
        <div className={prefixWrapClass}>
          <span className="select-none border-r border-ink-700 bg-ink-950/40 py-3 px-4 text-sm text-ink-400">
            @
          </span>
          <input
            id="instagramHandle"
            type="text"
            autoComplete="off"
            autoCapitalize="none"
            placeholder="yourhandle"
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
