/**
 * Demo tattoo "feed" used across the Inkquire marketing homepage.
 *
 * Images are the four local portfolio assets shipped in /public. To extend the
 * showcase, drop more files into /public/assets/images/portfolio and add rows
 * here — every section below maps over SHOTS, so the grid scales automatically.
 */

export interface Shot {
  src: string
  /** Tattoo style label shown as the post tag. */
  style: string
  /** Demo artist handle (Instagram-style). */
  handle: string
  /** Demo engagement counts for the IG-style overlay. */
  likes: string
  comments: string
  /** Optional aspect hint for masonry variety. Defaults to square. */
  ratio?: 'square' | 'portrait' | 'landscape'
}

const BASE = '/assets/images/portfolio'

// ── Canonical pieces (defined as named consts so specific lookups stay typed) ──
const neoTraditional: Shot = { src: `${BASE}/neo-traditional.png`, style: 'Neo-Traditional', handle: '@inkby.rae', likes: '2,481', comments: '142', ratio: 'portrait' }
const blackwork:      Shot = { src: `${BASE}/blackwork.png`,       style: 'Blackwork',       handle: '@mono.matt',  likes: '3,902', comments: '208' }
const fineLine:       Shot = { src: `${BASE}/fineline.png`,        style: 'Fine-Line',       handle: '@lina.lines', likes: '1,733', comments: '96'  }
const metallic:       Shot = { src: `${BASE}/metallic.png`,        style: 'Biomechanical',   handle: '@kade.bio',   likes: '4,156', comments: '311', ratio: 'landscape' }

/** Full demo feed (repeats reuse the four assets with fresh captions). */
export const SHOTS: Shot[] = [
  neoTraditional,
  blackwork,
  fineLine,
  metallic,
  { src: `${BASE}/blackwork.png`,       style: 'Ornamental',   handle: '@sol.ornament', likes: '2,044', comments: '118' },
  { src: `${BASE}/fineline.png`,        style: 'Botanical',    handle: '@fern.studio',  likes: '5,210', comments: '402' },
  { src: `${BASE}/neo-traditional.png`, style: 'Illustrative', handle: '@rae.draws',    likes: '1,902', comments: '73'  },
  { src: `${BASE}/metallic.png`,        style: 'Abstract',     handle: '@kade.bio',     likes: '3,318', comments: '187' },
  { src: `${BASE}/blackwork.png`,       style: 'Geometric',    handle: '@mono.matt',    likes: '2,766', comments: '154' },
]

/** Fixed-length tuple → indices stay non-optional under noUncheckedIndexedAccess. */
export const HERO_SHOTS: readonly [Shot, Shot, Shot, Shot] = [neoTraditional, blackwork, metallic, fineLine]

/** Specific pieces referenced by individual sections. */
export const AVATAR_SHOT: Shot = neoTraditional
export const QUOTE_SHOT: Shot = metallic
