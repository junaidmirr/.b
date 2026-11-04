import { useState, useEffect, useId, lazy, Suspense, type FormEvent } from 'react'
import { TurnstileCaptcha } from './components/TurnstileCaptcha'
import { getPortfolioData } from './portfolioDataManager'
import { subscribeToPortfolio } from './services/portfolioService'
import { AiAssistant } from './components/AiAssistant'
import { CookieConsent } from './components/CookieConsent'
import { ErrorPage } from './components/ErrorPage'
import { EssaysSection } from './components/EssaysSection'
import type { Theme, Project, SkillCategory, PortfolioData } from './types'

const AdminPage = lazy(() =>
  import('./components/AdminPage').then((m) => ({ default: m.AdminPage }))
)

const skillCategories: SkillCategory[] = [
  {
    title: 'Mobile Engineering',
    description: 'Native Android application development with modern reactive architecture',
    skills: [
      'Kotlin',
      'Jetpack Compose',
      'Coroutines and Flow',
      'Android Jetpack and MVVM',
      'Room Database',
      'Foreground Services',
      'MediaProjection API',
      'CameraX',
      'Agora RTC SDK',
    ],
  },
  {
    title: 'Frontend Development',
    description: 'Accessible, responsive, and performance focused web applications',
    skills: [
      'React 19',
      'TypeScript',
      'Tailwind CSS',
      'Vite',
      'HTML5 and Web APIs',
      'Component Architecture',
      'State Management',
    ],
  },
  {
    title: 'Backend and AI Systems',
    description: 'Server development, AI model integration, and cloud architectures',
    skills: [
      'Python and FastAPI',
      'Node.js and Flask',
      'Google Gemini AI SDK',
      'REST API Design',
      'Firebase Auth and Firestore',
      'Cloudflare Turnstile',
    ],
  },
  {
    title: 'Tooling and Systems',
    description: 'Build tooling, vector spatial data, and deployment pipelines',
    skills: [
      'Git and GitHub',
      'Android Studio',
      'Shapely and Spatial Indexing',
      'OpenCV and Pillow',
      'PDF 1.7 Spec and Vector Layout',
      'Vercel Deployment',
    ],
  },
]

type RouteState =
  | { type: 'home' }
  | { type: 'admin' }
  | { type: 'error'; code: 404 | 403 | 500; path: string }

