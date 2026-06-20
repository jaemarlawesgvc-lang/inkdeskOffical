import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { callGeminiText } from '@/lib/gemini/client'

export const runtime = 'nodejs'

const BIO_MAX = 500

// All fields are optional/lenient — the artist may click "Enhance with AI"
// before filling everything in. We generate from whatever we have.
const bodySchema = z.object({
  displayName: z.string().max(100).trim().optional().default(''),
  bio: z.string().max(BIO_MAX).trim().optional().default(''),
  styleTags: z.array(z.string().max(40)).max(20).optional().default([]),
  instagramHandle: z.string().max(40).trim().optional().default(''),
})

function buildPrompt(input: z.infer<typeof bodySchema>): string {
  const hasBio = input.bio.length > 0
  const styles = input.styleTags.length > 0 ? input.styleTags.join(', ') : 'various styles'

  return `You are a copywriter for independent tattoo artists. Write a short, first-person artist bio for a public booking page.

Artist details:
- Name: ${input.displayName || 'this artist'}
- Tattoo styles: ${styles}
${hasBio ? `- The artist's current draft bio (improve and polish this, keep their voice and any real facts): "${input.bio}"` : '- No draft yet — write one from scratch based on the styles above.'}

Rules:
- ${hasBio ? 'Refine and elevate the draft' : 'Write a fresh bio'} — warm, confident, professional, never cheesy or generic.
- First person ("I"), 2-4 sentences, roughly 280-${BIO_MAX} characters, under ${BIO_MAX} characters total.
- Speak to potential clients: what you create, your approach, why book you.
- Do NOT invent specific facts (years of experience, awards, studio names, locations) that weren't provided.
- Return ONLY the bio text. No quotes, no markdown, no preamble, no hashtags, no emoji.`
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Require an authenticated user so the Gemini key isn't open to the public.
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 422 })
  }

  try {
    const raw = await callGeminiText(buildPrompt(parsed.data))
    // Clean up anything the model might wrap around it, and clamp to the limit.
    const bio = raw
      .trim()
      .replace(/^["'“”]+|["'“”]+$/g, '')
      .replace(/\s+/g, ' ')
      .slice(0, BIO_MAX)
      .trim()

    if (!bio) {
      return NextResponse.json(
        { error: "The AI couldn't generate a bio right now. Please try again." },
        { status: 502 },
      )
    }

    return NextResponse.json({ bio })
  } catch (err) {
    console.error('[api/onboarding/generate-bio] error:', err instanceof Error ? err.message : err)
    return NextResponse.json(
      { error: "Couldn't generate a bio right now. Please try again in a moment." },
      { status: 502 },
    )
  }
}
