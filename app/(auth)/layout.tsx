import type { Metadata } from 'next'
import Link from 'next/link'
import { AuthVisualPanel } from '@/components/auth/AuthVisualPanel'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen bg-gradient-ink">
      <AuthVisualPanel />

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-16">
        {/* Wordmark (mobile / no-panel only) */}
        <Link
          href="/"
          className="mb-10 font-display text-2xl font-bold text-parchment-100 hover:opacity-80 transition-opacity lg:hidden"
        >
          Ink<span className="text-gold-500">Desk</span>
        </Link>

        {/* Page content */}
        {children}
      </div>
    </div>
  )
}
