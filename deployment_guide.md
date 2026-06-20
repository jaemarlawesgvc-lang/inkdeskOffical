# InkDesk Deployment Guide

This guide covers how to deploy the InkDesk platform to production.

## 1. Prerequisites

Before deploying, ensure you have the following:
- **Vercel Account:** For Next.js frontend/API deployment.
- **Supabase Project:** Database, Authentication, and Storage.
- **Stripe Account:** Payment processing.
- **Resend Account:** Transactional emails.
- **Upstash Redis Account:** Rate limiting.
- **Sentry Account (Optional):** Application monitoring.

## 2. Environment Variables

Set up the following environment variables in your Vercel project:

### Supabase
- \`NEXT_PUBLIC_SUPABASE_URL\`
- \`NEXT_PUBLIC_SUPABASE_ANON_KEY\`
- \`SUPABASE_SERVICE_ROLE_KEY\`

### Stripe
- \`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY\`
- \`STRIPE_SECRET_KEY\`
- \`STRIPE_WEBHOOK_SECRET\`
- \`STRIPE_PRICE_PRO_MONTHLY\`
- \`STRIPE_PRICE_STUDIO_MONTHLY\`

### Resend
- \`RESEND_API_KEY\`
- \`RESEND_FROM_EMAIL\`

### Upstash Redis
- \`UPSTASH_REDIS_REST_URL\`
- \`UPSTASH_REDIS_REST_TOKEN\`

### Application Config
- \`NEXT_PUBLIC_APP_URL\` (e.g., \`https://inkdesk.live\`)
- \`NEXT_PUBLIC_APP_NAME\` (e.g., \`InkDesk\`)
- \`CRON_SECRET\` (Generate with \`openssl rand -hex 32\`)
- \`GEMINI_API_KEY\`

### Sentry (Optional)
- \`SENTRY_DSN\`
- \`NEXT_PUBLIC_SENTRY_DSN\`
- \`SENTRY_ORG\`
- \`SENTRY_PROJECT\`

## 3. Database Migration

Ensure your Supabase project is set up with the correct schema and RLS policies.
Run the migrations:
\`\`\`bash
supabase db push
\`\`\`

## 4. Deploying to Vercel

1. Link your GitHub repository to Vercel.
2. Ensure the framework preset is set to **Next.js**.
3. Add all the environment variables listed above.
4. Click **Deploy**.

## 5. Post-Deployment Configuration

### Stripe Webhooks
1. In the Stripe Dashboard, go to **Developers > Webhooks**.
2. Add an endpoint pointing to \`https://your-domain.com/api/webhooks/stripe\`.
3. Select the events defined in the documentation (e.g., \`customer.subscription.created\`, \`payment_intent.succeeded\`).
4. Copy the Webhook Signing Secret and update the \`STRIPE_WEBHOOK_SECRET\` variable in Vercel.

### Vercel Cron Jobs
Vercel cron jobs are defined in \`vercel.json\`. Ensure the \`CRON_SECRET\` is correctly set so the cron endpoints can authenticate requests.
