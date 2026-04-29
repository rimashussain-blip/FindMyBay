import { useQuery } from '@tanstack/react-query';
import { getReviews, type AdminReview } from '../api/admin';

export default function ReviewsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['reviews'],
    queryFn: getReviews,
  });

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Reviews</h1>
          <p className="mt-1 text-sm text-ink-soft">What customers are saying.</p>
        </div>
        {data && (
          <RatingSummary avg={data.summary.ratingAvg} count={data.summary.count} />
        )}
      </header>

      {isLoading && <div className="text-sm text-ink-soft">Loading…</div>}
      {error && <div className="text-sm text-coral">Couldn't load reviews</div>}

      {data && data.items.length === 0 && (
        <div className="rounded-2xl border border-mint-edge bg-white p-8 text-center text-sm text-ink-soft">
          No reviews yet. Once customers complete a wash, their feedback will appear here.
        </div>
      )}

      <div className="grid gap-3">
        {data?.items.map((r) => (
          <ReviewCard key={r.id} review={r} />
        ))}
      </div>
    </div>
  );
}

function RatingSummary({ avg, count }: { avg: number | null; count: number }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-mint-edge bg-white px-5 py-3">
      <div>
        <div className="text-3xl font-bold text-primary-deep">
          {avg != null ? avg.toFixed(1) : '—'}
        </div>
        <div className="text-[11px] uppercase tracking-wider text-ink-soft">average</div>
      </div>
      <div className="h-10 w-px bg-mint-edge" />
      <div>
        <div className="text-3xl font-bold text-ink">{count}</div>
        <div className="text-[11px] uppercase tracking-wider text-ink-soft">reviews</div>
      </div>
    </div>
  );
}

function ReviewCard({ review }: { review: AdminReview }) {
  const date = new Date(review.createdAt).toLocaleString('en-AE', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <article className="rounded-2xl border border-mint-edge bg-white p-5">
      <header className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Stars rating={review.rating} />
          <span className="text-sm font-semibold text-ink">{review.customerName}</span>
        </div>
        <span className="text-xs text-ink-soft">{date}</span>
      </header>
      {review.note && (
        <p className="mt-2 text-sm leading-relaxed text-ink">{review.note}</p>
      )}
      <footer className="mt-3 text-xs text-ink-soft">{review.serviceName}</footer>
    </article>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= rating ? 'text-sand-deep' : 'text-mint-edge'}>
          ★
        </span>
      ))}
    </div>
  );
}
