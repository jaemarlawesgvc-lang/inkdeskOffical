import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

export function Cta() {
  return (
    <section className="relative py-24 sm:py-32 overflow-hidden bg-ink-950 border-t border-ink-800">
      {/* Gold radial glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <div className="h-[500px] w-[800px] rounded-full bg-gold-500/5 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl font-black text-parchment-100 mb-6 leading-tight">
          Ready to fill your books?
        </h2>
        <p className="text-lg text-ink-400 mb-12 max-w-xl mx-auto leading-relaxed">
          Set up your portfolio and booking site in minutes. Free forever to
          start — no credit card required.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/signup"
            className={buttonVariants({ variant: 'primary', size: 'lg' })}
          >
            Start for free
          </Link>
          <Link
            href="/pricing"
            className={buttonVariants({ variant: 'ghost', size: 'lg' })}
          >
            View pricing →
          </Link>
        </div>
      </div>
    </section>
  )
}
