import { useEffect, useRef, useState } from 'react'

type TurnstileCaptchaProps = {
  siteKey: string
  theme: 'light' | 'dark'
  open: boolean
  onVerify: (token: string) => void
  onExpire: () => void
}

const TURNSTILE_SCRIPT_ID = 'cf-turnstile-script'
const TURNSTILE_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
type TurnstileApi = NonNullable<Window['turnstile']>

function resolveTurnstile(resolve: (value: TurnstileApi) => void, reject: (reason?: unknown) => void) {
  if (window.turnstile) {
    resolve(window.turnstile)
    return
  }

  reject(new Error('Turnstile loaded, but the API is unavailable.'))
}

function loadTurnstileScript(): Promise<TurnstileApi> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Turnstile can only load in the browser.'))
  }

  if (window.turnstile) {
    return Promise.resolve(window.turnstile)
  }

  const existingScript = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null
  if (existingScript) {
    return new Promise<TurnstileApi>((resolve, reject) => {
      existingScript.addEventListener('load', () => resolveTurnstile(resolve, reject), { once: true })
      existingScript.addEventListener('error', () => reject(new Error('Failed to load Turnstile.')), {
        once: true,
      })
    })
  }

  return new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script')
    script.id = TURNSTILE_SCRIPT_ID
    script.src = TURNSTILE_SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolveTurnstile(resolve, reject)
    script.onerror = () => reject(new Error('Failed to load Turnstile.'))
    document.head.appendChild(script)
  })
}

export function TurnstileCaptcha({
  siteKey,
  theme,
  open,
  onVerify,
  onExpire,
}: TurnstileCaptchaProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<string | null>(null)
  const onVerifyRef = useRef(onVerify)
  const onExpireRef = useRef(onExpire)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    onVerifyRef.current = onVerify
    onExpireRef.current = onExpire
  }, [onExpire, onVerify])

  useEffect(() => {
    if (!open) {
      return
    }

    let cancelled = false

    const renderWidget = async () => {
      try {
        const turnstile = await loadTurnstileScript()
        if (cancelled || !turnstile || !containerRef.current || widgetIdRef.current) {
          return
        }

        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme,
          callback: (token) => {
            setLoadError(null)
            onVerifyRef.current(token)
          },
          'expired-callback': () => onExpireRef.current(),
          'error-callback': () => {
            onExpireRef.current()
            setLoadError('Captcha check failed. Please try again.')
          },
        })
      } catch {
        if (!cancelled) {
          setLoadError('Captcha could not load. Check your site key or network policy.')
        }
      }
    }

    renderWidget()

    return () => {
      cancelled = true
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current)
        widgetIdRef.current = null
      }
    }
  }, [open, siteKey, theme])

  useEffect(() => {
    if (!widgetIdRef.current || !window.turnstile) {
      return
    }

    window.turnstile.reset(widgetIdRef.current)
    onExpireRef.current()
  }, [theme])

  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] p-3">
      <div ref={containerRef} className="min-h-[66px]" />
      {loadError ? <p className="mt-2 text-xs text-red-500">{loadError}</p> : null}
    </div>
  )
}
