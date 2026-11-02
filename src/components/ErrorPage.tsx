import { useEffect, useRef, useState } from 'react'

export type ErrorCode = 404 | 403 | 500

export type ErrorPageProps = {
  code?: ErrorCode
  requestedPath?: string
  errorDetails?: string
  onNavigateHome?: () => void
  onOpenAssistant?: () => void
  onRetry?: () => void
  theme?: 'light' | 'dark'
  onToggleTheme?: () => void
}

const ERROR_CONFIGS: Record<
  ErrorCode,
  {
    tag: string
    title: string
    description: string
    actionLabel: string
    suggestion: string
  }
> = {
  404: {
    tag: 'ROUTING_EXCEPTION // NOT_FOUND',
    title: 'Page Not Found',
    description:
      'The route you requested could not be resolved. It may have been moved, renamed, or never existed in this application.',
    actionLabel: 'Return to Portfolio',
    suggestion: 'Verify the URL address or return to the main engineering portfolio.',
  },
  403: {
    tag: 'SECURITY_GATE // ACCESS_DENIED',
    title: 'Access Restricted',
    description:
      'You do not have the required permissions or authentication token to view this route or administrative resource.',
    actionLabel: 'Return to Portfolio',
    suggestion: 'If you are an administrator, log in through the authorized portal.',
  },
  500: {
    tag: 'RUNTIME_EXCEPTION // SYSTEM_ERROR',
    title: 'Internal System Error',
    description:
      'An unexpected exception was encountered while evaluating the application state. The execution environment prevented a fatal crash.',
    actionLabel: 'Reload Application',
    suggestion: 'Try reloading the application or reset your session cache.',
  },
}

