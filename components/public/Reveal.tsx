'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

interface RevealProps {
  children: ReactNode
  /** Delay before the reveal transition starts, in ms. Enables stagger. */
  delay?: number
  /** Extra classes applied to the wrapper. */
  className?: string
  /** Render as a different element (default: div). */
  as?: 'div' | 'section' | 'li' | 'span'
}

/**
 * Fades + slides its children into view the first time they enter the
 * viewport. Uses IntersectionObserver; the .reveal / .is-visible classes
 * (defined in globals.css) carry the actual transition and honour
 * prefers-reduced-motion.
 */
export function Reveal({
  children,
  delay = 0,
  className = '',
  as = 'div',
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    // If already in view on mount (e.g. above the fold), reveal immediately.
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true)
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const Tag = as as 'div'

  return (
    <Tag
      ref={ref as React.RefObject<HTMLDivElement>}
      className={`reveal ${visible ? 'is-visible' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  )
}
