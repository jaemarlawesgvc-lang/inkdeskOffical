import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms governing your use of the Inkquire platform.',
  alternates: { canonical: '/terms' },
  robots: { index: true, follow: false },
}

export default function TermsPage() {
  return (
    <div className="pt-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-24">
        <h1 className="font-display text-4xl font-bold text-parchment-100 mb-3">
          Terms of Service
        </h1>
        <p className="text-sm text-ink-500 mb-12">Last reviewed: June 2025</p>

        <div className="space-y-10 text-ink-400 leading-relaxed">

          <section>
            <h2 className="font-display text-2xl font-bold text-parchment-100 mb-4">
              1. Acceptance
            </h2>
            <p>
              By creating an account or using the Inkquire platform (the &quot;Service&quot;), you
              agree to be bound by these Terms of Service (&quot;Terms&quot;) and our Privacy
              Policy. If you do not agree, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-bold text-parchment-100 mb-4">
              2. The Service
            </h2>
            <p>
              Inkquire provides tattoo artists with tools to create portfolio websites,
              accept client bookings, and process deposit payments. We reserve the right
              to modify, suspend, or discontinue any part of the Service at any time,
              with reasonable notice where practical.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-bold text-parchment-100 mb-4">
              3. Accounts
            </h2>
            <ul className="list-disc list-inside space-y-2">
              <li>
                You must be at least 18 years old to create an Inkquire account.
              </li>
              <li>
                You are responsible for maintaining the confidentiality of your login
                credentials and for all activity that occurs under your account.
              </li>
              <li>
                You must provide accurate information when registering and keep it
                up to date.
              </li>
              <li>
                One person may hold one artist account. Creating multiple accounts to
                circumvent plan limits is prohibited.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl font-bold text-parchment-100 mb-4">
              4. Subscriptions and payments
            </h2>
            <p className="mb-3">
              The Free plan is available at no charge. Paid plans (Pro, Studio) are
              billed monthly in advance. By subscribing to a paid plan:
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li>
                You authorise Inkquire to charge your payment method on a recurring
                monthly basis.
              </li>
              <li>
                All fees are in pounds sterling (GBP) and are inclusive of VAT where
                applicable.
              </li>
              <li>
                You may cancel at any time; cancellations take effect at the end of the
                current billing period and no refunds are issued for partial periods.
              </li>
              <li>
                Inkquire reserves the right to change prices with 30 days&apos; written notice.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl font-bold text-parchment-100 mb-4">
              5. Acceptable use
            </h2>
            <p className="mb-3">You agree not to use the Service to:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>Violate any applicable law or regulation.</li>
              <li>
                Upload content that is unlawful, defamatory, obscene, or infringes
                third-party intellectual property rights.
              </li>
              <li>
                Use the platform for any purpose other than operating a legitimate
                tattoo artist business.
              </li>
              <li>
                Attempt to reverse-engineer, scrape, or otherwise access the Service
                other than through its intended interfaces.
              </li>
              <li>
                Transmit malicious code, spam, or unsolicited communications through
                the platform.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl font-bold text-parchment-100 mb-4">
              6. Your content
            </h2>
            <p>
              You retain ownership of all content you upload to Inkquire, including
              portfolio images, booking descriptions, and client communications. By
              uploading content, you grant Inkquire a non-exclusive, royalty-free licence
              to store, display, and process it solely for the purpose of providing the
              Service.
            </p>
            <p className="mt-3">
              You warrant that you own or have the right to use all content you upload
              and that it does not infringe third-party rights.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-bold text-parchment-100 mb-4">
              7. Intellectual property
            </h2>
            <p>
              The Inkquire platform, including its software, design, and documentation,
              is owned by Inkquire Ltd and protected by copyright and other intellectual
              property laws. Nothing in these Terms transfers any Inkquire intellectual
              property to you.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-bold text-parchment-100 mb-4">
              8. Limitation of liability
            </h2>
            <p>
              To the maximum extent permitted by law, Inkquire shall not be liable for
              any indirect, incidental, special, or consequential damages, including loss
              of revenue, loss of data, or business interruption, arising out of your use
              of or inability to use the Service.
            </p>
            <p className="mt-3">
              Inkquire&apos;s total liability to you for any claim arising from these Terms
              shall not exceed the total fees paid by you to Inkquire in the three months
              preceding the event giving rise to the claim.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-bold text-parchment-100 mb-4">
              9. Termination
            </h2>
            <p>
              Inkquire may suspend or terminate your account immediately if you breach
              these Terms. You may close your account at any time from your account
              settings. On termination, your right to use the Service ceases immediately.
              We will retain your data for 30 days following closure to allow data
              export, after which it will be deleted subject to legal retention
              requirements.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-bold text-parchment-100 mb-4">
              10. Governing law and disputes
            </h2>
            <p>
              These Terms are governed by the laws of England and Wales. Any dispute
              arising from these Terms shall be subject to the exclusive jurisdiction
              of the courts of England and Wales.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-bold text-parchment-100 mb-4">
              11. Contact
            </h2>
            <p>
              Questions about these Terms:{' '}
              <a href="mailto:legal@inkdesk.live" className="text-gold-500 hover:text-gold-400">
                legal@inkdesk.live
              </a>
            </p>
          </section>

        </div>
      </div>
    </div>
  )
}
