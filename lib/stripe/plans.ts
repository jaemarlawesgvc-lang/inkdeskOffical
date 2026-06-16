// ---------------------------------------------------------------------------
// Subscription plan definitions and enforcement
// ---------------------------------------------------------------------------

export type Plan = 'free' | 'pro' | 'studio'

export interface PlanLimits {
  portfolioImages: number
  aiGenerationsPerMonth: number
  bookingsPerMonth: number
  stripeDeposits: boolean
  emailAutomations: boolean
  customDomain: boolean
  clientNotes: 'basic' | 'full'
  analytics: boolean
  prioritySupport: boolean
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    portfolioImages: 10,
    aiGenerationsPerMonth: 1,
    bookingsPerMonth: 5,
    stripeDeposits: false,
    emailAutomations: false,
    customDomain: false,
    clientNotes: 'basic',
    analytics: false,
    prioritySupport: false,
  },
  pro: {
    portfolioImages: Infinity,
    aiGenerationsPerMonth: 5,
    bookingsPerMonth: Infinity,
    stripeDeposits: true,
    emailAutomations: true,
    customDomain: false,
    clientNotes: 'full',
    analytics: true,
    prioritySupport: false,
  },
  studio: {
    portfolioImages: Infinity,
    aiGenerationsPerMonth: Infinity,
    bookingsPerMonth: Infinity,
    stripeDeposits: true,
    emailAutomations: true,
    customDomain: true,
    clientNotes: 'full',
    analytics: true,
    prioritySupport: true,
  },
} as const

export const PLAN_DISPLAY: Record<Plan, { name: string; price: string; description: string }> = {
  free: {
    name: 'Free',
    price: '£0/mo',
    description: 'Get started with the basics',
  },
  pro: {
    name: 'Pro',
    price: '£19/mo',
    description: 'For working artists ready to grow',
  },
  studio: {
    name: 'Studio',
    price: '£49/mo',
    description: 'For studios and high-volume artists',
  },
}

// ---------------------------------------------------------------------------
// Feature gate types
// ---------------------------------------------------------------------------

export type GatedFeature =
  | 'portfolio_images'
  | 'ai_generation'
  | 'bookings'
  | 'stripe_deposits'
  | 'email_automations'
  | 'custom_domain'
  | 'full_client_notes'
  | 'analytics'

export interface PlanCheckResult {
  allowed: boolean
  reason: string | null
  currentPlan: Plan
  requiredPlan: Plan | null
  upgradeUrl: string | null
  currentUsage?: number
  limit?: number
}

// ---------------------------------------------------------------------------
// Enforcement helpers
// ---------------------------------------------------------------------------

const UPGRADE_URL = '/dashboard/settings/billing'

/**
 * Check if a boolean feature is available on the given plan.
 */
export function checkBooleanFeature(
  plan: Plan,
  feature: 'stripe_deposits' | 'email_automations' | 'custom_domain' | 'full_client_notes' | 'analytics',
): PlanCheckResult {
  const limits = PLAN_LIMITS[plan]
  const featureMap: Record<string, boolean> = {
    stripe_deposits: limits.stripeDeposits,
    email_automations: limits.emailAutomations,
    custom_domain: limits.customDomain,
    full_client_notes: limits.clientNotes === 'full',
    analytics: limits.analytics,
  }

  const allowed = featureMap[feature] ?? false

  if (allowed) {
    return { allowed: true, reason: null, currentPlan: plan, requiredPlan: null, upgradeUrl: null }
  }

  const requiredPlan = findMinimumPlan(feature)

  return {
    allowed: false,
    reason: `${formatFeatureName(feature)} requires a ${PLAN_DISPLAY[requiredPlan].name} plan or higher.`,
    currentPlan: plan,
    requiredPlan,
    upgradeUrl: UPGRADE_URL,
  }
}

/**
 * Check if a metered feature (portfolio images, AI generations, bookings) is within limits.
 */
export function checkMeteredFeature(
  plan: Plan,
  feature: 'portfolio_images' | 'ai_generation' | 'bookings',
  currentUsage: number,
): PlanCheckResult {
  const limits = PLAN_LIMITS[plan]
  const limitMap: Record<string, number> = {
    portfolio_images: limits.portfolioImages,
    ai_generation: limits.aiGenerationsPerMonth,
    bookings: limits.bookingsPerMonth,
  }

  const limit = limitMap[feature] ?? 0

  if (currentUsage < limit) {
    return {
      allowed: true,
      reason: null,
      currentPlan: plan,
      requiredPlan: null,
      upgradeUrl: null,
      currentUsage,
      limit: limit === Infinity ? undefined : limit,
    }
  }

  const requiredPlan = findMinimumPlanForHigherLimit(feature, limit)

  return {
    allowed: false,
    reason:
      limit === Infinity
        ? `${formatFeatureName(feature)} limit reached.`
        : `You've used ${currentUsage} of ${limit} ${formatFeatureName(feature)} on your ${PLAN_DISPLAY[plan].name} plan.`,
    currentPlan: plan,
    requiredPlan,
    upgradeUrl: UPGRADE_URL,
    currentUsage,
    limit: limit === Infinity ? undefined : limit,
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const PLAN_ORDER: Plan[] = ['free', 'pro', 'studio']

function findMinimumPlan(feature: string): Plan {
  for (const plan of PLAN_ORDER) {
    const limits = PLAN_LIMITS[plan]
    const featureMap: Record<string, boolean> = {
      stripe_deposits: limits.stripeDeposits,
      email_automations: limits.emailAutomations,
      custom_domain: limits.customDomain,
      full_client_notes: limits.clientNotes === 'full',
      analytics: limits.analytics,
    }
    if (featureMap[feature]) return plan
  }
  return 'studio'
}

function findMinimumPlanForHigherLimit(feature: string, currentLimit: number): Plan | null {
  for (const plan of PLAN_ORDER) {
    const limits = PLAN_LIMITS[plan]
    const limitMap: Record<string, number> = {
      portfolio_images: limits.portfolioImages,
      ai_generation: limits.aiGenerationsPerMonth,
      bookings: limits.bookingsPerMonth,
    }
    const planLimit = limitMap[feature] ?? 0
    if (planLimit > currentLimit) return plan
  }
  return null
}

function formatFeatureName(feature: string): string {
  const names: Record<string, string> = {
    portfolio_images: 'portfolio images',
    ai_generation: 'AI site generations',
    bookings: 'bookings this month',
    stripe_deposits: 'deposit collection',
    email_automations: 'email automations',
    custom_domain: 'custom domains',
    full_client_notes: 'full client notes',
    analytics: 'analytics',
  }
  return names[feature] ?? feature
}

// ---------------------------------------------------------------------------
// Convenience: resolve a user's current plan from their subscription status
// ---------------------------------------------------------------------------

export function resolveActivePlan(subscription: {
  plan: string
  status: string
} | null): Plan {
  if (!subscription) return 'free'

  const { plan, status } = subscription

  // Only active or trialing subscriptions grant paid features
  if (status !== 'active' && status !== 'trialing') return 'free'

  if (plan === 'pro' || plan === 'studio') return plan

  return 'free'
}
