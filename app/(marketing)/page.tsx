import type { Metadata } from 'next'
import { HomeHero }     from '@/components/marketing/home/HomeHero'
import { FeedShowcase } from '@/components/marketing/home/FeedShowcase'
import { HomeFeatures } from '@/components/marketing/home/HomeFeatures'
import { HomeProcess }  from '@/components/marketing/home/HomeProcess'
import { HomeCTA }      from '@/components/marketing/home/HomeCTA'

export const metadata: Metadata = {
  title: 'Inkquire — Your tattoo portfolio, booking site & deposits in one',
  description:
    'Inkquire turns your tattoo photos into a premium booking website in seconds. Online bookings, Stripe deposits and automated follow-ups — with no commission on your earnings. Start free.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Inkquire — Your tattoo portfolio, booking site & deposits in one',
    description:
      'Turn your tattoo feed into a website that books clients and collects deposits. AI-generated, premium, and commission-free. Start free with a 30-day Pro trial.',
    url: '/',
  },
}

export default function HomePage() {
  return (
    <>
      <HomeHero />
      <FeedShowcase />
      <HomeFeatures />
      <HomeProcess />
      <HomeCTA />
    </>
  )
}
