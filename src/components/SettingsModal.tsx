import { useEffect, useRef, useState } from 'react'
import type { Theme } from '../types'
import { ThemeSpinner } from './ThemeSpinner'

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
      setCookieStatus('Active')
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
      localStorage.removeItem('junaid_essay_interactions_cache')
      setCookieStatus('Reset')
      setStatusFeedback('Cleared')
      setTimeout(() => setStatusFeedback(''), 2000)
    } catch {}
  }

  if (!isOpen) return null

  return (
    <>
      {/* Subtle backdrop overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/15 backdrop-blur-[0.5px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Centered Settings Card */}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label="Portfolio Settings"
        className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-[300px] sm:w-[330px] rounded-[6px] border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-[var(--color-text)] font-sans"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2">
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

        {/* Minimal Options Body */}
        <div className="space-y-3 py-2.5">
          {/* Row 1: Theme Switcher */}
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-[var(--color-text)]">
              Theme
            </span>
            <ThemeSpinner theme={theme} onChangeTheme={onChangeTheme} />
          </div>

          <div className="border-t border-[var(--color-border)]" />

          {/* Row 2: Cookie & Storage Management */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-[var(--color-text)]">
                Cookie Storage
              </span>
              <span className="font-mono text-[10px] text-[var(--color-text-subtle)]">
                {statusFeedback || cookieStatus}
              </span>
            </div>
            <button
              type="button"
              onClick={handleResetCookies}
              aria-label="Reset cookie preferences"
              className="rounded-[4px] border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1 font-mono text-[11px] text-[var(--color-text)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-accent)] transition-colors cursor-pointer"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Footer Center: App Version 2.0 */}
        <div className="border-t border-[var(--color-border)] pt-2 text-center">
          <span className="font-mono text-[11px] tracking-tight text-[var(--color-text-subtle)]">
            App Version 2.0
          </span>
        </div>
      </div>
    </>
  )
}
