import { useEffect, useRef, useState, type WheelEvent, type KeyboardEvent, type TouchEvent } from 'react'
import type { Theme } from '../types'

export interface ThemeOption {
  id: Theme
  name: string
  accent: string
  bg: string
  border: string
  description: string
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'light',
    name: 'Light',
    accent: '#D8431F',
    bg: '#FAF9F6',
    border: '#E5E3DD',
    description: 'Warm editorial paper & vermilion',
  },
  {
    id: 'vanilla',
    name: 'Vanilla',
    accent: '#B3591A',
    bg: '#F7F3EA',
    border: '#E6DFD1',
    description: 'Parchment ivory & terracotta',
  },
  {
    id: 'rose',
    name: 'Rose',
    accent: '#B4374E',
    bg: '#F9F4F4',
    border: '#E9DEE0',
    description: 'Editorial blush & crimson',
  },
  {
    id: 'butterscotch',
    name: 'Butterscotch',
    accent: '#AA6512',
    bg: '#F6F1E5',
    border: '#E5DBC7',
    description: 'Warm honey oat & amber',
  },
  {
    id: 'dark',
    name: 'Dark',
    accent: '#FF5C35',
    bg: '#0E0E0F',
    border: '#232326',
    description: 'Obsidian ink & vivid amber',
  },
]

interface ThemeSpinnerProps {
  theme: Theme
  onChangeTheme: (nextTheme: Theme) => void
  className?: string
}

