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

// Model fallback chain. Google rotates which models a given API key/region can
// access, so we try several known-good flash models in order. An explicit
// GEMINI_MODEL env var (if set) is tried first.
const DEFAULT_MODELS = [
  'gemini-2.0-flash',
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-1.5-flash',
]

const MODELS: string[] = env.GEMINI_MODEL
  ? [env.GEMINI_MODEL, ...DEFAULT_MODELS.filter((m) => m !== env.GEMINI_MODEL)]
  : DEFAULT_MODELS

// Auth/permission errors are fatal — trying other models won't help.
function isFatalKeyError(message: string): boolean {
  return /api[_ ]?key|permission|unauthor|invalid.*key|\b401\b|\b403\b/i.test(message)
}

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
  let lastError: unknown

  for (const modelName of MODELS) {
    try {
      const model = getClient().getGenerativeModel({ model: modelName })

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new GeminiTimeoutError()), TIMEOUT_MS)
      })

      const result = await Promise.race([model.generateContent(prompt), timeoutPromise])
      return result.response.text()
    } catch (err) {
      lastError = err
      if (err instanceof GeminiTimeoutError) throw err

      const message = err instanceof Error ? err.message : String(err)
      // A bad API key won't be fixed by trying another model — fail fast.
      if (isFatalKeyError(message)) throw err

      console.warn(`[gemini] model "${modelName}" failed (${message}) — trying next`)
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('All Gemini models failed')
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

// ---------------------------------------------------------------------------
// callGeminiText — free-form text generation for the in-app support assistant.
//
// Unlike callGemini (which expects/validates the site-data JSON), this returns
// the raw model text. It defaults to a more capable model chain so support
// answers are higher quality, falling back through flash models if the API
// key's region can't access the larger ones. Uses the same GEMINI_API_KEY.
// ---------------------------------------------------------------------------

const SUPPORT_MODELS = [
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-flash-latest',
  'gemini-1.5-flash',
]

export async function callGeminiText(
  prompt: string,
  opts?: { system?: string; models?: string[] },
): Promise<string> {
  const models = opts?.models ?? SUPPORT_MODELS
  // Prepend system context to the prompt rather than relying on the SDK's
  // systemInstruction param (availability varies by @google/generative-ai
  // version) — keeps this working regardless of the installed version.
  const fullPrompt = opts?.system ? `${opts.system}\n\n${prompt}` : prompt
  let lastError: unknown

  for (const modelName of models) {
    try {
      const model = getClient().getGenerativeModel({ model: modelName })

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new GeminiTimeoutError()), TIMEOUT_MS)
      })

      const result = await Promise.race([model.generateContent(fullPrompt), timeoutPromise])
      const text = result.response.text().trim()
      if (text) return text
    } catch (err) {
      lastError = err
      if (err instanceof GeminiTimeoutError) throw err
      const message = err instanceof Error ? err.message : String(err)
      if (isFatalKeyError(message)) throw err
      console.warn(`[gemini] text model "${modelName}" failed (${message}) — trying next`)
    }
  }

  throw lastError instanceof Error ? lastError : new Error('All Gemini models failed')
}
