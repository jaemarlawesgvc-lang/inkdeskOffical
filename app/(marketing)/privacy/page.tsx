import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Inkquire collects, uses, and protects your personal data.',
  alternates: { canonical: '/privacy' },
  robots: { index: true, follow: false },
}

export default function PrivacyPage() {
  return (
    <div className="pt-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-24">
        <h1 className="font-display text-4xl font-bold text-parchment-100 mb-3">
          Privacy Policy
        </h1>
        <p className="text-sm text-ink-500 mb-12">Last reviewed: June 2025</p>

        <div className="prose prose-invert max-w-none space-y-10 text-ink-400 leading-relaxed">

          <section>
            <h2 className="font-display text-2xl font-bold text-parchment-100 mb-4">
              1. Who we are
            </h2>
            <p>
              Inkquire Ltd (&quot;Inkquire&quot;, &quot;we&quot;, &quot;us&quot;, &quot;our&quot;) is a company registered in
              England and Wales. We operate the Inkquire platform at inkdesk.live. We are
              the data controller for personal data collected through the platform.
            </p>
            <p className="mt-3">
              Contact:{' '}
              <a href="mailto:privacy@inkdesk.live" className="text-gold-500 hover:text-gold-400">
                privacy@inkdesk.live
              </a>
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-bold text-parchment-100 mb-4">
              2. Personal data we collect
            </h2>
            <p className="mb-3">We collect the following categories of personal data:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>
                <strong className="text-parchment-200">Account data</strong> — email
                address, name, and password (stored hashed) when you register.
              </li>
              <li>
                <strong className="text-parchment-200">Profile data</strong> — artist
                bio, portfolio images, availability, and pricing you add to your profile.
              </li>
              <li>
                <strong className="text-parchment-200">Booking data</strong> — client
                names, email addresses, phone numbers, booking descriptions, and reference
                images submitted through booking forms.
              </li>
              <li>
                <strong className="text-parchment-200">Payment data</strong> — payment
                method details are processed by Stripe and never stored on Inkquire
                servers. We receive confirmation of payment status only.
              </li>
              <li>
                <strong className="text-parchment-200">Usage data</strong> — IP
                addresses, browser type, pages visited, and timestamps collected for
                security and service improvement.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl font-bold text-parchment-100 mb-4">
              3. How and why we use your data
            </h2>
            <div className="space-y-4">
              <div>
                <p className="font-semibold text-parchment-200 mb-1">
                  Providing the service (lawful basis: contract)
                </p>
                <p>
                  We process your account, profile, and booking data to operate the
                  Inkquire platform, generate your portfolio site, process bookings, and
                  facilitate payments between you and your clients.
                </p>
              </div>
              <div>
                <p className="font-semibold text-parchment-200 mb-1">
                  Sending transactional emails (lawful basis: contract)
                </p>
                <p>
                  We send booking confirmations, appointment reminders, and aftercare
                  emails. These are operational and cannot be opted out of while your
                  account is active.
                </p>
              </div>
              <div>
                <p className="font-semibold text-parchment-200 mb-1">
                  Security and fraud prevention (lawful basis: legitimate interests)
                </p>
                <p>
                  We log access events and monitor for suspicious activity to protect
                  your account and the accounts of your clients.
                </p>
              </div>
              <div>
                <p className="font-semibold text-parchment-200 mb-1">
                  Legal compliance (lawful basis: legal obligation)
                </p>
                <p>
                  We retain certain records as required by UK law, including financial
                  records for HMRC purposes.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="font-display text-2xl font-bold text-parchment-100 mb-4">
              4. Who we share your data with
            </h2>
            <p className="mb-3">We share data only with the following categories of recipients:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>
                <strong className="text-parchment-200">Stripe</strong> — payment
                processing. Stripe is a data processor acting on our instructions under a
                Data Processing Agreement.
              </li>
              <li>
                <strong className="text-parchment-200">Supabase</strong> — database and
                file storage, hosted in the EU (Frankfurt).
              </li>
              <li>
                <strong className="text-parchment-200">Resend</strong> — transactional
                email delivery.
              </li>
              <li>
                <strong className="text-parchment-200">Sentry</strong> — error monitoring.
                Error reports may contain partial request data but are anonymised where
                possible.
              </li>
            </ul>
            <p className="mt-3">
              We do not sell personal data to third parties or share it for advertising
              purposes.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-bold text-parchment-100 mb-4">
              5. Data retention
            </h2>
            <p>
              We retain your account data for as long as your account is active, plus
              seven years after account closure for financial compliance purposes.
              Booking data is retained for the same period. You may request deletion
              under section 6.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-bold text-parchment-100 mb-4">
              6. Your rights under UK GDPR
            </h2>
            <p className="mb-3">You have the right to:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>
                <strong className="text-parchment-200">Access</strong> — request a copy
                of the personal data we hold about you.
              </li>
              <li>
                <strong className="text-parchment-200">Rectification</strong> — ask us
                to correct inaccurate or incomplete data.
              </li>
              <li>
                <strong className="text-parchment-200">Erasure</strong> — request
                deletion of your personal data, subject to legal retention obligations.
              </li>
              <li>
                <strong className="text-parchment-200">Portability</strong> — receive
                your data in a machine-readable format (CSV export is available from your
                dashboard).
              </li>
              <li>
                <strong className="text-parchment-200">Objection</strong> — object to
                processing based on legitimate interests.
              </li>
            </ul>
            <p className="mt-4">
              To exercise any of these rights, email{' '}
              <a href="mailto:privacy@inkdesk.live" className="text-gold-500 hover:text-gold-400">
                privacy@inkdesk.live
              </a>
              . We will respond within 30 days. If you are unsatisfied with our response,
              you have the right to lodge a complaint with the ICO at{' '}
              <a
                href="https://ico.org.uk"
                target="_blank"
                rel="noreferrer"
                className="text-gold-500 hover:text-gold-400"
              >
                ico.org.uk
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-bold text-parchment-100 mb-4">
              7. Cookies
            </h2>
            <p>
              We use cookies to maintain your login session and to monitor platform
              errors. We do not use advertising or third-party tracking cookies. See our{' '}
              <a href="/cookies" className="text-gold-500 hover:text-gold-400">
                Cookie Policy
              </a>{' '}
              for full details.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-bold text-parchment-100 mb-4">
              8. Changes to this policy
            </h2>
            <p>
              We may update this policy periodically. Material changes will be notified
              to registered users via email. The date at the top of this page reflects
              the most recent review.
            </p>
          </section>

        </div>
      </div>
    </div>
  )
}
