import { cn } from '@/lib/utils'
import { forwardRef, type ButtonHTMLAttributes } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost'
type ButtonSize    = 'sm' | 'md' | 'lg'

interface VariantOptions {
  variant?:   ButtonVariant
  size?:      ButtonSize
  className?: string
}

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantOptions {}

// ─── Variants helper ─────────────────────────────────────────────────────────
//
// Exported so Link and anchor elements can share the same visual styles
// without rendering a <button>. Usage:
//
//   <Link href="/signup" className={buttonVariants({ variant: 'primary', size: 'lg' })}>
//     Get started
//   </Link>

export function buttonVariants({
  variant   = 'primary',
  size      = 'md',
  className,
}: VariantOptions = {}): string {
  return cn(
    // Base
    'inline-flex items-center justify-center rounded-md font-semibold',
    'transition-all duration-200 select-none',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    'focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'disabled:pointer-events-none disabled:opacity-50',

    // Variant
    variant === 'primary'   && 'bg-gold-500 text-ink-950 hover:bg-gold-400 active:bg-gold-600 shadow-gold',
    variant === 'secondary' && 'bg-ink-800 text-parchment-100 border border-ink-600 hover:bg-ink-700 hover:border-ink-500',
    variant === 'outline'   && 'border border-gold-500 text-gold-500 hover:bg-gold-500 hover:text-ink-950',
    variant === 'ghost'     && 'text-parchment-300 hover:text-parchment-100 hover:bg-ink-800',

    // Size
    size === 'sm' && 'px-3 py-1.5 text-sm',
    size === 'md' && 'px-5 py-2.5 text-sm',
    size === 'lg' && 'px-7 py-3.5 text-base',

    className,
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, ...props }, ref) => (
    <button
      ref={ref}
      className={buttonVariants({ variant, size, className })}
      {...props}
    />
  ),
)

Button.displayName = 'Button'
