import type { Metadata } from 'next'
import { Hero }            from '@/components/marketing/hero'
import { ProductShowcase } from '@/components/marketing/product-showcase'
import { HowItWorks }     from '@/components/marketing/how-it-works'
import { Features }       from '@/components/marketing/features'
import { Testimonials }   from '@/components/marketing/testimonials'
import { PricingPreview } from '@/components/marketing/pricing-preview'
import { Cta }            from '@/components/marketing/cta'

export const metadata: Metadata = {
  title: 'InkDesk — Bookings & Portfolio for Tattoo Artists',
  description:
    'AI-generated portfolio websites and online booking for independent tattoo artists. Start free, no credit card required.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'InkDesk — Bookings & Portfolio for Tattoo Artists',
    description:
      'AI-generated portfolio websites and online booking for independent tattoo artists. Start free, no credit card required.',
    url: '/',
  },
}

export default function HomePage() {
  return (
    <>
      <Hero />
      <ProductShowcase />
      <HowItWorks />
      <Features />
      <Testimonials />
      <PricingPreview />
      <Cta />
    </>
  )
}
