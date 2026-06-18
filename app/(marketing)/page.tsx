import type { Metadata } from 'next'
import { IdealHero }      from '@/components/marketing/IdealHero'
import { IdealPortfolio } from '@/components/marketing/IdealPortfolio'
import { IdealAbout }     from '@/components/marketing/IdealAbout'
import { IdealBooking }   from '@/components/marketing/IdealBooking'

export const metadata: Metadata = {
  title: 'Ideal Tattoo Studio — Luxury Custom Tattooing & Fine-Line',
  description:
    'Bespoke tattoo art designed to trace the anatomy of your identity. Specializing in luxury Fine-line, Blackwork, and Neo-Traditional styles in London.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Ideal Tattoo Studio — Luxury Custom Tattooing & Fine-Line',
    description:
      'Bespoke tattoo art designed to trace the anatomy of your identity. Specializing in luxury Fine-line, Blackwork, and Neo-Traditional styles in London.',
    url: '/',
  },
}

export default function HomePage() {
  return (
    <>
      <IdealHero />
      <IdealPortfolio />
      <IdealAbout />
      <IdealBooking />
    </>
  )
}
