import { useState, useEffect, lazy, Suspense } from 'react'
import { getPortfolioData } from './portfolioDataManager'
import { subscribeToPortfolio } from './services/portfolioService'
import { ErrorPage } from './components/ErrorPage'
import { EssaysSection } from './components/EssaysSection'
import { TodoPlaceholder } from './components/TodoPlaceholder'
import { ContactModal } from './components/ContactModal'
import { AiAssistant } from './components/AiAssistant'
import { SettingsModal } from './components/SettingsModal'
import type { Theme, PortfolioData } from './types'

const AdminPage = lazy(() =>
  import('./components/AdminPage').then((m) => ({ default: m.AdminPage }))
)

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

const VALID_THEMES: Theme[] = ['light', 'vanilla', 'rose', 'butterscotch', 'dark']

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  const stored = window.localStorage.getItem('theme') as Theme | null
  if (stored && VALID_THEMES.includes(stored)) return stored
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
  const [isScrolled, setIsScrolled] = useState(false)
  const [copiedEmail, setCopiedEmail] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isContactModalOpen, setIsContactModalOpen] = useState(false)

  // Real-time synchronization
  useEffect(() => {
    const unsubscribe = subscribeToPortfolio((liveData) => {
      setPortfolioData(liveData)
    })
    return () => unsubscribe()
  }, [])

  // Route listener
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

  // Scroll listener for sticky header border
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 16)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Theme application
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    window.localStorage.setItem('theme', theme)
  }, [theme])

  const handleCloseAdmin = () => {
    setIsAdminOpen(false)
    if (window.location.pathname.includes('iam_admin')) {
      window.history.pushState(null, '', '/')
    } else if (window.location.hash.includes('iam_admin')) {
      window.location.hash = ''
    }
    setRoute({ type: 'home' })
  }

  const copyEmail = () => {
    navigator.clipboard.writeText(portfolioData.profile.email || 'contact@junaidmir.me')
    setCopiedEmail(true)
    setTimeout(() => setCopiedEmail(false), 2200)
  }

  // Render error page if route is error
  if (route.type === 'error') {
    return (
      <div className="relative min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
        <ErrorPage
          code={route.code}
          requestedPath={route.path}
          theme={theme === 'dark' ? 'dark' : 'light'}
          onToggleTheme={() => setTheme((curr) => (curr === 'dark' ? 'light' : 'dark'))}
          onNavigateHome={() => {
            window.history.pushState(null, '', '/')
            setRoute({ type: 'home' })
          }}
          onOpenAssistant={() => {}}
          onRetry={() => {
            window.location.reload()
          }}
        />
      </div>
    )
  }

  // Dynamically update document title based on portfolio profile name & role
  useEffect(() => {
    const name = portfolioData.profile?.name || 'Junaid Mir'
    const role = portfolioData.profile?.role || 'Software Developer'
    document.title = `${name} — ${role}`
  }, [portfolioData.profile?.name, portfolioData.profile?.role])

  // Centerpiece showcase projects (first 4 projects from live portfolio data)
  const selectedWork = (portfolioData.projects || []).slice(0, 4)
  // Remaining projects for Other Work table
  const otherWork = (portfolioData.projects || []).slice(4)

  // Dynamic skills definition list
  const defaultSkills = [
    { category: 'Languages', items: 'Kotlin, TypeScript, Python, Rust' },
    { category: 'Mobile', items: 'Jetpack Compose, Coroutines & Flow, Android Jetpack & MVVM, Room Database, Foreground Services, CameraX, Agora RTC' },
    { category: 'Web', items: 'React 19, TypeScript, Tailwind CSS, Vite, HTML5 Canvas' },
    { category: 'Backend & AI', items: 'FastAPI, Node.js, Model Context Protocol (MCP), Tree-sitter AST, Google Gemini AI SDK, REST APIs' },
    { category: 'Tooling', items: 'Git & GitHub, Android Studio, Shapely & Spatial Indexing, PDF 1.7 Spec, Vercel' },
  ]
  const skillsList = Array.isArray(portfolioData.skills) && portfolioData.skills.length > 0
    ? portfolioData.skills
    : defaultSkills

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] transition-colors duration-180">
      {/* Accessible skip to main content */}
      <a href="#main-content" className="skip-to-content">
        Skip to main content
      </a>

      {/* 1. Header: Plain text row, sticky with hairline bottom border only after scroll */}
      <header
        className={`sticky top-0 z-30 bg-[var(--color-bg)] transition-colors duration-180 ${
          isScrolled ? 'border-b border-[var(--color-border)]' : ''
        }`}
      >
        <div className="mx-auto flex max-w-[1040px] items-center justify-between px-6 py-5">
          {/* Name Left */}
          <a
            href="#"
            className="font-display text-xl font-medium tracking-tight text-[var(--color-text)] hover-accent-link"
          >
            {portfolioData.profile.name || 'Junaid Mir'}
          </a>

          {/* Links Right + Theme Spinner */}
          <div className="flex items-center gap-3 sm:gap-6">
            <nav aria-label="Main Navigation" className="hidden sm:flex items-center gap-6 text-sm">
              <a href="#work" className="text-[var(--color-text-muted)] hover-accent-link">
                Work
              </a>
              <a href="#writing" className="text-[var(--color-text-muted)] hover-accent-link">
                Writing
              </a>
              <a href="#skills" className="text-[var(--color-text-muted)] hover-accent-link">
                Skills
              </a>
              <a href="#about" className="text-[var(--color-text-muted)] hover-accent-link">
                About
              </a>
              <button
                type="button"
                onClick={() => setIsContactModalOpen(true)}
                className="text-[var(--color-text-muted)] hover-accent-link cursor-pointer text-sm font-sans"
              >
                Contact
              </button>
            </nav>

            {/* Settings Icon & Card Popover */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsSettingsOpen((prev) => !prev)}
                aria-label="Open settings and preferences"
                aria-expanded={isSettingsOpen}
                title="Settings (Theme, Cookies, App Info)"
                className="relative flex h-8 w-8 items-center justify-center rounded-[5px] border border-[var(--color-border)] bg-[var(--color-surface)]/80 text-[var(--color-text-subtle)] hover:text-[var(--color-text)] hover:border-[var(--color-border-hover)] cursor-pointer transition-colors"
              >
                <svg
                  className="h-4 w-4 transition-transform duration-300 hover:rotate-45"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </button>

              <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                theme={theme}
                onChangeTheme={setTheme}
              />
            </div>

            {/* Mobile Hamburger Text Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((open) => !open)}
              aria-label="Toggle navigation menu"
              className="sm:hidden font-mono text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] cursor-pointer"
            >
              [{mobileMenuOpen ? 'Close' : 'Menu'}]
            </button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <div className="border-b border-[var(--color-border)] bg-[var(--color-bg)] px-6 py-4 sm:hidden">
            <nav className="flex flex-col gap-3 text-sm">
              <a
                href="#work"
                onClick={() => setMobileMenuOpen(false)}
                className="text-[var(--color-text-muted)] hover-accent-link"
              >
                Work
              </a>
              <a
                href="#writing"
                onClick={() => setMobileMenuOpen(false)}
                className="text-[var(--color-text-muted)] hover-accent-link"
              >
                Writing
              </a>
              <a
                href="#skills"
                onClick={() => setMobileMenuOpen(false)}
                className="text-[var(--color-text-muted)] hover-accent-link"
              >
                Skills
              </a>
              <a
                href="#about"
                onClick={() => setMobileMenuOpen(false)}
                className="text-[var(--color-text-muted)] hover-accent-link"
              >
                About
              </a>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false)
                  setIsContactModalOpen(true)
                }}
                className="text-left text-[var(--color-text-muted)] hover-accent-link cursor-pointer text-sm font-sans"
              >
                Contact
              </button>
            </nav>
          </div>
        )}
      </header>

      {/* Main Single Column Flow */}
      <main id="main-content" className="mx-auto max-w-[1040px] px-6 pt-16 pb-24 sm:pt-24 sm:pb-32 space-y-24 sm:space-y-32">
        {/* 2. Hero Section: Display Typography, No Greeting, No Badges */}
        <section aria-labelledby="hero-heading" className="max-w-[720px] space-y-6">
          <h1
            id="hero-heading"
            className="font-display text-[clamp(2.5rem,5.5vw,4.25rem)] font-medium leading-[1.08] tracking-tight text-[var(--color-text)]"
          >
            {portfolioData.profile.headline || 'I build developer tools and mobile apps: a Rust MCP server for coding agents, a PDF engine in TypeScript, Android in Kotlin.'}
          </h1>

          <p className="text-base sm:text-lg text-[var(--color-text-muted)] leading-relaxed">
            {portfolioData.profile.heroSubtext || (portfolioData.profile.role ? `${portfolioData.profile.role} in ${portfolioData.profile.location || 'Bangalore'}` : 'Computer engineering student in Bangalore. Merged contributor to Tauri.')}
          </p>

          <div className="flex flex-wrap items-center gap-5 pt-2 text-sm font-mono">
            {portfolioData.profile.github && (
              <a
                href={portfolioData.profile.github}
                target="_blank"
                rel="noreferrer"
                className="editorial-link"
              >
                GitHub [↗]
              </a>
            )}
            {portfolioData.profile.linkedin && (
              <a
                href={portfolioData.profile.linkedin}
                target="_blank"
                rel="noreferrer"
                className="editorial-link"
              >
                LinkedIn [↗]
              </a>
            )}
            <a
              href={`mailto:${portfolioData.profile.email || 'contact@junaidmir.me'}`}
              className="editorial-link"
            >
              Email [↗]
            </a>
          </div>
        </section>

        {/* 3. Selected Work (The Centerpiece): 4 Full-Width Row Sections */}
        <section id="work" className="scroll-mt-16 space-y-12">
          <div className="flex items-baseline justify-between border-b border-[var(--color-border)] pb-3">
            <h2 className="font-display text-2xl sm:text-[28px] font-medium tracking-tight text-[var(--color-text)]">
              Selected Work
            </h2>
            <span className="font-mono text-xs text-[var(--color-text-subtle)]">
              01 / {String(selectedWork.length).padStart(2, '0')}
            </span>
          </div>

          <div className="space-y-16 sm:space-y-20">
            {selectedWork.map((project, idx) => {
              const projectImage = project.imageUrl || project.bannerUrl
              const techString = Array.isArray(project.stack) && project.stack.length > 0
                ? project.stack.join(' / ')
                : project.category
              const outcomeText = project.outcome || project.features?.[0] || project.technologies?.[0]?.details || ''

              const projectLinks: Array<{ label: string; url: string }> = []
              if (project.githubUrl) {
                projectLinks.push({
                  label: project.title.toLowerCase().includes('tauri') ? 'Pull Request' : 'GitHub',
                  url: project.githubUrl,
                })
              }
              if (project.liveUrl && project.liveUrl !== '#') {
                projectLinks.push({
                  label: project.title.toLowerCase().includes('doc') ? 'Docs' : 'Live Deployment',
                  url: project.liveUrl,
                })
              }

              return (
                <article
                  key={project.title || idx}
                  className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start border-b border-[var(--color-border)] pb-16 sm:pb-20"
                >
                  {/* Left Column: Details */}
                  <div className="lg:col-span-6 space-y-4">
                    <div className="flex items-baseline gap-3">
                      <span className="font-mono text-xs text-[var(--color-text-subtle)]">
                        0{idx + 1}
                      </span>
                      <h3 className="font-display text-2xl sm:text-3xl font-medium tracking-tight text-[var(--color-text)]">
                        {project.title}
                      </h3>
                    </div>

                    <p className="text-base text-[var(--color-text)] leading-relaxed">
                      {project.description}
                    </p>

                    {outcomeText && (
                      <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                        {outcomeText}
                      </p>
                    )}

                    <div className="pt-2 font-mono text-xs text-[var(--color-text-subtle)] leading-relaxed">
                      {techString}
                    </div>

                    {projectLinks.length > 0 && (
                      <div className="flex flex-wrap items-center gap-4 pt-3 font-mono text-xs">
                        {projectLinks.map((link) => (
                          <a
                            key={link.label}
                            href={link.url}
                            target="_blank"
                            rel="noreferrer"
                            className="editorial-link"
                          >
                            {link.label} [↗]
                          </a>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Visual Slot / Live Image or TODO Asset Placeholder */}
                  <div className="lg:col-span-6">
                    <TodoPlaceholder
                      src={projectImage}
                      label={`${project.title} screenshot or diagram`}
                      aspectRatio="16/9"
                      alt={`${project.title} project showcase`}
                    />
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        {/* 4. Other Work: Compact Table-like List */}
        <section id="other-work" className="space-y-6">
          <div className="flex items-baseline justify-between border-b border-[var(--color-border)] pb-3">
            <h2 className="font-display text-2xl sm:text-[28px] font-medium tracking-tight text-[var(--color-text)]">
              Other Work
            </h2>
            <span className="font-mono text-xs text-[var(--color-text-subtle)]">
              Archive
            </span>
          </div>

          <div className="divide-y divide-[var(--color-border)] border-b border-[var(--color-border)]">
            {otherWork.map((item, idx) => {
              const itemUrl = (item.liveUrl && item.liveUrl !== '#') ? item.liveUrl : item.githubUrl

              return (
                <div
                  key={item.title || idx}
                  className="journal-row group py-4 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 sm:gap-6"
                >
                  {/* Year / Type */}
                  <div className="font-mono text-xs text-[var(--color-text-subtle)] w-36 shrink-0">
                    2026 · {item.category}
                  </div>

                  {/* Name & One-line Description */}
                  <div className="flex-1 min-w-0">
                    {itemUrl ? (
                      <a
                        href={itemUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="group-hover:text-[var(--color-accent)] transition-colors"
                      >
                        <span className="font-medium text-[var(--color-text)] group-hover:text-[var(--color-accent)] mr-2">
                          {item.title}
                        </span>
                        <span className="text-sm text-[var(--color-text-muted)]">
                          {item.description}
                        </span>
                      </a>
                    ) : (
                      <div>
                        <span className="font-medium text-[var(--color-text)] mr-2">
                          {item.title}
                        </span>
                        <span className="text-sm text-[var(--color-text-muted)]">
                          {item.description}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Plain Text Link */}
                  {itemUrl && (
                    <div className="font-mono text-xs shrink-0 sm:text-right">
                      <a
                        href={itemUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="editorial-link"
                      >
                        Link [↗]
                      </a>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* 5. Writing: Text-Only Journal List */}
        <EssaysSection essays={portfolioData.essays || []} />

        {/* 6. Skills: Definition-List Style Block (No Pills, No Boxes) */}
        <section id="skills" className="scroll-mt-16 space-y-6">
          <div className="flex items-baseline justify-between border-b border-[var(--color-border)] pb-3">
            <h2 className="font-display text-2xl sm:text-[28px] font-medium tracking-tight text-[var(--color-text)]">
              Skills
            </h2>
            <span className="font-mono text-xs text-[var(--color-text-subtle)]">
              Competencies
            </span>
          </div>

          <dl className="divide-y divide-[var(--color-border)] border-b border-[var(--color-border)]">
            {skillsList.map((skill) => (
              <div
                key={skill.category}
                className="py-4 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-6 items-baseline"
              >
                <dt className="sm:col-span-3 font-mono text-xs uppercase tracking-wider text-[var(--color-text-subtle)] font-medium">
                  {skill.category}
                </dt>
                <dd className="sm:col-span-9 text-base text-[var(--color-text)] leading-relaxed">
                  {skill.items}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* 7. About: Plain Voice, Photo Slot, 3 Facts */}
        <section id="about" className="scroll-mt-16 space-y-8">
          <div className="flex items-baseline justify-between border-b border-[var(--color-border)] pb-3">
            <h2 className="font-display text-2xl sm:text-[28px] font-medium tracking-tight text-[var(--color-text)]">
              About
            </h2>
            <span className="font-mono text-xs text-[var(--color-text-subtle)]">
              Background
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Bio Prose (Max Width ~720px) */}
            <div className="lg:col-span-8 space-y-5 text-base sm:text-[17px] leading-[1.65] text-[var(--color-text)]">
              {(portfolioData.profile.bio || 'I am a computer engineering student in Bangalore building developer tools and mobile software.')
                .split('\n\n')
                .filter((p) => p.trim().length > 0)
                .map((paragraph, pIdx) => (
                  <p key={pIdx}>
                    {paragraph.trim()}
                  </p>
                ))}

              {/* 3-Item Facts List */}
              <div className="pt-4 border-t border-[var(--color-border)] grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
                <div>
                  <span className="block text-[var(--color-text-subtle)] mb-1 uppercase tracking-wider">
                    Location
                  </span>
                  <span className="text-[var(--color-text)]">
                    {portfolioData.profile.location || 'Bangalore, India'}
                  </span>
                </div>
                <div>
                  <span className="block text-[var(--color-text-subtle)] mb-1 uppercase tracking-wider">
                    Focus
                  </span>
                  <span className="text-[var(--color-text)]">
                    {portfolioData.profile.focus || portfolioData.profile.role || 'Developer Tools & Native Mobile'}
                  </span>
                </div>
                <div>
                  <span className="block text-[var(--color-text-subtle)] mb-1 uppercase tracking-wider">
                    Exploring
                  </span>
                  <span className="text-[var(--color-text)]">
                    {portfolioData.profile.exploring || 'AST Parsing & Local Agents'}
                  </span>
                </div>
              </div>
            </div>

            {/* Small Photo Slot (Live Image or TODO) */}
            <div className="lg:col-span-4 flex justify-start lg:justify-end">
              <TodoPlaceholder
                src={portfolioData.profile.avatarUrl}
                label="Headshot portrait (1:1)"
                aspectRatio="1/1"
                alt="Portrait photo of Junaid Mir"
                className="w-40 sm:w-44"
              />
            </div>
          </div>
        </section>

        {/* 8. Contact: One Large Email Link, Copy Action, Socials & Contact Form */}
        <section id="contact" className="scroll-mt-16 space-y-8 pt-4 border-t border-[var(--color-border)]">
          <div className="max-w-[720px] space-y-4">
            <h2 className="font-mono text-xs uppercase tracking-wider text-[var(--color-text-subtle)] font-medium">
              Contact
            </h2>

            <div className="space-y-3">
              <a
                href={`mailto:${portfolioData.profile.email || 'contact@junaidmir.me'}`}
                className="font-display text-xl sm:text-2xl md:text-3xl lg:text-4xl font-medium tracking-tight text-[var(--color-text)] hover:text-[var(--color-accent)] transition-colors block break-words"
              >
                Say hello — {portfolioData.profile.email || 'contact@junaidmir.me'}
              </a>

              <div className="flex flex-wrap items-center gap-4 text-xs font-mono pt-1">
                <button
                  type="button"
                  onClick={copyEmail}
                  className="editorial-link cursor-pointer"
                >
                  {copiedEmail ? '[Copied to clipboard]' : '[Copy email address]'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsContactModalOpen(true)}
                  className="editorial-link cursor-pointer"
                >
                  [Send direct note →]
                </button>
                {portfolioData.profile.github && (
                  <a
                    href={portfolioData.profile.github}
                    target="_blank"
                    rel="noreferrer"
                    className="editorial-link"
                  >
                    GitHub [↗]
                  </a>
                )}
                {portfolioData.profile.linkedin && (
                  <a
                    href={portfolioData.profile.linkedin}
                    target="_blank"
                    rel="noreferrer"
                    className="editorial-link"
                  >
                    LinkedIn [↗]
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 9. Footer: One Muted Line */}
      <footer className="border-t border-[var(--color-border)] py-8 px-6 text-center font-mono text-xs text-[var(--color-text-subtle)]">
        <div className="mx-auto max-w-[1040px] flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>{portfolioData.profile.name || 'Junaid Mir'} · {new Date().getFullYear()}</span>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-[var(--color-text)] transition-colors">
              Top [↑]
            </a>
            {/* Contact Trigger */}
            <button
              type="button"
              onClick={() => setIsContactModalOpen(true)}
              className="text-[var(--color-text-subtle)] hover:text-[var(--color-accent)] transition-colors cursor-pointer"
            >
              [Contact]
            </button>
            {/* Ask AI Trigger */}
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('open-junaid-ai'))}
              className="text-[var(--color-text-subtle)] hover:text-[var(--color-accent)] transition-colors cursor-pointer"
            >
              [Ask AI]
            </button>
          </div>
        </div>
      </footer>

      {/* Contact Form Modal */}
      <ContactModal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
        theme={theme === 'dark' ? 'dark' : 'light'}
        email={portfolioData.profile.email}
      />

      {/* Admin Portal Modal (if opened via direct route /iam_admin) */}
      {isAdminOpen && (
        <Suspense fallback={null}>
          <AdminPage
            initialData={portfolioData}
            onClose={handleCloseAdmin}
            onDataUpdated={(updated) => setPortfolioData(updated)}
          />
        </Suspense>
      )}

      {/* AI Assistant Chat Component (triggered on-demand via [Ask AI] without persistent floating bubble) */}
      <AiAssistant showFloatingButton={false} />
    </div>
  )
}
