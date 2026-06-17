'use client'

import { useEffect, useRef, useState } from 'react'
import { clientEnv } from '@/lib/env.client'

interface StudioLocationPickerProps {
  address: string
  onAddressChange: (address: string) => void
  onCoordsChange: (lat: number | null, lng: number | null) => void
}

declare global {
  interface Window {
    google?: {
      maps: {
        places: {
          Autocomplete: new (
            input: HTMLInputElement,
            opts?: Record<string, unknown>,
          ) => {
            addListener: (event: string, handler: () => void) => void
            getPlace: () => {
              formatted_address?: string
              geometry?: { location?: { lat: () => number; lng: () => number } }
            }
          }
        }
      }
    }
  }
}

let scriptLoadPromise: Promise<void> | null = null

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (window.google?.maps?.places) return Promise.resolve()
  if (scriptLoadPromise) return scriptLoadPromise

  scriptLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google Maps script'))
    document.head.appendChild(script)
  })

  return scriptLoadPromise
}

const inputCls =
  'w-full bg-white/5 border border-white/20 rounded-lg px-4 py-2.5 text-white placeholder-white/25 text-sm focus:outline-none focus:border-white/50 transition-colors'

export function StudioLocationPicker({ address, onAddressChange, onCoordsChange }: StudioLocationPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const apiKey = clientEnv.googleMapsApiKey

  useEffect(() => {
    if (!apiKey) return
    loadGoogleMapsScript(apiKey)
      .then(() => setReady(true))
      .catch(() => setLoadError(true))
  }, [apiKey])

  useEffect(() => {
    if (!ready || !inputRef.current || !window.google?.maps?.places) return

    const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
      fields: ['formatted_address', 'geometry'],
      types: ['establishment', 'geocode'],
    })

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace()
      if (place.formatted_address) onAddressChange(place.formatted_address)
      const lat = place.geometry?.location?.lat() ?? null
      const lng = place.geometry?.location?.lng() ?? null
      onCoordsChange(lat, lng)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  if (!apiKey || loadError) {
    // No API key configured (or it failed to load) — plain text fallback.
    return (
      <input
        type="text"
        value={address}
        onChange={(e) => {
          onAddressChange(e.target.value)
          onCoordsChange(null, null)
        }}
        className={inputCls}
        placeholder="123 High Street, London"
      />
    )
  }

  return (
    <input
      ref={inputRef}
      type="text"
      defaultValue={address}
      onChange={(e) => onAddressChange(e.target.value)}
      className={inputCls}
      placeholder="Start typing your studio address…"
      aria-label="Studio address with location search"
    />
  )
}
