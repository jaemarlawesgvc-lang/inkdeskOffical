import type { Metadata } from 'next'
import { ContactForm } from './contact-form'

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Get in touch with the Inkquire team.',
  alternates: { canonical: '/contact' },
  openGraph: {
    title: 'Contact — Inkquire',
    description: 'Get in touch with the Inkquire team.',
    url: '/contact',
  },
  twitter: {
    title: 'Contact — Inkquire',
    description: 'Get in touch with the Inkquire team.',
  },
}

export default function ContactPage() {
  return (
    <div className="pt-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
          {/* ── Left: info ── */}
          <div>
            <h1 className="font-display text-4xl sm:text-5xl font-bold text-parchment-100 mb-5">
              Get in touch
            </h1>
            <p className="text-lg text-ink-400 leading-relaxed mb-10">
              Have a question about Inkquire, a feature request, or need help
              with your account? Send us a message and we&apos;ll get back to you
              within 48 hours.
            </p>

            <dl className="space-y-6">
              <div>
                <dt className="text-xs font-bold uppercase tracking-widest text-gold-500 mb-1">
                  Email
                </dt>
                <dd className="text-parchment-200">
                  <a
                    href="mailto:support@inkdesk.live"
                    className="hover:text-gold-400 transition-colors"
                  >
                    support@inkdesk.live
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-widest text-gold-500 mb-1">
                  Response time
                </dt>
                <dd className="text-parchment-200">Within 48 hours, Monday–Friday</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-widest text-gold-500 mb-1">
                  Based in
                </dt>
                <dd className="text-parchment-200">England, United Kingdom</dd>
              </div>
            </dl>
          </div>

          {/* ── Right: form ── */}
          <div className="rounded-xl border border-ink-700 bg-ink-900 p-6 sm:p-8">
            <ContactForm />
          </div>
        </div>
      </div>
    </div>
  )
}
