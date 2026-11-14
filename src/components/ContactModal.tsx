import { useEffect, useRef, useState, type FormEvent } from 'react'
import { TurnstileCaptcha } from './TurnstileCaptcha'

interface ContactModalProps {
  isOpen: boolean
  onClose: () => void
  theme: 'light' | 'dark'
  email?: string
}

export function ContactModal({ isOpen, onClose, theme, email }: ContactModalProps) {
  const modalRef = useRef<HTMLDivElement | null>(null)
  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || ''

  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaError, setCaptchaError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [messageSent, setMessageSent] = useState(false)

  // Handle outside click & Escape key
  useEffect(() => {
    if (!isOpen) return

    const handleOutsideClick = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
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

  // Reset transient messages on open
  useEffect(() => {
    if (isOpen) {
      setSubmitError('')
      setCaptchaError('')
      setMessageSent(false)
    }
  }, [isOpen])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    const name = String(formData.get('name') || '').trim()
    const fromEmail = String(formData.get('email') || '').trim()
    const message = String(formData.get('message') || '').trim()

    if (!name) {
      setSubmitError('Please enter your name.')
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail)) {
      setSubmitError('Please enter a valid email address.')
      return
    }

    if (!message) {
      setSubmitError('Please enter a message.')
      return
    }

    if (!captchaToken && turnstileSiteKey) {
      setCaptchaError('Please complete the verification check before sending.')
      return
    }

    setCaptchaError('')
    setSubmitError('')
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email: fromEmail,
          message,
          captchaToken,
        }),
      })

      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to send your message.')
      }

      setMessageSent(true)
      form.reset()
      setCaptchaToken('')
      setTimeout(() => {
        setMessageSent(false)
        onClose()
      }, 2500)
    } catch (err) {
      setCaptchaToken('')
      setSubmitError(err instanceof Error ? err.message : 'Failed to send your message.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-150"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-modal-title"
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[92vw] max-w-[480px] max-h-[90vh] overflow-y-auto rounded-[6px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-[var(--color-text)] font-sans"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
          <div className="flex items-center gap-2">
            <h2
              id="contact-modal-title"
              className="font-mono text-xs font-semibold uppercase tracking-wider text-[var(--color-text)]"
            >
              Send Message
            </h2>
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close contact form"
            className="text-xs font-mono text-[var(--color-text-subtle)] hover:text-[var(--color-text)] cursor-pointer p-1 transition-colors"
          >
            [✕]
          </button>
        </div>

        {/* Subtitle / Direct Email Note */}
        <div className="pt-3 pb-2">
          <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
            Have a question, collaboration inquiry, or project proposal? Send a note directly, or email{' '}
            <a
              href={`mailto:${email || 'contact@junaidmir.me'}`}
              className="text-[var(--color-accent)] underline hover:opacity-80"
            >
              {email || 'contact@junaidmir.me'}
            </a>
            .
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-3.5 pt-2 font-mono text-xs">
          <div className="space-y-1">
            <label
              htmlFor="modal-name"
              className="block uppercase tracking-wider text-[var(--color-text-subtle)] font-medium text-[11px]"
            >
              Name
            </label>
            <input
              id="modal-name"
              type="text"
              name="name"
              required
              placeholder="Your name"
              className="w-full rounded-[4px] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] font-sans placeholder:text-[var(--color-text-subtle)]/60 focus:border-[var(--color-accent)] focus:outline-none transition-colors"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="modal-email"
              className="block uppercase tracking-wider text-[var(--color-text-subtle)] font-medium text-[11px]"
            >
              Email
            </label>
            <input
              id="modal-email"
              type="email"
              name="email"
              required
              placeholder="name@example.com"
              className="w-full rounded-[4px] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] font-sans placeholder:text-[var(--color-text-subtle)]/60 focus:border-[var(--color-accent)] focus:outline-none transition-colors"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="modal-message"
              className="block uppercase tracking-wider text-[var(--color-text-subtle)] font-medium text-[11px]"
            >
              Message
            </label>
            <textarea
              id="modal-message"
              name="message"
              rows={4}
              required
              placeholder="Describe your inquiry, role, or proposal..."
              className="w-full resize-y rounded-[4px] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] font-sans placeholder:text-[var(--color-text-subtle)]/60 focus:border-[var(--color-accent)] focus:outline-none transition-colors"
            />
          </div>

          {turnstileSiteKey ? (
            <div className="pt-1">
              <TurnstileCaptcha
                open={isOpen}
                siteKey={turnstileSiteKey}
                theme={theme}
                onVerify={(token) => {
                  setCaptchaToken(token)
                  setCaptchaError('')
                }}
                onExpire={() => setCaptchaToken('')}
              />
            </div>
          ) : null}

          {captchaError && (
            <p className="text-xs text-[var(--color-accent)]">{captchaError}</p>
          )}
          {submitError && (
            <p className="text-xs text-[var(--color-accent)]">{submitError}</p>
          )}
          {messageSent && (
            <div className="border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-xs text-[var(--color-text)]">
              ✓ Message sent successfully. I will get back to you soon.
            </div>
          )}

          <div className="pt-2 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[4px] border border-[var(--color-border)] px-4 py-2 font-mono text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-hover)] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || messageSent || (Boolean(turnstileSiteKey) && !captchaToken)}
              className="rounded-[4px] border border-[var(--color-border)] bg-[var(--color-text)] text-[var(--color-surface)] px-5 py-2 font-mono text-xs tracking-wider uppercase hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer font-medium"
            >
              {isSubmitting ? 'Sending...' : messageSent ? 'Sent' : 'Send Message [→]'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
