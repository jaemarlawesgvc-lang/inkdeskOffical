import { cn } from '@/lib/utils'
import { forwardRef, type InputHTMLAttributes } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Field-level error message rendered beneath the input. */
  error?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, id, ...props }, ref) => {
    const errorId = id ? `${id}-error` : undefined

    return (
      <div className="w-full">
        <input
          ref={ref}
          id={id}
          className={cn(
            // Base
            'w-full rounded-md border bg-ink-900 px-4 py-2.5',
            'text-sm text-parchment-100 placeholder:text-ink-600',
            'transition-colors duration-150',
            // Focus
            'focus:outline-none focus:ring-2 focus:ring-offset-0',
            // Disabled
            'disabled:cursor-not-allowed disabled:opacity-50',
            // Default border / focus ring
            !error && 'border-ink-700 focus:border-transparent focus:ring-gold-500',
            // Error border / focus ring
            error  && 'border-crimson-500 focus:border-transparent focus:ring-crimson-500',
            className,
          )}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          {...props}
        />
        {error && (
          <p id={errorId} className="mt-1.5 text-xs text-crimson-400" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  },
)

Input.displayName = 'Input'
