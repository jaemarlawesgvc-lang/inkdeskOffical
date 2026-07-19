# Inkdesk — Production Deployment Runbook

This is the last-mile checklist to take the app live. Everything in the codebase
passes typecheck, lint, unit tests, and a full production build — but the payment,
booking, studio, and onboarding flows have **not** been runtime-tested. Do a
staging pass (Stripe test mode + a staging Supabase project) before going live.

---

## 1. Environment variables (Vercel → Settings → Environment Variables)

All of these are **required** — the app boots without them (env validation logs
and continues) but AI, payments, email, and cron auth will silently break, which
is exactly what strands users. In `production`, the three secrets marked 🔒 now
hard-fail the build if missing (fail-closed), so set them first.

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` 🔒 | Service role key — server only |
| `STRIPE_SECRET_KEY` | `sk_live_…` (use `sk_test_…` on staging) |
| `STRIPE_WEBHOOK_SECRET` 🔒 | From the Stripe webhook endpoint (step 4) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_…` / `pk_test_…` |
| `STRIPE_PRICE_PRO_MONTHLY` | Stripe Price id for the Pro plan |
| `STRIPE_PRICE_STUDIO_MONTHLY` | Stripe Price id for the Studio plan |
| `GEMINI_API_KEY` | Google Gemini key — **without it, AI site generation fails** (onboarding now falls back to a starter site, but you want real AI) |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | Email delivery + verified sender |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Rate limiting |
| `NEXT_PUBLIC_APP_URL` | Canonical app URL (used in emails/links) |
| `NEXT_PUBLIC_APP_NAME` | Brand name |
| `CRON_SECRET` 🔒 | ≥32 chars (`openssl rand -hex 32`) — authenticates Vercel cron |

Optional: `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `GEMINI_MODEL`.

> Note: several files still brand as "Inkquire" while `sitemap.ts`/`robots.ts`
> hardcode `inkdesk.live`. Pick one canonical brand/domain before launch.

---

## 2. Database migrations — apply in order

Apply migrations **001 → 032** in numeric order. The new work is **021 → 032**:

| # | What it does |
|---|---|
| 021 | Booking-integrity: `pending` in the overlap exclusion constraint, hold uniqueness, index, access_token cleanup |
| 022 | Scheduling: multi-window availability, buffers, `services`, `booking_projects`, iCal token |
| 023 | Payments: balance/tips/gift-card columns + `tips`, `gift_cards` |
| 024 | Retention: cancellation window, `deposit_forfeited`, Google review URL, email types |
| 025 | Growth: portfolio `media_type`, custom-domain verification, analytics RLS |
| 026 | Deposit `deposit_refunded` flag |
| 027 | Gift-card → booking link columns |
| 028 | `studios`, `studio_members`, `artists.studio_id` |
| 029 | Studio Connect + `studio_commission_transfers` |
| 030 | Studio invite tokens |
| 031 | Commission reversal/retry columns |
| 032 | `gift_card_applications` reservation ledger |

**⚠️ NEVER pass a live database URL as `--shadow-database-url`** — that wipes it.
Apply to a **staging** Supabase project first, verify, then production.

After migrating, regenerate types if you use them: `npm run db:types`.

---

## 3. Stripe setup

1. **Platform account**: create the two subscription Prices; set `STRIPE_PRICE_*`.
2. **Connect**: enable Connect (Express/Standard). Artists onboard via
   `/api/stripe/connect-onboarding`; studios via `/api/studio/connect-onboarding`.
   Deposits/balances/tips/gift-cards are **destination charges to the artist** —
   the platform takes no commission except the optional **studio** commission,
   which is an application fee forwarded to the studio's connected account.
3. **Test mode first**: run the whole smoke test (step 5) in test mode with test
   cards before flipping to live keys.

---

## 4. Webhook + cron

**Stripe webhook** → add an endpoint at `https://<app>/api/webhooks/stripe`
subscribed to at least:
`customer.subscription.created`, `customer.subscription.updated`,
`customer.subscription.deleted`, `invoice.payment_succeeded`,
`invoice.payment_failed`, `payment_intent.succeeded`,
`payment_intent.payment_failed`, `account.updated`.
Copy its signing secret into `STRIPE_WEBHOOK_SECRET`.

