'use client'

import { useRef, useEffect, useState, useId } from 'react'

interface SignatureCanvasProps {
  onChange: (base64DataUrl: string | null) => void
  disabled?: boolean
}

export function SignatureCanvas({ onChange, disabled }: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [isEmpty, setIsEmpty] = useState(true)
  const [typedName, setTypedName] = useState('')
  const fallbackId = useId()

  // Mirror `isEmpty` in a ref so the ResizeObserver callback can read the
  // latest value without re-subscribing on every stroke.
  const isEmptyRef = useRef(true)
  isEmptyRef.current = isEmpty

  // Apply stroke styles. Must be re-called after every backing-store resize,
  // because changing canvas.width/height resets the 2d context state.
  const applyStrokeStyles = (ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }

  // Retrieve accurate event coordinates
  const getCoordinates = (e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()

    // Scale client coords to match canvas back buffer resolution
    const clientX = 'touches' in e ? (e.touches[0]?.clientX ?? 0) : e.clientX
    const clientY = 'touches' in e ? (e.touches[0]?.clientY ?? 0) : e.clientY

    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height,
    }
  }

  // Draw operations
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (disabled) return
    e.preventDefault()

    // If a typed signature was previously rendered, drawing supersedes it.
    if (typedName) {
      setTypedName('')
      const canvas = canvasRef.current
      const c = canvas?.getContext('2d')
      if (canvas && c) c.clearRect(0, 0, canvas.width, canvas.height)
    }

    const coords = getCoordinates(e.nativeEvent)
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx) return

    ctx.beginPath()
    ctx.moveTo(coords.x, coords.y)
    setIsDrawing(true)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled) return
    e.preventDefault()

    const coords = getCoordinates(e.nativeEvent)
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx) return

    ctx.lineTo(coords.x, coords.y)
    ctx.stroke()
    setIsEmpty(false)
  }

  const stopDrawing = () => {
    if (!isDrawing) return
    setIsDrawing(false)

    // Fire callback with data URL
    const canvas = canvasRef.current
    if (canvas && !isEmpty) {
      onChange(canvas.toDataURL('image/png'))
    }
  }

  // Keyboard-accessible fallback: render the typed name onto the canvas in a
  // script style and emit the same PNG data URL the drawing path produces, so
  // the submitted payload shape is unchanged for users who can't draw.
  const renderTypedSignature = (name: string) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !canvas) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const trimmed = name.trim()
    if (!trimmed) {
      setIsEmpty(true)
      onChange(null)
      return
    }

    const fontSize = Math.round(canvas.height * 0.4)
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `italic ${fontSize}px "Segoe Script", "Brush Script MT", cursive`
    ctx.fillText(trimmed, canvas.width / 2, canvas.height / 2)

    setIsEmpty(false)
    onChange(canvas.toDataURL('image/png'))
  }

  const handleTypedChange = (value: string) => {
    setTypedName(value)
    renderTypedSignature(value)
  }

  // Clear canvas board
  const clear = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !canvas) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setIsEmpty(true)
    setTypedName('')
    onChange(null)
  }

  // Initialize canvas + keep the backing store in sync with the rendered size.
  // Resizing the backing store normally wipes the canvas, so we snapshot any
  // in-progress signature and redraw it scaled to the new dimensions.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const syncCanvasSize = () => {
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const dpr = window.devicePixelRatio || 1
      const targetW = Math.round(canvas.offsetWidth * dpr)
      const targetH = Math.round(canvas.offsetHeight * dpr)
      if (targetW === 0 || targetH === 0) return
      if (canvas.width === targetW && canvas.height === targetH) return

      // Snapshot current content before the resize clears it.
      let snapshot: HTMLCanvasElement | null = null
      if (!isEmptyRef.current && canvas.width > 0 && canvas.height > 0) {
        snapshot = document.createElement('canvas')
        snapshot.width = canvas.width
        snapshot.height = canvas.height
        snapshot.getContext('2d')?.drawImage(canvas, 0, 0)
      }

      canvas.width = targetW
      canvas.height = targetH

      if (snapshot) {
        ctx.drawImage(
          snapshot,
          0, 0, snapshot.width, snapshot.height,
          0, 0, targetW, targetH,
        )
      }
      applyStrokeStyles(ctx)
    }

    syncCanvasSize()

    const observer = new ResizeObserver(() => syncCanvasSize())
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="space-y-2">
      <span id={`${fallbackId}-label`} className="sr-only">
        Signature drawing area — draw your signature, or use the text field below
        to type your full name as your signature.
      </span>

      <div className="relative h-32 w-full rounded-lg border border-white/20 bg-zinc-950/70 overflow-hidden shadow-inner">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="Signature drawing area"
          aria-describedby={`${fallbackId}-label`}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
        />

        {isEmpty && (
          <div
            aria-hidden
            className="absolute inset-0 flex items-center justify-center pointer-events-none text-xs text-white/20 uppercase tracking-widest font-semibold"
          >
            Sign here
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <label htmlFor={fallbackId} className="sr-only">
          Or type your full name to sign
        </label>
        <input
          id={fallbackId}
          type="text"
          value={typedName}
          onChange={(e) => handleTypedChange(e.target.value)}
          disabled={disabled}
          placeholder="Or type your full name to sign"
          autoComplete="name"
          className="flex-1 min-w-0 rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/40 disabled:opacity-30"
        />
        <button
          type="button"
          onClick={clear}
          disabled={disabled || isEmpty}
          className="text-xs text-white/40 hover:text-white/70 font-semibold px-2 py-1 transition-colors disabled:opacity-30 whitespace-nowrap"
        >
          Clear Signature
        </button>
      </div>
    </div>
  )
}