export function ErrorPage({
  code: initialCode = 404,
  requestedPath,
  errorDetails,
  onNavigateHome,
  onOpenAssistant,
  onRetry,
  theme = 'dark',
  onToggleTheme,
}: ErrorPageProps) {
  const [activeCode, setActiveCode] = useState<ErrorCode>(initialCode)
  const [showDiagnostics, setShowDiagnostics] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const currentPath =
    requestedPath || (typeof window !== 'undefined' ? window.location.pathname : '/unknown')
  const timestamp = new Date().toISOString()
  const traceId = `trc_${Math.random().toString(36).substring(2, 10)}_${Date.now().toString(36)}`

  const config = ERROR_CONFIGS[activeCode]

  // Canvas visual animation engine
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number
    canvas.width = canvas.offsetWidth * window.devicePixelRatio
    canvas.height = canvas.offsetHeight * window.devicePixelRatio
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

    const handleResize = () => {
      if (!canvas) return
      canvas.width = canvas.offsetWidth * window.devicePixelRatio
      canvas.height = canvas.offsetHeight * window.devicePixelRatio
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    }

    window.addEventListener('resize', handleResize)

    let angle = 0
    let pulse = 0
    const points: Array<{ x: number; y: number; r: number; speed: number; opacity: number }> = []

    for (let i = 0; i < 28; i++) {
      points.push({
        x: Math.random() * (canvas.offsetWidth || 300),
        y: Math.random() * (canvas.offsetHeight || 300),
        r: Math.random() * 2 + 1,
        speed: Math.random() * 0.4 + 0.2,
        opacity: Math.random() * 0.5 + 0.2,
      })
    }

    const isDark =
      document.documentElement.dataset.theme === 'dark' ||
      document.documentElement.classList.contains('dark')

    const primaryColor = isDark ? '244, 244, 245' : '24, 24, 27'
    const mutedColor = isDark ? '148, 163, 184' : '107, 114, 128'

    const render = () => {
      const displayW = canvas.offsetWidth
      const displayH = canvas.offsetHeight
      ctx.clearRect(0, 0, displayW, displayH)

      const centerX = displayW / 2
      const centerY = displayH / 2
      const maxRadius = Math.min(centerX, centerY) * 0.78

      // Background geometric grid lines
      ctx.strokeStyle = `rgba(${mutedColor}, 0.08)`
      ctx.lineWidth = 1
      const gridSize = 24
      for (let x = 0; x < displayW; x += gridSize) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, displayH)
        ctx.stroke()
      }
      for (let y = 0; y < displayH; y += gridSize) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(displayW, y)
        ctx.stroke()
      }

      if (activeCode === 404) {
        // --- 404: Radar & Coordinate Navigation Sweep ---
        // Concentric radar rings
        for (let i = 1; i <= 3; i++) {
          const r = (maxRadius / 3) * i
          ctx.beginPath()
          ctx.arc(centerX, centerY, r, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(${mutedColor}, ${0.12 * i})`
          ctx.lineWidth = 1
          ctx.setLineDash([4, 6])
          ctx.stroke()
          ctx.setLineDash([])
        }

        // Radar crosshairs
        ctx.strokeStyle = `rgba(${mutedColor}, 0.18)`
        ctx.beginPath()
        ctx.moveTo(centerX - maxRadius - 10, centerY)
        ctx.lineTo(centerX + maxRadius + 10, centerY)
        ctx.moveTo(centerX, centerY - maxRadius - 10)
        ctx.lineTo(centerX, centerY + maxRadius + 10)
        ctx.stroke()

        // Rotating radar beam
        angle += 0.024
        const beamX = centerX + Math.cos(angle) * maxRadius
        const beamY = centerY + Math.sin(angle) * maxRadius

        const gradient = ctx.createRadialGradient(
          centerX,
          centerY,
          0,
          centerX,
          centerY,
          maxRadius
        )
        gradient.addColorStop(0, `rgba(${primaryColor}, 0.15)`)
        gradient.addColorStop(1, `rgba(${primaryColor}, 0.0)`)

        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.moveTo(centerX, centerY)
        ctx.arc(centerX, centerY, maxRadius, angle - 0.45, angle)
        ctx.closePath()
        ctx.fill()

        // Sweep line
        ctx.strokeStyle = `rgba(${primaryColor}, 0.65)`
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(centerX, centerY)
        ctx.lineTo(beamX, beamY)
        ctx.stroke()

        // Missing node reticle
        pulse += 0.04
        const pulseR = 8 + Math.sin(pulse) * 3
        ctx.strokeStyle = `rgba(${primaryColor}, ${0.4 + Math.sin(pulse) * 0.3})`
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(centerX, centerY, pulseR, 0, Math.PI * 2)
        ctx.stroke()

        // Floating signal dust
        points.forEach((p) => {
          p.y -= p.speed
          if (p.y < 0) p.y = displayH
          ctx.fillStyle = `rgba(${mutedColor}, ${p.opacity})`
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
          ctx.fill()
        })
      } else if (activeCode === 403) {
        // --- 403: Security Perimeter & Geometric Lattice ---
        angle += 0.015
        pulse += 0.035

        // Hexagonal defense lattice
        const sides = 6
        for (let ring = 1; ring <= 3; ring++) {
          const r = (maxRadius / 3) * ring + Math.sin(pulse + ring) * 3
          ctx.beginPath()
          for (let s = 0; s <= sides; s++) {
            const hexAngle = (s * 2 * Math.PI) / sides + angle * (ring % 2 === 0 ? 1 : -1)
            const x = centerX + Math.cos(hexAngle) * r
            const y = centerY + Math.sin(hexAngle) * r
            if (s === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
          }
          ctx.strokeStyle = `rgba(${primaryColor}, ${0.15 + ring * 0.08})`
          ctx.lineWidth = ring === 2 ? 1.5 : 1
          ctx.stroke()
        }

        // Center security core node
        ctx.beginPath()
        ctx.arc(centerX, centerY, 14, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${primaryColor}, 0.12)`
        ctx.fill()
        ctx.strokeStyle = `rgba(${primaryColor}, 0.8)`
        ctx.lineWidth = 1.5
        ctx.stroke()

        // Inner lock symbol silhouette
        ctx.fillStyle = `rgba(${primaryColor}, 0.9)`
        ctx.fillRect(centerX - 4, centerY - 2, 8, 6)
        ctx.beginPath()
        ctx.arc(centerX, centerY - 2, 3, Math.PI, 0)
        ctx.strokeStyle = `rgba(${primaryColor}, 0.9)`
        ctx.lineWidth = 1.5
        ctx.stroke()
      } else {
        // --- 500: Waveform & Pulse Oscilloscope ---
        pulse += 0.03
        angle += 0.02

        // Baseline zero line
        ctx.strokeStyle = `rgba(${mutedColor}, 0.2)`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(centerX - maxRadius, centerY)
        ctx.lineTo(centerX + maxRadius, centerY)
        ctx.stroke()

        // Oscilloscope wave path
        ctx.beginPath()
        const waveWidth = maxRadius * 2
        const startX = centerX - maxRadius

        for (let i = 0; i <= waveWidth; i += 2) {
          const x = startX + i
          const normalX = (i / waveWidth) * Math.PI * 4
          // Sine wave with dynamic erratic pulse spike in center
          const distFromCenter = Math.abs(x - centerX) / (waveWidth / 2)
          const spikeMultiplier = Math.exp(-distFromCenter * 5)
          const spike = Math.sin(normalX * 3 + pulse * 4) * 28 * spikeMultiplier
          const baseWave = Math.sin(normalX + pulse) * 10
          const y = centerY + baseWave + spike

          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }

        ctx.strokeStyle = `rgba(${primaryColor}, 0.75)`
        ctx.lineWidth = 2
        ctx.stroke()

        // Pulse dot running across wave
        const dotProgress = (Math.sin(angle) + 1) / 2
        const dotX = startX + dotProgress * waveWidth
        const normalDotX = (dotProgress * waveWidth / waveWidth) * Math.PI * 4
        const dotDist = Math.abs(dotX - centerX) / (waveWidth / 2)
        const dotSpike = Math.sin(normalDotX * 3 + pulse * 4) * 28 * Math.exp(-dotDist * 5)
        const dotY = centerY + Math.sin(normalDotX + pulse) * 10 + dotSpike

        ctx.beginPath()
        ctx.arc(dotX, dotY, 4, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${primaryColor}, 1)`
        ctx.fill()
      }

      animationFrameId = requestAnimationFrame(render)
    }

    render()

    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animationFrameId)
    }
  }, [activeCode, theme])

  const handleHomeClick = () => {
    if (onNavigateHome) {
      onNavigateHome()
    } else if (typeof window !== 'undefined') {
      window.history.pushState(null, '', '/')
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
  }

  const handleActionClick = () => {
    if (activeCode === 500 && onRetry) {
      onRetry()
    } else {
      handleHomeClick()
    }
  }

  return (
    <div className="min-h-screen w-full bg-[var(--color-bg)] text-[var(--color-text)] flex flex-col justify-between font-sans selection:bg-[var(--color-text)] selection:text-[var(--color-bg)] transition-colors duration-200">
      {/* Top Header Bar */}
      <header className="border-b border-[var(--color-border)] px-5 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <button
            type="button"
            onClick={handleHomeClick}
            className="flex items-center gap-2 group cursor-pointer"
            aria-label="Return to portfolio home"
          >
            <div className="h-6 w-6 rounded border border-[var(--color-border)] bg-[var(--color-panel)] flex items-center justify-center font-mono text-xs font-semibold group-hover:border-[var(--color-border-hover)]">
              JM
            </div>
            <span className="font-mono text-xs font-medium tracking-tight text-[var(--color-text)]">
              Junaid Mir
            </span>
          </button>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[var(--color-border)] bg-[var(--color-panel)] font-mono text-[10px] text-[var(--color-muted)]">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              STATUS: {activeCode} EXCEPTION
            </span>

            {onToggleTheme && (
              <button
                type="button"
                onClick={onToggleTheme}
                aria-label="Toggle theme"
                className="px-2.5 py-1 rounded border border-[var(--color-border)] bg-[var(--color-panel)] font-mono text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-hover)] transition-colors cursor-pointer"
              >
                {theme === 'dark' ? '☀ Light' : '☾ Dark'}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Hero & Visual Stage */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 md:py-12">
        <div className="mx-auto w-full max-w-4xl grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          {/* Left / Top: Interactive Canvas Animation */}
          <div className="md:col-span-5 flex flex-col items-center justify-center">
            <div className="relative w-full max-w-[320px] aspect-square rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-2 shadow-sm overflow-hidden">
              <canvas
                ref={canvasRef}
                className="w-full h-full block rounded-lg cursor-crosshair"
                style={{ width: '100%', height: '100%' }}
              />

              {/* Monospace overlay HUD badge */}
              <div className="absolute top-3 left-3 px-2 py-0.5 rounded bg-[var(--color-bg)]/85 backdrop-blur-xs border border-[var(--color-border)] font-mono text-[10px] text-[var(--color-muted)]">
                CODE: {activeCode}
              </div>

              <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded bg-[var(--color-bg)]/85 backdrop-blur-xs border border-[var(--color-border)] font-mono text-[9px] text-[var(--color-muted)]">
                FPS: 60 // 2D CANVAS
              </div>
            </div>

            {/* Error Type Interactive Switcher */}
            <div className="mt-4 flex items-center gap-1.5 p-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] font-mono text-[11px]">
              <span className="text-[10px] text-[var(--color-muted)] px-2">Type:</span>
              {(['404', '403', '500'] as const).map((errCode) => {
                const numericCode = Number(errCode) as ErrorCode
                const isActive = activeCode === numericCode
                return (
                  <button
                    key={errCode}
                    type="button"
                    onClick={() => setActiveCode(numericCode)}
                    className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-[var(--color-text)] text-[var(--color-bg)] font-semibold'
                        : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                    }`}
                  >
                    {errCode}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Right: Error Details & Action Controls */}
          <div className="md:col-span-7 space-y-5 text-left">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 font-mono text-xs text-[var(--color-muted)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-text)]" />
                <span>{config.tag}</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-[var(--color-text)]">
                {config.title}
              </h1>
              <p className="text-sm leading-relaxed text-[var(--color-muted)]">
                {config.description}
              </p>
            </div>

            {/* Terminal Diagnostic Card */}
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-3.5 font-mono text-xs space-y-2 overflow-x-auto">
              <div className="flex items-center justify-between text-[11px] text-[var(--color-muted)] border-b border-[var(--color-border)] pb-2">
                <span>SYSTEM DIAGNOSTIC</span>
                <span className="truncate max-w-[140px]">{traceId}</span>
              </div>
              <div className="space-y-1 text-[11px]">
                <div className="flex gap-2">
                  <span className="text-[var(--color-muted)]">REQUEST_URI:</span>
                  <span className="text-[var(--color-text)] font-semibold break-all">
                    {currentPath}
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="text-[var(--color-muted)]">TIMESTAMP:</span>
                  <span className="text-[var(--color-text)]">{timestamp}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-[var(--color-muted)]">SUGGESTION:</span>
                  <span className="text-[var(--color-text)]">{config.suggestion}</span>
                </div>
              </div>

              {/* Optional Detailed Stack Trace toggle */}
              {errorDetails && (
                <div className="pt-2 border-t border-[var(--color-border)]">
                  <button
                    type="button"
                    onClick={() => setShowDiagnostics(!showDiagnostics)}
                    className="text-[10px] text-[var(--color-muted)] hover:text-[var(--color-text)] cursor-pointer underline"
                  >
                    {showDiagnostics ? 'Hide Stack Trace' : 'View Stack Trace'}
                  </button>
                  {showDiagnostics && (
                    <pre className="mt-2 max-h-36 overflow-auto text-[10px] text-[var(--color-muted)] leading-relaxed whitespace-pre-wrap">
                      {errorDetails}
                    </pre>
                  )}
                </div>
              )}
            </div>

            {/* Actions Toolbar */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleActionClick}
                className="btn-primary px-4 py-2.5 text-xs font-mono cursor-pointer"
              >
                {config.actionLabel}
              </button>

              {onOpenAssistant && (
                <button
                  type="button"
                  onClick={onOpenAssistant}
                  className="btn-secondary px-4 py-2.5 text-xs font-mono cursor-pointer"
                >
                  Ask Junaid AI
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') window.history.back()
                }}
                className="border border-[var(--color-border)] hover:border-[var(--color-border-hover)] px-3 py-2 text-xs font-mono text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer"
              >
                ← Back
              </button>
            </div>

            {/* Quick Directory Links */}
            <div className="pt-3 border-t border-[var(--color-border)]">
              <span className="text-[11px] font-mono text-[var(--color-muted)] block mb-2">
                Available sections:
              </span>
              <div className="flex flex-wrap gap-2 text-xs font-mono">
                <button
                  type="button"
                  onClick={() => {
                    handleHomeClick()
                    setTimeout(() => {
                      document.getElementById('projects')?.scrollIntoView({ behavior: 'smooth' })
                    }, 100)
                  }}
                  className="text-[var(--color-muted)] hover:text-[var(--color-text)] cursor-pointer"
                >
                  /projects
                </button>
                <span className="text-[var(--color-border)]">•</span>
                <button
                  type="button"
                  onClick={() => {
                    handleHomeClick()
                    setTimeout(() => {
                      document.getElementById('skills')?.scrollIntoView({ behavior: 'smooth' })
                    }, 100)
                  }}
                  className="text-[var(--color-muted)] hover:text-[var(--color-text)] cursor-pointer"
                >
                  /skills
                </button>
                <span className="text-[var(--color-border)]">•</span>
                <button
                  type="button"
                  onClick={() => {
                    handleHomeClick()
                    setTimeout(() => {
                      document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })
                    }, 100)
                  }}
                  className="text-[var(--color-muted)] hover:text-[var(--color-text)] cursor-pointer"
                >
                  /contact
                </button>
                <span className="text-[var(--color-border)]">•</span>
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      window.history.pushState(null, '', '/iam_admin')
                      window.dispatchEvent(new PopStateEvent('popstate'))
                    }
                  }}
                  className="text-[var(--color-muted)] hover:text-[var(--color-text)] cursor-pointer"
                >
                  /iam_admin
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer Bar */}
      <footer className="border-t border-[var(--color-border)] px-5 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between font-mono text-[11px] text-[var(--color-muted)]">
          <span>Engineered by Junaid Mir</span>
          <span>Bangalore, India (UTC+5:30)</span>
        </div>
      </footer>
    </div>
  )
}