**Cron** (already declared in `vercel.json`; needs `CRON_SECRET` set):
`send-reminders`, `send-aftercare`, `send-review-requests`, `expire-holds`,
`cleanup-orphans`, `auto-forfeit`, `healed-photo-request`,
`retry-commission-transfers`.

> `expire-holds` runs **once daily** — holds are short-lived, so consider a more
> frequent schedule if you rely on holds freeing quickly.

---

## 5. Smoke test (staging, Stripe test mode) — the flows that must work

**Onboarding & page**
- [ ] Sign up → complete onboarding → public page publishes at `/<username>`.
- [ ] Temporarily unset `GEMINI_API_KEY` and re-run the final step → onboarding
      still completes with a fallback starter site (should NOT 404).

**Booking & no-show**
- [ ] Book a consultation slot; confirm the slot is then unavailable (no double-book).
- [ ] Create a `service` with a long duration; book it → verify an overlapping
      slot is blocked (the duration is enforced server-side).
- [ ] Deposit flow: pay a deposit (test card) → booking confirms, email sends.
- [ ] Client cancels **early** → deposit refunded; cancels **late** → forfeited;
      artist cancels → always refunded. Artist notes survive a client cancel.
- [ ] Mark a past booking no-show → deposit forfeited (auto-forfeit cron too).

**Gift cards** (money-critical — test carefully)
- [ ] Purchase a gift card → card created with a code.
- [ ] Apply the code to a deposit partially → charge reduced, card balance
      decremented once. Apply fully → no charge, booking marked paid.
- [ ] Two concurrent applications of the same code → only one succeeds.
- [ ] Refund a gift-card-paid booking → card balance restored (once, not twice).

**Studio**
- [ ] Create a studio (Studio plan). Invite an artist by email → they get an
      email, accept via the link (must be signed in with that email, verified).
- [ ] "Link existing artist" now **invites** them (no silent annex).
- [ ] Owner connects studio Stripe → set a commission rate → a member's deposit
      routes commission to the studio; refunding it reverses the commission.
- [ ] Downgrade the owner off Studio → commission stops; owner mutations blocked.

**Access control**
- [ ] A second studio can't see the first's members/bookings/earnings.
- [ ] Cron endpoints reject requests without the correct `CRON_SECRET`.

---

## 6. Known residual items (safe to launch without, but track)

- **Booth rent** is reporting-only (the earnings ledger computes what's owed; no
  automated monthly booth-rent invoice/charge yet).
- **Commission transfer retries** rely on the 6-hourly cron; a transfer that
  succeeded at Stripe but never recorded its id could, in a &gt;24h-late retry,
  double-pay (Stripe idempotency-key TTL). Practically safe at 6h cadence.
- **Gift-card fully-covered refund**: a deposit fully covered by a gift card has
  no PaymentIntent, so there's no charge to reverse; the card isn't re-credited
  on cancel of such a booking. Rare; note for support.
- **Content-Security-Policy** ships as **Report-Only** — review reports, then
  switch to enforcing.
- **SMS** is intentionally not built (email-only notifications).
- **Brand/domain** inconsistency (Inkquire vs inkdesk.live) — unify before launch.

---

## 7. Deploy

1. Set all env vars (step 1) in the target Vercel environment.
2. Apply migrations (step 2) to that environment's Supabase.
3. Configure the Stripe webhook + copy the signing secret (step 4).
4. Deploy. Run the smoke test (step 5) in **test mode**.
5. Flip Stripe to live keys, re-verify a single real low-value payment, and go.