export function ThemeSpinner({ theme, onChangeTheme, className = '' }: ThemeSpinnerProps) {
  const [spinDirection, setSpinDirection] = useState<'down' | 'up' | null>(null)
  const [rotationDegrees, setRotationDegrees] = useState(0)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const lastWheelTimeRef = useRef(0)
  const touchStartYRef = useRef<number | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const currentIndex = THEME_OPTIONS.findIndex((t) => t.id === theme)
  const safeIndex = currentIndex >= 0 ? currentIndex : 0
  const activeOption = THEME_OPTIONS[safeIndex]

  // Spin down: advance to next theme (0 -> 1 -> 2 -> 3 -> 4 -> 0)
  const spinDown = () => {
    const nextIndex = (safeIndex + 1) % THEME_OPTIONS.length
    setSpinDirection('down')
    setRotationDegrees((deg) => deg + 72)
    onChangeTheme(THEME_OPTIONS[nextIndex].id)
  }

  // Spin up: retreat to previous theme (0 -> 4 -> 3 -> 2 -> 1 -> 0)
  const spinUp = () => {
    const prevIndex = (safeIndex - 1 + THEME_OPTIONS.length) % THEME_OPTIONS.length
    setSpinDirection('up')
    setRotationDegrees((deg) => deg - 72)
    onChangeTheme(THEME_OPTIONS[prevIndex].id)
  }

  // Mouse wheel interaction over the spinner
  const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
    const now = Date.now()
    if (now - lastWheelTimeRef.current < 220) return
    if (Math.abs(e.deltaY) < 8) return

    e.preventDefault()
    lastWheelTimeRef.current = now

    if (e.deltaY > 0) {
      spinDown()
    } else {
      spinUp()
    }
  }

  // Touch swipe support on mobile devices
  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    touchStartYRef.current = e.touches[0].clientY
  }

  const handleTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    if (touchStartYRef.current === null) return
    const touchEndY = e.changedTouches[0].clientY
    const deltaY = touchEndY - touchStartYRef.current
    touchStartYRef.current = null

    if (Math.abs(deltaY) > 18) {
      if (deltaY < 0) {
        spinDown()
      } else {
        spinUp()
      }
    }
  }

  // Keyboard navigation
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault()
      spinDown()
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault()
      spinUp()
    } else if (e.key === 'Escape' && isMenuOpen) {
      setIsMenuOpen(false)
    }
  }

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="region"
      aria-label="Theme selector. Scroll wheel or use arrows to spin."
      className={`relative inline-flex items-center select-none rounded-[5px] border border-[var(--color-border)] bg-[var(--color-surface)]/85 px-1.5 py-0.5 text-xs font-mono shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:border-[var(--color-border-hover)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)] transition-colors ${className}`}
      title="Theme spinner: Click arrows, scroll wheel, or click name to switch theme"
    >
      {/* Rotary Dial Indicator & Color Token */}
      <button
        type="button"
        onClick={spinDown}
        aria-label="Rotate theme dial"
        className="relative flex h-5 w-5 shrink-0 items-center justify-center cursor-pointer p-0 hover:opacity-80 transition-opacity"
      >
        {/* Precision Bezel Ring with 4 cardinal tick marks */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          className="absolute inset-0 h-5 w-5 text-[var(--color-text-subtle)]/70 transition-transform duration-320 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{ transform: `rotate(${rotationDegrees}deg)` }}
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9.5" strokeDasharray="1 3" />
          <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2" strokeLinecap="round" />
        </svg>

        {/* Inner theme color pip */}
        <span
          className="relative block h-2 w-2 rounded-full ring-1 ring-black/10 dark:ring-white/20 transition-colors duration-200"
          style={{ backgroundColor: activeOption.accent }}
        />
      </button>

      {/* Tumbler Window (Static geometry, smooth animated text rolling) */}
      <div
        onClick={() => setIsMenuOpen((prev) => !prev)}
        role="button"
        tabIndex={-1}
        aria-haspopup="listbox"
        aria-expanded={isMenuOpen}
        className="relative mx-1.5 h-4.5 w-[76px] sm:w-[84px] shrink-0 overflow-hidden cursor-pointer flex items-center justify-start"
        title="Click to view all themes"
      >
        <span
          key={`${theme}-${spinDirection || 'idle'}`}
          className={`block truncate text-[11px] font-medium tracking-tight text-[var(--color-text)] ${
            spinDirection === 'down'
              ? 'animate-tumbler-down'
              : spinDirection === 'up'
              ? 'animate-tumbler-up'
              : ''
          }`}
        >
          {activeOption.name}
        </span>
      </div>

      {/* Up / Down Micro-Spinner Steppers */}
      <div className="flex flex-col items-center justify-center -space-y-0.5 border-l border-[var(--color-border)] pl-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            spinUp()
          }}
          aria-label="Spin up to previous theme"
          className="flex h-2.5 w-3.5 items-center justify-center text-[8px] leading-none text-[var(--color-text-subtle)] hover:text-[var(--color-accent)] cursor-pointer transition-colors"
          title="Previous theme (▲)"
        >
          ▲
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            spinDown()
          }}
          aria-label="Spin down to next theme"
          className="flex h-2.5 w-3.5 items-center justify-center text-[8px] leading-none text-[var(--color-text-subtle)] hover:text-[var(--color-accent)] cursor-pointer transition-colors"
          title="Next theme (▼)"
        >
          ▼
        </button>
      </div>

      {/* Dropdown Quick Menu */}
      {isMenuOpen && (
        <div
          role="listbox"
          aria-label="Select theme"
          className="absolute right-0 top-full mt-1.5 w-44 rounded-[5px] border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-lg z-50 animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-[var(--color-text-subtle)] border-b border-[var(--color-border)] mb-1">
            Themes
          </div>
          {THEME_OPTIONS.map((opt) => {
            const isSelected = opt.id === theme
            return (
              <button
                key={opt.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  if (opt.id !== theme) {
                    setSpinDirection('down')
                    setRotationDegrees((deg) => deg + 72)
                    onChangeTheme(opt.id)
                  }
                  setIsMenuOpen(false)
                }}
                className={`flex w-full items-center justify-between rounded-[3px] px-2 py-1.5 text-left text-xs transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[var(--color-row-hover)] font-semibold text-[var(--color-accent)]'
                    : 'text-[var(--color-text)] hover:bg-[var(--color-row-hover)]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full ring-1 ring-black/10"
                    style={{ backgroundColor: opt.accent }}
                  />
                  <span>{opt.name}</span>
                </div>
                {isSelected && <span className="text-[10px]">✓</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
