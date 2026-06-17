import { Reveal } from '@/components/public/Reveal'

interface PublicReview {
  id: string
  rating: number
  body: string | null
  photoUrl: string | null
  clientDisplayName: string
}

interface ReviewsSectionProps {
  reviews: PublicReview[]
  accentColor: string
}

function Stars({ rating, accentColor }: { rating: number; accentColor: string }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill={star <= rating ? accentColor : 'none'}
          stroke={star <= rating ? accentColor : '#525252'}
          strokeWidth="1.5"
          className="w-4 h-4"
          aria-hidden="true"
        >
          <path d="M10 1l2.39 4.84 5.34.78-3.86 3.76.91 5.32L10 13.27l-4.78 2.43.91-5.32-3.86-3.76 5.34-.78L10 1z" />
        </svg>
      ))}
    </div>
  )
}

export function ReviewsSection({ reviews, accentColor }: ReviewsSectionProps) {
  if (reviews.length === 0) return null

  return (
    <section id="reviews" className="px-6 py-20 sm:py-28 relative" aria-label="Client reviews">
      <div className="max-w-4xl mx-auto relative z-10">
        <Reveal className="text-center mb-12 space-y-3">
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: accentColor }}>
            Word of mouth
          </span>
          <h2 className="font-serif text-4xl sm:text-5xl font-bold tracking-tight" style={{ color: '#f5f5f0' }}>
            Reviews
          </h2>
          <div className="w-12 h-[2px] mx-auto mt-4 rounded-full" style={{ backgroundColor: accentColor }} />
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {reviews.map((review, i) => (
            <Reveal key={review.id} delay={(i % 2) * 100}>
              <div className="p-5 rounded-2xl bg-zinc-900/30 border border-white/5 h-full flex flex-col gap-3">
                <Stars rating={review.rating} accentColor={accentColor} />
                {review.body && (
                  <p className="text-white/70 text-sm leading-relaxed">{review.body}</p>
                )}
                {review.photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={review.photoUrl}
                    alt="Completed tattoo photo from a client review"
                    className="w-full h-48 object-cover rounded-lg border border-white/10"
                  />
                )}
                <p className="text-white/30 text-xs mt-auto">{review.clientDisplayName}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
