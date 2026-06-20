import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Cookie Policy',
  description: 'How Inkquire uses cookies and how to manage them.',
  alternates: { canonical: '/cookies' },
  robots: { index: true, follow: false },
}

const COOKIE_TABLE = [
  {
    name:     'sb-*-auth-token',
    provider: 'Supabase / Inkquire',
    purpose:  'Maintains your authenticated login session. Required for the platform to function.',
    duration: 'Session / 1 week',
    type:     'Essential',
  },
  {
    name:     '__stripe_mid, __stripe_sid',
    provider: 'Stripe',
    purpose:  'Fraud detection and payment security when processing deposits.',
    duration: '1 year / 30 minutes',
    type:     'Essential',
  },
  {
    name:     'sentry-sc',
    provider: 'Sentry',
    purpose:  'Session replay and error correlation for monitoring platform stability.',
    duration: 'Session',
    type:     'Functional',
  },
] as const

export default function CookiesPage() {
  return (
    <div className="pt-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-24">
        <h1 className="font-display text-4xl font-bold text-parchment-100 mb-3">
          Cookie Policy
        </h1>
        <p className="text-sm text-ink-500 mb-12">Last reviewed: June 2025</p>

        <div className="space-y-10 text-ink-400 leading-relaxed">

          <section>
            <h2 className="font-display text-2xl font-bold text-parchment-100 mb-4">
              What are cookies?
            </h2>
            <p>
              Cookies are small text files placed on your device by a website. They are
              widely used to make websites work, to remember your preferences, and to
              provide reporting information.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-bold text-parchment-100 mb-4">
              How Inkquire uses cookies
            </h2>
            <p className="mb-6">
              Inkquire uses a small number of cookies, all of which serve a clear
              purpose. We do not use advertising cookies, retargeting cookies, or
              third-party analytics cookies that track you across other websites.
            </p>

            {/* Cookie table */}
            <div className="overflow-x-auto rounded-xl border border-ink-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-700 bg-ink-900">
                    <th className="text-left py-3 px-4 text-parchment-200 font-semibold">
                      Cookie name
                    </th>
                    <th className="text-left py-3 px-4 text-parchment-200 font-semibold">
                      Provider
                    </th>
                    <th className="text-left py-3 px-4 text-parchment-200 font-semibold">
                      Purpose
                    </th>
                    <th className="text-left py-3 px-4 text-parchment-200 font-semibold whitespace-nowrap">
                      Duration
                    </th>
                    <th className="text-left py-3 px-4 text-parchment-200 font-semibold">
                      Type
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COOKIE_TABLE.map((row, i) => (
                    <tr
                      key={row.name}
                      className={
                        i < COOKIE_TABLE.length - 1
                          ? 'border-b border-ink-800'
                          : ''
                      }
                    >
                      <td className="py-3 px-4 font-mono text-xs text-gold-400 align-top whitespace-nowrap">
                        {row.name}
                      </td>
                      <td className="py-3 px-4 text-parchment-300 align-top whitespace-nowrap">
                        {row.provider}
                      </td>
                      <td className="py-3 px-4 text-ink-400 align-top">
                        {row.purpose}
                      </td>
                      <td className="py-3 px-4 text-ink-400 align-top whitespace-nowrap">
                        {row.duration}
                      </td>
                      <td className="py-3 px-4 align-top whitespace-nowrap">
                        <span
                          className={
                            row.type === 'Essential'
                              ? 'text-gold-400 font-medium'
                              : 'text-ink-400'
                          }
                        >
                          {row.type}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="font-display text-2xl font-bold text-parchment-100 mb-4">
              Cookie categories
            </h2>
            <div className="space-y-5">
              <div>
                <h3 className="font-semibold text-parchment-200 mb-1">
                  Essential cookies
                </h3>
                <p>
                  Required for the platform to function. Without them you cannot log in,
                  maintain a session, or process payments. These cannot be disabled while
                  using Inkquire.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-parchment-200 mb-1">
                  Functional cookies
                </h3>
                <p>
                  Support the reliability of the platform — for example, allowing our
                  error monitoring tool to link a bug report to a specific session so we
                  can diagnose and fix it. These do not track you across other sites.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="font-display text-2xl font-bold text-parchment-100 mb-4">
              How to manage cookies
            </h2>
            <p className="mb-4">
              Most browsers allow you to view, manage, and delete cookies through their
              settings. Below are links to cookie management instructions for common
              browsers:
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li>
                <a
                  href="https://support.google.com/chrome/answer/95647"
                  target="_blank"
                  rel="noreferrer"
                  className="text-gold-500 hover:text-gold-400 transition-colors"
                >
                  Google Chrome
                </a>
              </li>
              <li>
                <a
                  href="https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer"
                  target="_blank"
                  rel="noreferrer"
                  className="text-gold-500 hover:text-gold-400 transition-colors"
                >
                  Mozilla Firefox
                </a>
              </li>
              <li>
                <a
                  href="https://support.apple.com/en-gb/guide/safari/sfri11471"
                  target="_blank"
                  rel="noreferrer"
                  className="text-gold-500 hover:text-gold-400 transition-colors"
                >
                  Apple Safari
                </a>
              </li>
              <li>
                <a
                  href="https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09"
                  target="_blank"
                  rel="noreferrer"
                  className="text-gold-500 hover:text-gold-400 transition-colors"
                >
                  Microsoft Edge
                </a>
              </li>
            </ul>
            <p className="mt-5">
              Note that disabling essential cookies will prevent you from logging in to
              Inkquire or using its core features.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-bold text-parchment-100 mb-4">
              Changes to this policy
            </h2>
            <p>
              We may update this Cookie Policy if we add new third-party services or
              change how we use cookies. The date at the top of this page reflects the
              most recent review.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-bold text-parchment-100 mb-4">
              Contact
            </h2>
            <p>
              Questions about our use of cookies:{' '}
              <a
                href="mailto:privacy@inkdesk.live"
                className="text-gold-500 hover:text-gold-400 transition-colors"
              >
                privacy@inkdesk.live
              </a>
            </p>
          </section>

        </div>
      </div>
    </div>
  )
}
