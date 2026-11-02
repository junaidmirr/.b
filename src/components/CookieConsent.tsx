import { useState, useEffect } from 'react'

const COOKIE_STORAGE_KEY = 'junaid_cookie_consent'

export function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Check if user has already accepted or closed cookie consent
    const consent = localStorage.getItem(COOKIE_STORAGE_KEY)
    if (!consent) {
      // Small timeout to avoid layout shift immediately on first paint
      const timer = setTimeout(() => {
        setIsVisible(true)
      }, 700)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleAccept = () => {
    localStorage.setItem(COOKIE_STORAGE_KEY, 'accepted')
    setIsVisible(false)
  }

  const handleDecline = () => {
    localStorage.setItem(COOKIE_STORAGE_KEY, 'declined')
    setIsVisible(false)
  }

  if (!isVisible) return null

  return (
    <div
      role="region"
      aria-label="Cookie preferences"
      className="fixed bottom-5 left-5 z-40 max-w-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)]/95 p-4 shadow-lg backdrop-blur-sm transition-all duration-300 font-sans text-xs"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-medium text-[var(--color-text)]">
            Cookie & Storage Notice
          </p>
          <p className="text-[11px] leading-relaxed text-[var(--color-muted)]">
            We use minimal cookies and local storage to save your theme preferences and optimize your browsing experience. No personal ad tracking.
          </p>
        </div>
        <button
          type="button"
          onClick={handleDecline}
          aria-label="Dismiss cookie notice"
          className="text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] cursor-pointer p-0.5"
        >
          ✕
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={handleAccept}
          className="btn-primary px-3 py-1.5 text-[11px] font-mono cursor-pointer"
        >
          Accept
        </button>
        <button
          type="button"
          onClick={handleDecline}
          className="btn-secondary px-3 py-1.5 text-[11px] font-mono cursor-pointer"
        >
          Decline
        </button>
      </div>
    </div>
  )
}
