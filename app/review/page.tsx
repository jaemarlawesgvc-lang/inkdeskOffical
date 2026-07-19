import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { ReviewForm } from '@/components/public/ReviewForm'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Leave a Review',
  robots: { index: false, follow: false },
}

interface ReviewPageProps {
  searchParams: Promise<{ token?: string }>
}

async function loadReviewContext(token: string) {
  const supabase = createSupabaseAdminClient()

  const { data: review } = await supabase
    .from('reviews')
    .select(
      `
      token_used,
      token_expires_at,
      artists ( display_name, username, google_review_url )
    `,
    )
    .eq('token', token)
    .maybeSingle()

  if (!review) return null

  const artist = review.artists as unknown as {
    display_name: string | null
    username: string
    google_review_url: string | null
  } | null

  return {
    used: review.token_used,
    expired: new Date(review.token_expires_at) < new Date(),
    artistName: artist?.display_name ?? artist?.username ?? 'your artist',
    googleReviewUrl: artist?.google_review_url ?? null,
  }
}

export default async function ReviewPage({ searchParams }: ReviewPageProps) {
  const { token } = await searchParams

  const context = token ? await loadReviewContext(token) : null

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6 py-16">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="font-serif text-3xl font-bold mb-2">Leave a review</h1>
        </div>

        {!token || !context ? (
          <p className="text-center text-white/40 text-sm">
            This review link is invalid. Please use the link from your email.
          </p>
        ) : context.used ? (
          <p className="text-center text-white/40 text-sm">
            This review has already been submitted. Thank you!
          </p>
        ) : context.expired ? (
          <p className="text-center text-white/40 text-sm">
            This review link has expired.
          </p>
        ) : (
          <ReviewForm token={token} artistName={context.artistName} googleReviewUrl={context.googleReviewUrl} />
        )}
      </div>
    </div>
  )
}
