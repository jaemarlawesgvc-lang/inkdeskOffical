import Link from 'next/link'

const PRODUCT_LINKS = [
  { label: 'Features', href: '/features' },
  { label: 'Pricing',  href: '/pricing'  },
  { label: 'About',    href: '/about'    },
  { label: 'Contact',  href: '/contact'  },
] as const

const LEGAL_LINKS = [
  { label: 'Privacy Policy',    href: '/privacy' },
  { label: 'Terms of Service',  href: '/terms'   },
  { label: 'Cookie Policy',     href: '/cookies' },
] as const

export function Footer() {
  return (
    <footer className="border-t border-ink-800 bg-ink-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          {/* ── Brand ── */}
          <div className="col-span-2">
            <Link
              href="/"
              className="font-display text-xl font-bold text-parchment-100"
            >
              Ink<span className="text-gold-500">Desk</span>
            </Link>
            <p className="mt-3 max-w-xs text-sm text-ink-400 leading-relaxed">
              Portfolio websites and online booking for independent tattoo
              artists. Powered by AI. Built in the UK.
            </p>
          </div>

          {/* ── Product ── */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-ink-500 mb-5">
              Product
            </h3>
            <ul className="space-y-3">
              {PRODUCT_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-ink-400 hover:text-parchment-100 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Legal ── */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-ink-500 mb-5">
              Legal
            </h3>
            <ul className="space-y-3">
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-ink-400 hover:text-parchment-100 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── Bottom bar ── */}
        <div className="mt-14 pt-8 border-t border-ink-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-ink-500">
            © {new Date().getFullYear()} InkDesk Ltd. All rights reserved.
          </p>
          <p className="text-xs text-ink-600">
            Registered in England and Wales.
          </p>
        </div>
      </div>
    </footer>
  )
}
