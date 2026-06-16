import type { Metadata } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import './globals.css'

// ─── Fonts ────────────────────────────────────────────────────────────────────
// CSS variables are consumed by tailwind.config.ts fontFamily entries.

const fontSans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const fontDisplay = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '700', '900'],
  display: 'swap',
})

// ─── Default Metadata ─────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: {
    default: 'InkDesk — Bookings & Portfolio for Tattoo Artists',
    template: '%s | InkDesk',
  },
  description:
    'AI-generated portfolio websites and online booking for independent tattoo artists. Start free, no credit card required.',
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://inkdesk.co',
  ),
  openGraph: {
    type: 'website',
    locale: 'en_GB',
    siteName: 'InkDesk',
  },
  twitter: {
    card: 'summary_large_image',
    creator: '@inkdesk',
  },
  robots: { index: true, follow: true },
}

import { CookieConsent } from '@/components/shared/CookieConsent'

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      // InkDesk is dark-mode-first; class="dark" is permanent.
      // Tailwind's darkMode: ['class'] reads this to activate dark variants.
      className={`dark ${fontSans.variable} ${fontDisplay.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans bg-background text-foreground antialiased min-h-screen">
        {children}
        <CookieConsent />
      </body>
    </html>
  )
}