function resolveCurrentRoute(): RouteState {
  if (typeof window === 'undefined') return { type: 'home' }
  const rawPath = window.location.pathname
  const normalized = rawPath.replace(/\/+$/, '') || '/'
  const hash = window.location.hash

  if (
    normalized === '/iam_admin' ||
    normalized.startsWith('/iam_admin') ||
    hash === '#iam_admin'
  ) {
    return { type: 'admin' }
  }

  if (
    normalized === '/' ||
    normalized === '/index.html' ||
    normalized === '/7c848149d5bed83d6bced0b8f1c39d47.txt' ||
    normalized.startsWith('/essay/') ||
    normalized.startsWith('/essays/') ||
    window.location.search.includes('essay=') ||
    hash.startsWith('#essay-') ||
    hash.startsWith('#essay/')
  ) {
    return { type: 'home' }
  }

  if (normalized === '/404' || normalized === '/not-found') {
    return { type: 'error', code: 404, path: rawPath }
  }

  if (normalized === '/403' || normalized === '/forbidden') {
    return { type: 'error', code: 403, path: rawPath }
  }

  if (normalized === '/500' || normalized === '/server-error' || normalized === '/error') {
    return { type: 'error', code: 500, path: rawPath }
  }

  return { type: 'error', code: 404, path: rawPath }
}

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  const stored = window.localStorage.getItem('theme')
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  const [portfolioData, setPortfolioData] = useState<PortfolioData>(getPortfolioData)
  const [route, setRoute] = useState<RouteState>(resolveCurrentRoute)
  const [isAdminOpen, setIsAdminOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return (
      window.location.pathname === '/iam_admin' ||
      window.location.pathname.startsWith('/iam_admin') ||
      window.location.hash === '#iam_admin'
    )
  })
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'oss' | 'android' | 'web'>('all')
  const [activeModalProject, setActiveModalProject] = useState<Project | null>(null)
  const [contactModalOpen, setContactModalOpen] = useState(false)

  // Form states
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaError, setCaptchaError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [messageSent, setMessageSent] = useState(false)
  const [copiedEmail, setCopiedEmail] = useState(false)
  const [copiedInstall, setCopiedInstall] = useState(false)

  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY
  const formId = useId()

  const projects = portfolioData.projects

  // Subscribe to real-time updates from Firebase
  useEffect(() => {
    const unsubscribe = subscribeToPortfolio((liveData) => {
      setPortfolioData(liveData)
    })
    return () => {
      unsubscribe()
    }
  }, [])

  // Listen to browser navigation changes
  useEffect(() => {
    const handleRouteCheck = () => {
      const nextRoute = resolveCurrentRoute()
      setRoute(nextRoute)
      setIsAdminOpen(nextRoute.type === 'admin')
    }

    window.addEventListener('popstate', handleRouteCheck)
    window.addEventListener('hashchange', handleRouteCheck)
    return () => {
      window.removeEventListener('popstate', handleRouteCheck)
      window.removeEventListener('hashchange', handleRouteCheck)
    }
  }, [])

  const handleCloseAdmin = () => {
    setIsAdminOpen(false)
    if (window.location.pathname.includes('iam_admin')) {
      window.history.pushState(null, '', '/')
    } else if (window.location.hash.includes('iam_admin')) {
      window.location.hash = ''
    }
    setRoute({ type: 'home' })
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    window.localStorage.setItem('theme', theme)
  }, [theme])

  // Handle ESC for modals and mobile menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveModalProject(null)
        setContactModalOpen(false)
        setMobileMenuOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Lock body scroll when a modal is open
  useEffect(() => {
    if (activeModalProject || contactModalOpen || isAdminOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [activeModalProject, contactModalOpen, isAdminOpen])

  const copyEmail = () => {
    navigator.clipboard.writeText(portfolioData.profile.email || 'junaidmeer055@gmail.com')
    setCopiedEmail(true)
    setTimeout(() => setCopiedEmail(false), 2000)
  }

  const copyInstallCommand = () => {
    navigator.clipboard.writeText('npm install @worklabs05/doc-engine pdf-lib')
    setCopiedInstall(true)
    setTimeout(() => setCopiedInstall(false), 2000)
  }

  const handleContactSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    const email = String(formData.get('email') || '').trim()

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setSubmitError('Please enter a valid email address.')
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
          name: formData.get('name'),
          email,
          message: formData.get('message'),
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
        setContactModalOpen(false)
      }, 2000)
    } catch (err) {
      setCaptchaToken('')
      setSubmitError(err instanceof Error ? err.message : 'Failed to send your message.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const ossCount = projects.filter(
    (p) =>
      p.category.toLowerCase().includes('open source') ||
      p.title === 'doc-engine' ||
      p.title.includes('Tauri')
  ).length

  const androidCount = projects.filter(
    (p) =>
      p.category.toLowerCase().includes('android') ||
      p.stack.includes('Kotlin') ||
      p.stack.includes('Jetpack Compose')
  ).length

  const webCount = projects.filter(
    (p) =>
      p.title !== 'doc-engine' &&
      !p.title.includes('Tauri') &&
      (p.category.toLowerCase().includes('web') ||
        p.category.toLowerCase().includes('full stack') ||
        p.category.toLowerCase().includes('ai') ||
        p.stack.includes('React 19') ||
        p.stack.includes('Python') ||
        p.stack.includes('JavaScript'))
  ).length

  const filteredProjects = projects.filter((project) => {
    if (selectedFilter === 'oss') {
      return (
        project.title.toLowerCase().includes('doc-engine') ||
        project.title.toLowerCase().includes('tauri') ||
        project.category.toLowerCase().includes('open source')
      )
    }
    if (selectedFilter === 'android') {
      return (
        project.category.toLowerCase().includes('android') ||
        project.stack.includes('Kotlin') ||
        project.stack.includes('Jetpack Compose')
      )
    }
    if (selectedFilter === 'web') {
      return (
        project.title !== 'doc-engine' &&
        !project.title.includes('Tauri') &&
        (project.category.toLowerCase().includes('web') ||
          project.category.toLowerCase().includes('full stack') ||
          project.category.toLowerCase().includes('ai') ||
          project.stack.includes('React 19') ||
          project.stack.includes('Python') ||
          project.stack.includes('JavaScript'))
      )
    }
    return true
  })

  // Render responsive minimalist error page if invalid route
  if (route.type === 'error') {
    return (
      <div className="relative min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
        <ErrorPage
          code={route.code}
          requestedPath={route.path}
          theme={theme}
          onToggleTheme={() => setTheme((curr) => (curr === 'light' ? 'dark' : 'light'))}
          onNavigateHome={() => {
            window.history.pushState(null, '', '/')
            setRoute({ type: 'home' })
          }}
          onOpenAssistant={() => {
            window.dispatchEvent(new CustomEvent('open-junaid-ai'))
          }}
          onRetry={() => {
            window.location.reload()
          }}
        />
        <AiAssistant />
        <CookieConsent />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] transition-colors duration-200">
      {/* Floating Island Navigation Header */}
      <div className="sticky top-4 z-40 mx-auto max-w-4xl px-4 sm:px-6">
        <header className="glass-island rounded-full px-4 py-2 sm:px-5 sm:py-2.5 flex items-center justify-between transition-all duration-300">
          {/* Identity & Monogram */}
          <a href="#" className="group flex items-center gap-2.5 tap-spring">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-900 text-white font-semibold text-xs tracking-tight dark:bg-white dark:text-neutral-900 shadow-sm">
              JM
            </div>
            <div className="flex flex-col">
              <span className="text-xs sm:text-sm font-semibold tracking-tight text-[var(--color-text)] leading-none">
                {portfolioData.profile.name}
              </span>
              <span className="text-[10px] sm:text-[11px] text-[var(--color-muted)] leading-tight mt-0.5">
                {portfolioData.profile.role}
              </span>
            </div>
          </a>

          {/* Desktop Navigation Links */}
          <nav className="hidden items-center gap-1 md:flex">
            <a
              href="#open-source"
              className="px-3 py-1.5 rounded-full text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-all tap-spring"
            >
              Open Source
            </a>
            <a
              href="#projects"
              className="px-3 py-1.5 rounded-full text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-all tap-spring"
            >
              Projects
            </a>
            <a
              href="#essays"
              className="px-3 py-1.5 rounded-full text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-all tap-spring"
            >
              Essays
            </a>
            <a
              href="#skills"
              className="px-3 py-1.5 rounded-full text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-all tap-spring"
            >
              Skills
            </a>
            <a
              href="#about"
              className="px-3 py-1.5 rounded-full text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-all tap-spring"
            >
              About
            </a>
          </nav>

          {/* Action & Theme Controls */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setContactModalOpen(true)}
              className="hidden sm:inline-flex btn-primary text-xs px-3.5 py-1.5 tap-spring cursor-pointer"
            >
              Get in touch
            </button>

            {/* Apple-style Theme Toggle */}
            <button
              type="button"
              onClick={() => setTheme((curr) => (curr === 'light' ? 'dark' : 'light'))}
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-all tap-spring cursor-pointer"
            >
              {theme === 'light' ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                  />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              )}
            </button>

            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((curr) => !curr)}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-text)] hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-all tap-spring md:hidden cursor-pointer"
            >
              {mobileMenuOpen ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </header>

        {/* Mobile Dropdown Sheet */}
        {mobileMenuOpen && (
          <div className="glass-island mt-2 rounded-3xl p-4 shadow-xl md:hidden animate-in fade-in zoom-in-95 duration-200">
            <nav className="flex flex-col gap-1.5 text-sm">
              <a
                href="#open-source"
                onClick={() => setMobileMenuOpen(false)}
                className="px-4 py-2.5 rounded-2xl text-[var(--color-text)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors font-medium"
              >
                Open Source
              </a>
              <a
                href="#projects"
                onClick={() => setMobileMenuOpen(false)}
                className="px-4 py-2.5 rounded-2xl text-[var(--color-text)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors font-medium"
              >
                Projects
              </a>
              <a
                href="#essays"
                onClick={() => setMobileMenuOpen(false)}
                className="px-4 py-2.5 rounded-2xl text-[var(--color-text)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors font-medium"
              >
                Essays
              </a>
              <a
                href="#skills"
                onClick={() => setMobileMenuOpen(false)}
                className="px-4 py-2.5 rounded-2xl text-[var(--color-text)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors font-medium"
              >
                Skills
              </a>
              <a
                href="#about"
                onClick={() => setMobileMenuOpen(false)}
                className="px-4 py-2.5 rounded-2xl text-[var(--color-text)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors font-medium"
              >
                About
              </a>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false)
                  setContactModalOpen(true)
                }}
                className="mt-2 w-full btn-primary text-xs py-2.5 text-center font-medium cursor-pointer"
              >
                Open Contact Form
              </button>
            </nav>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <main className="mx-auto max-w-4xl px-6 pt-12 pb-20 md:pt-16 md:pb-28">
        {/* Hero Section */}
        <section className="mb-24">
          {/* Live Availability Pill */}
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 shadow-xs">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
            </span>
            <span>Available for select engineering roles & architectural consulting</span>
          </div>

          <h1 className="mt-6 text-3xl font-semibold tracking-tight sm:text-5xl lg:text-6xl text-[var(--color-text)] leading-[1.14]">
            {portfolioData.profile.headline || 'Native Android and full stack web developer.'}
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-relaxed text-[var(--color-text-secondary)] sm:text-lg">
            {portfolioData.profile.bio || "I'm Junaid, a software engineer with 3+ years of experience building applications. Creator of doc-engine, an open source vector PDF engine, contributor to Tauri, and developer of production Android apps with Kotlin and Jetpack Compose."}
          </p>

          {/* Action Group */}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setContactModalOpen(true)}
              className="btn-primary px-5 py-2.5 text-sm tap-spring shadow-sm"
            >
              Get in touch
            </button>
            <a
              href="#projects"
              className="btn-secondary px-5 py-2.5 text-sm tap-spring"
            >
              View projects
            </a>

            {/* Refined Social Pills */}
            <div className="flex flex-wrap items-center gap-2 pl-1 sm:pl-3">
              {portfolioData.profile.github && (
                <a
                  href={portfolioData.profile.github}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-hover)] transition-all tap-spring inline-flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                  </svg>
                  <span>GitHub</span>
                </a>
              )}
              {portfolioData.profile.linkedin && (
                <a
                  href={portfolioData.profile.linkedin}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-hover)] transition-all tap-spring inline-flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                  </svg>
                  <span>LinkedIn</span>
                </a>
              )}
              <button
                type="button"
                onClick={copyEmail}
                className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-hover)] transition-all tap-spring inline-flex items-center gap-1.5 cursor-pointer"
              >
                <span>✉️</span>
                <span>{copiedEmail ? 'Copied' : (portfolioData.profile.email || 'junaidmeer055@gmail.com')}</span>
              </button>
            </div>
          </div>
        </section>

        {/* Featured Open Source Showcase */}
        <section id="open-source" className="mb-24 scroll-mt-24">
          <div className="pb-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <span>Open Source Systems</span>
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--color-text)] sm:text-3xl">
              Open Source Work
            </h2>
            <p className="mt-1.5 text-sm sm:text-base text-[var(--color-muted)] max-w-2xl">
              Original open source software engines and official upstream contributions to major developer platforms.
            </p>
          </div>

          <div className="space-y-6">
            {/* Card 1: doc-engine */}
            <div className="glass-card rounded-3xl p-6 sm:p-8 relative overflow-hidden">
              <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold text-[var(--color-text)]">@worklabs05/doc-engine</span>
                    <span className="text-[var(--color-muted)]">•</span>
                    <span className="rounded-full bg-black/[0.04] dark:bg-white/[0.06] px-2.5 py-0.5 font-medium text-[var(--color-text-secondary)]">TypeScript & React</span>
                    <span className="rounded-full bg-black/[0.04] dark:bg-white/[0.06] px-2.5 py-0.5 font-medium text-[var(--color-text-secondary)]">PDF 1.7 Spec</span>
                  </div>

                  <h3 className="text-xl font-semibold text-[var(--color-text)] tracking-tight">
                    doc-engine: High Performance PDF Engine
                  </h3>

                  <p className="text-sm leading-relaxed text-[var(--color-text-secondary)] max-w-2xl">
                    Compiles React JSX components or serializable JSON AST directly to real, searchable vector PDFs
                    and 60 FPS HTML5 Canvas previews. Zero heavyweight Python daemons, zero Puppeteer headless browsers.
                    Emits native vector PDF 1.7 paths, text operators, and multi page flows.
                  </p>

                  {/* Feature Badges */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-600 dark:text-blue-400">
                      ⚡ 60 FPS HTML5 Canvas
                    </span>
                    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      📄 Vector PDF 1.7
                    </span>
                    <span className="rounded-full border border-purple-500/20 bg-purple-500/10 px-2.5 py-1 text-xs font-medium text-purple-600 dark:text-purple-400">
                      🚀 Zero Headless Chrome
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-xs sm:flex-col sm:items-end shrink-0">
                  <a
                    href="https://docengine.worklabs.studio"
                    target="_blank"
                    rel="noreferrer"
                    className="btn-primary px-4 py-2 text-xs tap-spring"
                  >
                    Documentation ↗
                  </a>
                  <a
                    href="https://github.com/junaidmirr/doc-engine.git"
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary px-4 py-2 text-xs tap-spring"
                  >
                    GitHub Repository ↗
                  </a>
                </div>
              </div>

              {/* Install Command Banner */}
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] p-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-[var(--color-muted)] font-medium">Install:</span>
                  <code className="font-mono text-xs text-[var(--color-text)]">
                    npm install @worklabs05/doc-engine pdf-lib
                  </code>
                </div>
                <button
                  type="button"
                  onClick={copyInstallCommand}
                  className="rounded-full bg-white dark:bg-neutral-800 border border-[var(--color-border)] px-3 py-1 text-xs font-medium text-[var(--color-text)] hover:border-[var(--color-border-hover)] transition-all tap-spring cursor-pointer shadow-2xs"
                >
                  {copiedInstall ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Card 2: Tauri Contribution */}
            <div className="glass-card rounded-3xl p-6 sm:p-8 relative overflow-hidden">
              <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold text-[var(--color-text)]">tauri-apps/tauri</span>
                    <span className="text-[var(--color-muted)]">•</span>
                    <span className="rounded-full bg-black/[0.04] dark:bg-white/[0.06] px-2.5 py-0.5 font-medium text-[var(--color-text-secondary)]">Rust & Cargo</span>
                    <span className="rounded-full bg-black/[0.04] dark:bg-white/[0.06] px-2.5 py-0.5 font-medium text-[var(--color-text-secondary)]">Pull Request #15634</span>
                  </div>

                  <h3 className="text-xl font-semibold text-[var(--color-text)] tracking-tight">
                    Tauri: Official Upstream CLI Contribution
                  </h3>

                  <p className="text-sm leading-relaxed text-[var(--color-text-secondary)] max-w-2xl">
                    Upstream contribution merged into official Tauri 2 release. Enhanced the tauri init command
                    so that when stdin is not a terminal, the CLI automatically skips interactive prompts,
                    preventing IO blocking in CI workflows and non interactive test scripts.
                  </p>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                      🏆 Merged into Tauri 2 Core
                    </span>
                    <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-600 dark:text-blue-400">
                      ⚙️ CI / Non-interactive Automation
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-xs sm:flex-col sm:items-end shrink-0">
                  <a
                    href="https://github.com/tauri-apps/tauri/pull/15634"
                    target="_blank"
                    rel="noreferrer"
                    className="btn-primary px-4 py-2 text-xs tap-spring"
                  >
                    View Pull Request ↗
                  </a>
                  <a
                    href="https://github.com/tauri-apps/tauri"
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary px-4 py-2 text-xs tap-spring"
                  >
                    tauri-apps/tauri ↗
                  </a>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-2 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] p-3 text-xs text-[var(--color-muted)]">
                <span className="font-semibold text-[var(--color-text)]">Release:</span>
                <span>Included in official Tauri 2.12 Release Changelog (#15634)</span>
              </div>
            </div>
          </div>
        </section>

        {/* Selected Projects */}
        <section id="projects" className="mb-24 scroll-mt-24">
          <div className="flex flex-col justify-between gap-4 pb-6 sm:flex-row sm:items-end">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-[var(--color-text)] sm:text-3xl">
                Selected Projects
              </h2>
              <p className="mt-1 text-sm sm:text-base text-[var(--color-muted)]">
                Real world Android, AI navigation, and full stack systems built from concept to deployment.
              </p>
            </div>

            {/* iOS Segmented Control Filter */}
            <div className="inline-flex items-center gap-1 rounded-full bg-black/[0.04] dark:bg-white/[0.06] p-1 text-xs border border-[var(--color-border)] self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setSelectedFilter('all')}
                className={`rounded-full px-3 py-1.5 transition-all tap-spring cursor-pointer ${
                  selectedFilter === 'all'
                    ? 'filter-btn-active'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                All ({projects.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedFilter('oss')}
                className={`rounded-full px-3 py-1.5 transition-all tap-spring cursor-pointer ${
                  selectedFilter === 'oss'
                    ? 'filter-btn-active'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                Open Source ({ossCount})
              </button>
              <button
                type="button"
                onClick={() => setSelectedFilter('android')}
                className={`rounded-full px-3 py-1.5 transition-all tap-spring cursor-pointer ${
                  selectedFilter === 'android'
                    ? 'filter-btn-active'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                Android ({androidCount})
              </button>
              <button
                type="button"
                onClick={() => setSelectedFilter('web')}
                className={`rounded-full px-3 py-1.5 transition-all tap-spring cursor-pointer ${
                  selectedFilter === 'web'
                    ? 'filter-btn-active'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                Web & AI ({webCount})
              </button>
            </div>
          </div>

          {/* Curated Grid Layout */}
          <div className="grid gap-6 sm:grid-cols-2">
            {filteredProjects.map((project) => (
              <article
                key={project.title}
                className="glass-card rounded-3xl p-6 flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-[var(--color-muted)] mb-3">
                    <span className="rounded-full bg-black/[0.04] dark:bg-white/[0.06] px-2.5 py-0.5 font-medium text-[var(--color-text-secondary)]">
                      {project.category}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveModalProject(project)}
                      className="text-xs font-medium text-[var(--color-text)] hover:opacity-75 cursor-pointer tap-spring inline-flex items-center gap-1"
                    >
                      <span>Architecture</span>
                      <span>→</span>
                    </button>
                  </div>

                  <h3 className="text-lg font-semibold tracking-tight text-[var(--color-text)] group-hover:text-blue-500 transition-colors">
                    {project.title}
                  </h3>

                  <p className="mt-2.5 text-xs sm:text-sm leading-relaxed text-[var(--color-text-secondary)] line-clamp-3">
                    {project.description}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {project.stack.map((tech) => (
                      <span
                        key={tech}
                        className="rounded-full bg-black/[0.03] dark:bg-white/[0.05] px-2.5 py-0.5 text-[11px] font-medium text-[var(--color-muted)]"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-[var(--color-border)] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    {project.githubUrl && (
                      <a
                        href={project.githubUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[var(--color-muted)] hover:text-[var(--color-text)] font-medium transition-colors inline-flex items-center gap-1 tap-spring"
                      >
                        {project.title.includes('Tauri') ? 'Pull Request ↗' : 'GitHub ↗'}
                      </a>
                    )}
                    {project.liveUrl && project.liveUrl !== '#' && !project.title.includes('Tauri') && (
                      <a
                        href={project.liveUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[var(--color-muted)] hover:text-[var(--color-text)] font-medium transition-colors inline-flex items-center gap-1 tap-spring"
                      >
                        {project.title === 'doc-engine' ? 'Docs ↗' : 'Live ↗'}
                      </a>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveModalProject(project)}
                    className="btn-secondary px-3 py-1 text-xs tap-spring cursor-pointer"
                  >
                    Details
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Technical Essays and Perspectives */}
        <EssaysSection essays={portfolioData.essays || []} />

        {/* Technical Skills and Architecture */}
        <section id="skills" className="mb-24 scroll-mt-24">
          <div className="pb-6">
            <h2 className="text-2xl font-semibold tracking-tight text-[var(--color-text)] sm:text-3xl">
              Technical Skills & Tooling
            </h2>
            <p className="mt-1.5 text-sm sm:text-base text-[var(--color-muted)]">
              Technologies and platforms I use to build robust software systems.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {skillCategories.map((group) => (
              <div
                key={group.title}
                className="glass-card rounded-3xl p-6 sm:p-7 space-y-4"
              >
                <div>
                  <h3 className="text-base font-semibold text-[var(--color-text)] tracking-tight">
                    {group.title}
                  </h3>
                  <p className="mt-1 text-xs sm:text-sm text-[var(--color-muted)]">
                    {group.description}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {group.skills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.07] dark:hover:bg-white/[0.1] px-3 py-1 text-xs font-medium text-[var(--color-text)] transition-colors"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* About Section */}
        <section id="about" className="mb-24 scroll-mt-24">
          <div className="pb-6">
            <h2 className="text-2xl font-semibold tracking-tight text-[var(--color-text)] sm:text-3xl">
              About
            </h2>
            <p className="mt-1.5 text-sm sm:text-base text-[var(--color-muted)]">
              Engineering background, principles, and workflow.
            </p>
          </div>

          <div className="glass-card rounded-3xl p-6 sm:p-8 space-y-4 text-sm sm:text-base leading-relaxed text-[var(--color-text-secondary)]">
            <p>
              I am a software engineer focused on building clean, reliable applications. My work spans
              native Android engineering leveraging Kotlin, Jetpack Compose, Room, and foreground services to
              full stack web development with React, TypeScript, and Python.
            </p>
            <p>
              I author open source software including <span className="text-[var(--color-text)] font-semibold">doc-engine</span>,
              a high performance headless PDF and layout engine that compiles React JSX and AST into vector PDF 1.7 streams without
              relying on headless browsers or server daemons. I also contribute upstream to developer tools including <span className="text-[var(--color-text)] font-semibold">Tauri</span>.
            </p>
            <p>
              When engineering native Android applications, I prioritize reactive state management (Coroutines, Flow,
              StateFlow), clean separation of concerns via MVVM, and deep integration with device APIs such as
              MediaProjection for screen sharing, Agora SDK for RTC video conferencing, and Room for offline persistence.
            </p>
            <p>
              On the web, I build accessible, fast loading user interfaces paired with secure, pragmatic backends.
              I avoid unnecessary architectural overhead, focusing instead on clarity, speed, and code maintainability.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-4 border-t border-[var(--color-border)] pt-6 sm:grid-cols-4 text-xs">
              <div>
                <span className="text-[var(--color-muted)] block font-medium">Location</span>
                <span className="font-semibold text-[var(--color-text)] mt-0.5 block">Bangalore, India</span>
              </div>
              <div>
                <span className="text-[var(--color-muted)] block font-medium">Experience</span>
                <span className="font-semibold text-[var(--color-text)] mt-0.5 block">3+ Years</span>
              </div>
              <div>
                <span className="text-[var(--color-muted)] block font-medium">Mobile Focus</span>
                <span className="font-semibold text-[var(--color-text)] mt-0.5 block">Kotlin / Compose</span>
              </div>
              <div>
                <span className="text-[var(--color-muted)] block font-medium">Web & Systems</span>
                <span className="font-semibold text-[var(--color-text)] mt-0.5 block">TS / React / Python</span>
              </div>
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section id="contact" className="mb-16 scroll-mt-24">
          <div className="glass-card rounded-3xl p-6 sm:p-10 flex flex-col justify-between gap-8 sm:flex-row sm:items-center">
            <div className="space-y-4">
              <div>
                <span className="text-xs uppercase tracking-wider font-semibold text-[var(--color-muted)]">
                  Direct Inquiries
                </span>
                <div className="mt-1.5 flex flex-wrap items-center gap-3">
                  <a
                    href={`mailto:${portfolioData.profile.email || 'junaidmeer055@gmail.com'}`}
                    className="text-lg sm:text-xl font-semibold text-[var(--color-text)] hover:underline"
                  >
                    {portfolioData.profile.email || 'junaidmeer055@gmail.com'}
                  </a>
                  <button
                    type="button"
                    onClick={copyEmail}
                    className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-hover)] transition-all tap-spring cursor-pointer"
                  >
                    {copiedEmail ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--color-muted)]">
                {portfolioData.profile.github && (
                  <>
                    <a
                      href={portfolioData.profile.github}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-[var(--color-text)] transition-colors"
                    >
                      GitHub ↗
                    </a>
                    <span>•</span>
                  </>
                )}
                {portfolioData.profile.linkedin && (
                  <>
                    <a
                      href={portfolioData.profile.linkedin}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-[var(--color-text)] transition-colors"
                    >
                      LinkedIn ↗
                    </a>
                    <span>•</span>
                  </>
                )}
                <span>{portfolioData.profile.location || 'Bangalore, India (UTC+5:30)'}</span>
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={() => setContactModalOpen(true)}
                className="btn-primary px-6 py-3 text-sm tap-spring shadow-sm cursor-pointer whitespace-nowrap"
              >
                Open Contact Form
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--color-border)] bg-[var(--color-surface)] py-10 text-xs text-[var(--color-muted)]">
        <div className="mx-auto max-w-4xl px-6">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row sm:items-center">
            {/* Left: Branding & Copyright */}
            <div className="flex flex-col items-center sm:items-start gap-1 text-center sm:text-left">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[var(--color-text)]">
                  {portfolioData.profile.name || 'Junaid'}
                </span>
                <span className="text-[10px] text-[var(--color-muted)]">•</span>
                <span className="text-xs text-[var(--color-muted)]">
                  {portfolioData.profile.role || 'Software Engineer'}
                </span>
              </div>
              <p className="text-xs text-[var(--color-muted)]">
                © {new Date().getFullYear()} All rights reserved.
              </p>
            </div>

            {/* Right: Navigation Links */}
            <nav
              aria-label="Footer navigation"
              className="flex flex-wrap items-center justify-center sm:justify-end gap-x-4 gap-y-2 text-xs"
            >
              <a
                href="#open-source"
                className="transition-colors hover:text-[var(--color-text)] py-1 font-medium"
              >
                Open Source
              </a>
              <a
                href="#projects"
                className="transition-colors hover:text-[var(--color-text)] py-1 font-medium"
              >
                Projects
              </a>
              <a
                href="#essays"
                className="transition-colors hover:text-[var(--color-text)] py-1 font-medium"
              >
                Essays
              </a>
              <a
                href="#skills"
                className="transition-colors hover:text-[var(--color-text)] py-1 font-medium"
              >
                Skills
              </a>
              <a
                href="#about"
                className="transition-colors hover:text-[var(--color-text)] py-1 font-medium"
              >
                About
              </a>
              <button
                type="button"
                onClick={() => setContactModalOpen(true)}
                className="transition-colors hover:text-[var(--color-text)] cursor-pointer py-1 font-medium"
              >
                Contact
              </button>
              <a
                href="#"
                className="inline-flex items-center gap-1 transition-colors hover:text-[var(--color-text)] py-1 text-[var(--color-text)] font-semibold"
              >
                Top ↑
              </a>
            </nav>
          </div>
        </div>
      </footer>

      {/* Contact Form Modal */}
      {contactModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="contact-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6 backdrop-blur-md animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setContactModalOpen(false)
          }}
        >
          <div className="relative flex max-h-[92vh] w-full max-w-lg flex-col rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:p-8 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-[var(--color-border)] pb-4">
              <div>
                <span className="text-xs uppercase tracking-wider font-semibold text-[var(--color-muted)]">
                  Get in Touch
                </span>
                <h3 id="contact-modal-title" className="text-xl font-semibold text-[var(--color-text)] mt-0.5">
                  Send a Message
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setContactModalOpen(false)}
                aria-label="Close dialog"
                className="rounded-full border border-[var(--color-border)] p-1.5 text-[var(--color-muted)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-text)] tap-spring cursor-pointer"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Form Body */}
            <div className="overflow-y-auto py-5">
              <form onSubmit={handleContactSubmit} className="space-y-4">
                <div>
                  <label htmlFor={`${formId}-name`} className="block text-xs font-semibold text-[var(--color-text)]">
                    Your Name
                  </label>
                  <input
                    id={`${formId}-name`}
                    type="text"
                    name="name"
                    required
                    placeholder="e.g. Alex Smith"
                    className="mt-1.5 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)]/60 focus:border-[var(--color-accent)] focus:outline-none transition-all"
                  />
                </div>

                <div>
                  <label htmlFor={`${formId}-email`} className="block text-xs font-semibold text-[var(--color-text)]">
                    Email Address
                  </label>
                  <input
                    id={`${formId}-email`}
                    type="email"
                    name="email"
                    required
                    placeholder="name@example.com"
                    className="mt-1.5 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)]/60 focus:border-[var(--color-accent)] focus:outline-none transition-all"
                  />
                </div>

                <div>
                  <label htmlFor={`${formId}-message`} className="block text-xs font-semibold text-[var(--color-text)]">
                    Message
                  </label>
                  <textarea
                    id={`${formId}-message`}
                    name="message"
                    rows={4}
                    required
                    placeholder="Describe your project, role, or inquiry..."
                    className="mt-1.5 w-full resize-y rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)]/60 focus:border-[var(--color-accent)] focus:outline-none transition-all"
                  />
                </div>

                {turnstileSiteKey ? (
                  <TurnstileCaptcha
                    open={contactModalOpen}
                    siteKey={turnstileSiteKey}
                    theme={theme}
                    onVerify={(token) => {
                      setCaptchaToken(token)
                      setCaptchaError('')
                    }}
                    onExpire={() => setCaptchaToken('')}
                  />
                ) : null}

                {captchaError ? <p className="text-xs text-red-500">{captchaError}</p> : null}
                {submitError ? <p className="text-xs text-red-500">{submitError}</p> : null}
                {messageSent ? (
                  <p className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    Message sent successfully. I will get back to you soon.
                  </p>
                ) : null}

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--color-border)]">
                  <button
                    type="button"
                    onClick={() => setContactModalOpen(false)}
                    className="btn-secondary px-4 py-2 text-xs tap-spring cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || messageSent || (Boolean(turnstileSiteKey) && !captchaToken)}
                    className="btn-primary px-5 py-2 text-xs disabled:opacity-50 disabled:cursor-not-allowed tap-spring"
                  >
                    {isSubmitting ? 'Sending...' : messageSent ? 'Sent' : 'Send Message'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Architecture and Case Study Modal */}
      {activeModalProject && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-project-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6 backdrop-blur-md animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveModalProject(null)
          }}
        >
          <div
            className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:p-8 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-[var(--color-border)] pb-4">
              <div>
                <span className="rounded-full bg-black/[0.04] dark:bg-white/[0.06] px-2.5 py-0.5 text-xs font-medium text-[var(--color-muted)]">
                  {activeModalProject.category}
                </span>
                <h3 id="modal-project-title" className="text-xl sm:text-2xl font-semibold text-[var(--color-text)] mt-2 tracking-tight">
                  {activeModalProject.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModalProject(null)}
                aria-label="Close dialog"
                className="rounded-full border border-[var(--color-border)] p-1.5 text-[var(--color-muted)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-text)] tap-spring cursor-pointer"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto py-5 space-y-6 text-sm">
              <div>
                <h4 className="text-xs uppercase tracking-wider font-semibold text-[var(--color-muted)]">
                  Overview
                </h4>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                  {activeModalProject.fullDescription}
                </p>
              </div>

              <div>
                <h4 className="text-xs uppercase tracking-wider font-semibold text-[var(--color-muted)]">
                  Key Technical Features
                </h4>
                <ul className="mt-2.5 space-y-2 list-disc pl-5 text-sm text-[var(--color-text-secondary)] marker:text-[var(--color-text)]">
                  {activeModalProject.features.map((feature) => (
                    <li key={feature} className="leading-relaxed">
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-xs uppercase tracking-wider font-semibold text-[var(--color-muted)]">
                  Architecture & Technologies
                </h4>
                <div className="mt-2.5 divide-y divide-[var(--color-border)] rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] text-xs overflow-hidden">
                  {activeModalProject.technologies.map((tech) => (
                    <div key={tech.name} className="p-3.5">
                      <span className="font-semibold text-[var(--color-text)]">{tech.name}: </span>
                      <span className="text-[var(--color-muted)]">{tech.details}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-4 text-xs">
              <div className="flex items-center gap-3">
                {activeModalProject.githubUrl && (
                  <a
                    href={activeModalProject.githubUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-[var(--color-text)] hover:underline inline-flex items-center gap-1"
                  >
                    {activeModalProject.title.includes('Tauri') ? 'Pull Request ↗' : 'GitHub Repository ↗'}
                  </a>
                )}
                {activeModalProject.liveUrl && activeModalProject.liveUrl !== '#' && !activeModalProject.title.includes('Tauri') && (
                  <a
                    href={activeModalProject.liveUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-[var(--color-text)] hover:underline inline-flex items-center gap-1"
                  >
                    {activeModalProject.title === 'doc-engine' ? 'Documentation & Workbench ↗' : 'Live Deployment ↗'}
                  </a>
                )}
              </div>

              <button
                type="button"
                onClick={() => setActiveModalProject(null)}
                className="btn-secondary px-4 py-1.5 text-xs tap-spring cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Management Portal */}
      {isAdminOpen && (
        <Suspense fallback={null}>
          <AdminPage
            initialData={portfolioData}
            onClose={handleCloseAdmin}
            onDataUpdated={(updated) => setPortfolioData(updated)}
          />
        </Suspense>
      )}

      {/* AI Assistant Chat Widget */}
      <AiAssistant />

      {/* Cookie Consent Banner for First-time Visitors */}
      <CookieConsent />
    </div>
  )
}
