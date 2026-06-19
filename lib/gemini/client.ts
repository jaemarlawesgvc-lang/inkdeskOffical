import { GoogleGenerativeAI } from '@google/generative-ai'
import { z } from 'zod'
import { env } from '@/lib/env'

// ---------------------------------------------------------------------------
// Site data schema — validated against every Gemini response
// ---------------------------------------------------------------------------

const serviceSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  priceFrom: z.string().min(1),
})

const faqSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
})

export const siteDataSchema = z.object({
  hero: z.object({
    headline: z.string().min(1),
    subheadline: z.string().min(1),
    ctaText: z.string().min(1),
  }),
  about: z.object({
    title: z.string().min(1),
    body: z.string().min(1),
  }),
  services: z.array(serviceSchema).min(1).max(10),
  faqs: z.array(faqSchema).min(1).max(10).optional(),
  seoTitle: z.string().min(1).max(70),
  seoDescription: z.string().min(1).max(160),
  colorScheme: z.object({
    primary: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex colour'),
    secondary: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex colour'),
    accent: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex colour'),
  }),
})

export type SiteData = z.infer<typeof siteDataSchema>

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

export interface GenerationInput {
  displayName: string
  bio: string
  styleTags: string[]
  portfolioImageCount: number
}

export function buildSitePrompt(input: GenerationInput): string {
  return `You are an expert web designer specialising in tattoo artist portfolio websites.

Generate a complete website specification for a tattoo artist with the following details:
- Name: ${input.displayName || 'Unknown Artist'}
- Bio: ${input.bio || 'Professional tattoo artist'}
- Styles: ${
    input.styleTags.length > 0
      ? input.styleTags.join(', ')
      : 'Various styles'
  }
- Portfolio images: ${input.portfolioImageCount} uploaded images

Return ONLY a valid JSON object with this exact structure:
{
  "hero": {
    "headline": string,
    "subheadline": string,
    "ctaText": string
  },
  "about": {
    "title": string,
    "body": string
  },
  "services": [
    { "name": string, "description": string, "priceFrom": string }
  ],
  "faqs": [
    { "question": string, "answer": string }
  ],
  "seoTitle": string,
  "seoDescription": string,
  "colorScheme": {
    "primary": string (hex),
    "secondary": string (hex),
    "accent": string (hex)
  }
}

The aesthetic must be premium tattoo studio — dark, sophisticated, bold typography, not generic.
Include 4-5 relevant FAQs for the artist based on their style, bio and typical client questions.
Do not include any markdown, backticks, or explanation. Return JSON only.`
}

// ---------------------------------------------------------------------------
// Gemini API error types
// ---------------------------------------------------------------------------

export class GeminiTimeoutError extends Error {
  constructor() {
    super('Gemini API timed out')
    this.name = 'GeminiTimeoutError'
  }
}

export class GeminiInvalidResponseError extends Error {
  constructor(detail: string) {
    super(`Gemini response invalid: ${detail}`)
    this.name = 'GeminiInvalidResponseError'
  }
}

// ---------------------------------------------------------------------------
// callGemini — calls the Gemini API, parses and validates the JSON response.
//
// Per spec:
//   - Gemini API timeout → throw GeminiTimeoutError (route maps to 504)
//   - Invalid JSON response → retry once, then throw GeminiInvalidResponseError
// ---------------------------------------------------------------------------

const TIMEOUT_MS = 30_000

let _client: GoogleGenerativeAI | undefined

function getClient(): GoogleGenerativeAI {
  if (!_client) {
    _client = new GoogleGenerativeAI(env.GEMINI_API_KEY)
  }
  return _client
}

function stripCodeFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()
}

async function callOnce(prompt: string): Promise<string> {
  const model = getClient().getGenerativeModel({ model: 'gemini-2.0-flash' })

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new GeminiTimeoutError()), TIMEOUT_MS)
  })

  const result = await Promise.race([model.generateContent(prompt), timeoutPromise])
  return result.response.text()
}

// Gemini doesn't reliably respect prompt-stated character limits. Clamp the
// length-constrained metadata fields rather than rejecting an otherwise
// valid, well-formed response over a cosmetic SEO field overflow.
function clampSeoFields(json: unknown): unknown {
  if (typeof json !== 'object' || json === null) return json
  const obj = { ...(json as Record<string, unknown>) }

  if (typeof obj.seoTitle === 'string') {
    obj.seoTitle = obj.seoTitle.slice(0, 70)
  }
  if (typeof obj.seoDescription === 'string') {
    obj.seoDescription = obj.seoDescription.slice(0, 160)
  }

  return obj
}

function parseAndValidate(rawText: string): SiteData {
  const cleaned = stripCodeFences(rawText)

  let json: unknown
  try {
    json = JSON.parse(cleaned)
  } catch (err) {
    throw new GeminiInvalidResponseError(
      `Failed to parse JSON: ${err instanceof Error ? err.message : 'unknown error'}`,
    )
  }

  const parsed = siteDataSchema.safeParse(clampSeoFields(json))
  if (!parsed.success) {
    throw new GeminiInvalidResponseError(parsed.error.message)
  }

  return parsed.data
}

export async function callGemini(prompt: string): Promise<SiteData> {
  try {
    const text = await callOnce(prompt)
    return parseAndValidate(text)
  } catch (err) {
    if (err instanceof GeminiTimeoutError) throw err

    // Invalid JSON / validation failure / transient API error (e.g. a 503
    // "model overloaded" response) → retry once before giving up.
    if (err instanceof GeminiInvalidResponseError || err instanceof Error) {
      const text = await callOnce(prompt)
      return parseAndValidate(text)
    }

    throw err
  }
}
