import { useEffect, useRef, useState } from 'react'
import type { Theme } from '../types'
import { ThemeSpinner, THEME_OPTIONS } from './ThemeSpinner'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  theme: Theme
  onChangeTheme: (nextTheme: Theme) => void
}

export function SettingsModal({
  isOpen,
  onClose,
  theme,
  onChangeTheme,
}: SettingsModalProps) {
  const cardRef = useRef<HTMLDivElement | null>(null)
  const [cookieStatus, setCookieStatus] = useState<string>('Accepted')
  const [statusFeedback, setStatusFeedback] = useState<string>('')

  // Check current cookie / storage status
  useEffect(() => {
    if (typeof window === 'undefined') return
    const consent = localStorage.getItem('junaid_cookie_consent')
    if (consent === 'declined') {
      setCookieStatus('Declined')
    } else if (consent === 'accepted') {
      setCookieStatus('Accepted')
    } else {
      setCookieStatus('Default (Session)')
    }
  }, [isOpen])

  // Handle outside click to close
  useEffect(() => {
    if (!isOpen) return

    const handleOutsideClick = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  const handleResetCookies = () => {
    try {
      localStorage.removeItem('junaid_cookie_consent')
      setCookieStatus('Reset (Pending)')
      setStatusFeedback('Preferences reset to default')
      setTimeout(() => setStatusFeedback(''), 2500)
    } catch {}
  }

  const handleClearCache = () => {
    try {
      localStorage.removeItem('junaid_essay_interactions_cache')
      localStorage.removeItem('junaid_liked_essays')
      setStatusFeedback('Reading cache cleared')
      setTimeout(() => setStatusFeedback(''), 2500)
    } catch {}
  }

  if (!isOpen) return null

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-modal="true"
      aria-label="Portfolio Settings"
      className="absolute right-0 top-full mt-2 w-76 sm:w-84 rounded-[6px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150 text-[var(--color-text)] font-sans"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[var(--color-text)]">
            Preferences
          </span>
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close settings"
          className="text-xs font-mono text-[var(--color-text-subtle)] hover:text-[var(--color-text)] cursor-pointer p-0.5 transition-colors"
        >
          [✕]
        </button>
      </div>

      <div className="space-y-4 py-3">
        {/* Section 1: Theme Switch */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--color-text)]">
              Appearance & Theme
            </span>
            <span className="font-mono text-[10px] text-[var(--color-text-subtle)]">
              5 Palettes
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-[11px] text-[var(--color-text-muted)]">
              Rotary Spinner
            </span>
            <ThemeSpinner theme={theme} onChangeTheme={onChangeTheme} />
          </div>

          {/* Quick theme selector swatches */}
          <div className="flex items-center justify-between pt-1.5">
            {THEME_OPTIONS.map((opt) => {
              const isSelected = opt.id === theme
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChangeTheme(opt.id)}
                  title={`${opt.name} (${opt.description})`}
                  aria-label={`Select ${opt.name} theme`}
                  className={`flex flex-col items-center gap-1 rounded p-1 transition-all cursor-pointer ${
                    isSelected
                      ? 'ring-1 ring-[var(--color-accent)] bg-[var(--color-row-hover)]'
                      : 'hover:opacity-80'
                  }`}
                >
                  <span
                    className="h-4 w-4 rounded-full ring-1 ring-black/10 dark:ring-white/20"
                    style={{ backgroundColor: opt.accent }}
                  />
                  <span className="font-mono text-[9px] text-[var(--color-text-subtle)]">
                    {opt.name.slice(0, 4)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-[var(--color-border)]" />

        {/* Section 2: Cookie & Storage Management */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--color-text)]">
              Cookie & Storage
            </span>
            <span className="font-mono text-[10px] text-[var(--color-accent)]">
              {cookieStatus}
            </span>
          </div>
          <p className="text-[11px] leading-relaxed text-[var(--color-text-subtle)]">
            Stores your theme choice and reading history in local browser storage. No third-party ad tracking.
          </p>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleResetCookies}
              className="flex-1 rounded-[4px] border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1 font-mono text-[11px] text-[var(--color-text)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-accent)] transition-colors cursor-pointer"
            >
              Reset Consent
            </button>
            <button
              type="button"
              onClick={handleClearCache}
              className="flex-1 rounded-[4px] border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1 font-mono text-[11px] text-[var(--color-text)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-accent)] transition-colors cursor-pointer"
            >
              Clear Cache
            </button>
          </div>

          {statusFeedback && (
            <p className="text-[10px] font-mono text-[var(--color-accent)] animate-pulse">
              ✓ {statusFeedback}
            </p>
          )}
        </div>
      </div>

      {/* Footer Center: App Version 2.0 */}
      <div className="border-t border-[var(--color-border)] pt-2.5 text-center">
        <span className="font-mono text-[11px] font-medium tracking-tight text-[var(--color-text-subtle)]">
          App Version 2.0
        </span>
      </div>
    </div>
  )
}
