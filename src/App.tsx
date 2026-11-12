import { useState, useEffect, lazy, Suspense } from 'react'
import { getPortfolioData } from './portfolioDataManager'
import { subscribeToPortfolio } from './services/portfolioService'
import { ErrorPage } from './components/ErrorPage'
import { EssaysSection } from './components/EssaysSection'
import { TodoPlaceholder } from './components/TodoPlaceholder'
import { AiAssistant } from './components/AiAssistant'
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
  const [isScrolled, setIsScrolled] = useState(false)
  const [copiedEmail, setCopiedEmail] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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
    navigator.clipboard.writeText(portfolioData.profile.email || 'junaidmeer055@gmail.com')
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
          theme={theme}
          onToggleTheme={() => setTheme((curr) => (curr === 'light' ? 'dark' : 'light'))}
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

  // Selected work items (strictly 4 centerpiece projects, each appears once on the site)
  const selectedWork = [
    {
      id: 'layer',
      title: 'Layer',
      description:
        'An MCP server that uses Tree-sitter AST navigation to slash token overhead and improve agent accuracy in large codebases.',
      outcome:
        'Reduced token consumption by 87% in Ghidra codebase benchmarks; sub-15ms incremental syntax indexing.',
      tech: 'Rust / Tree-sitter / Model Context Protocol / Tokio / LLVM-IR',
      links: [
        { label: 'GitHub', url: 'https://github.com/junaidmirr/layer' },
      ],
      todoPlaceholder: {
        label: 'Screenshot or terminal recording of Layer AST traversal',
        aspectRatio: '16/9' as const,
        alt: 'Layer Tree-sitter AST symbol resolution demonstration',
      },
    },
    {
      id: 'doc-engine',
      title: 'doc-engine',
      description:
        'A high-performance headless document layout and vector rendering engine for React and TypeScript.',
      outcome:
        'Emits native vector PDF 1.7 paths and 60 FPS HTML5 Canvas previews with zero headless Chrome or Python daemons; published on npm as @worklabs05/doc-engine.',
      tech: 'TypeScript / React / PDF 1.7 Spec / HTML5 Canvas / npm package',
      links: [
        { label: 'Docs', url: 'https://docengine.worklabs.studio' },
        { label: 'GitHub', url: 'https://github.com/junaidmirr/doc-engine.git' },
      ],
      todoPlaceholder: {
        label: 'Vector PDF and canvas split-view screenshot',
        aspectRatio: '16/9' as const,
        alt: 'doc-engine vector rendering canvas and output comparison',
      },
    },
    {
      id: 'tauri-cli',
      title: 'Tauri Core CLI',
      description:
        'Official upstream CLI contribution to the Tauri desktop application framework.',
      outcome:
        'Merged in Tauri 2.12 (#15634) to enable automatic prompt skipping in non-interactive CI test runners.',
      tech: 'Rust / Cargo / Tauri CLI / CI Automation',
      links: [
        { label: 'Pull Request', url: 'https://github.com/tauri-apps/tauri/pull/15634' },
        { label: 'Repository', url: 'https://github.com/tauri-apps/tauri' },
      ],
      todoPlaceholder: {
        label: 'Terminal recording or merged pull request badge',
        aspectRatio: '16/9' as const,
        alt: 'Tauri Pull Request 15634 merged in official Tauri repository',
      },
    },
    {
      id: 'coolpath',
      title: 'CoolPath',
      description:
        'Intelligent urban heat-aware route planner combining thermal rasters, thermodynamic physiological modeling, and Gemini 2.0.',
      outcome:
        'Sub-millisecond spatial indexing using Shapely STRtree hierarchies; reduced pedestrian solar exposure by 32% in urban heat tests.',
      tech: 'Python / FastAPI / Shapely STRtree / React Native / Gemini 2.0 / FortyGuard API',
      links: [
        { label: 'GitHub', url: 'https://github.com/junaidmirr/coolpath_main' },
      ],
      todoPlaceholder: {
        label: 'Microclimate thermal route map overlay screenshot',
        aspectRatio: '16/9' as const,
        alt: 'CoolPath thermal route optimization map interface',
      },
    },
  ]

  // Other work items (compact table list)
  const otherWork = [
    {
      year: '2026',
      type: 'Web & AI',
      title: 'ResuMagic',
      description: 'AI resume builder with PDF generation and photo processing.',
      url: 'https://resumagic-ai-resume-builder.vercel.app',
    },
    {
      year: '2026',
      type: 'Android',
      title: 'Edugate',
      description: 'Virtual classroom app with Agora RTC video and foreground screen sharing.',
      url: 'https://github.com/junaidmirr/Edugate-a-smart-classroom-app.git',
    },
    {
      year: '2026',
      type: 'Android & AI',
      title: 'AI Credit & Inventory Manager',
      description: 'Small business inventory tracker with Gemini 2.0 product vision.',
      url: 'https://github.com/junaidmirr/Ai-integrated-credit-and-inventory-manager-app.git',
    },
    {
      year: '2026',
      type: 'Android & AI',
      title: 'On-Screen AI Assistant',
      description: 'Floating overlay assistant with screen capture and voice interaction.',
      url: 'https://github.com/junaidmirr/on-screen-Ai-assistant.git',
    },
  ]

  // Skills definition list
  const skillsList = [
    {
      category: 'Languages',
      items: 'Kotlin, TypeScript, Python, Rust',
    },
    {
      category: 'Mobile',
      items: 'Jetpack Compose, Coroutines & Flow, Android Jetpack & MVVM, Room Database, Foreground Services, CameraX, Agora RTC',
    },
    {
      category: 'Web',
      items: 'React 19, TypeScript, Tailwind CSS, Vite, HTML5 Canvas',
    },
    {
      category: 'Backend & AI',
      items: 'FastAPI, Node.js, Model Context Protocol (MCP), Tree-sitter AST, Google Gemini AI SDK, REST APIs',
    },
    {
      category: 'Tooling',
      items: 'Git & GitHub, Android Studio, Shapely & Spatial Indexing, PDF 1.7 Spec, Vercel',
    },
  ]

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
            Junaid Mir
          </a>

          {/* Links Right + Theme Toggle */}
          <div className="flex items-center gap-6">
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
              <a href="#contact" className="text-[var(--color-text-muted)] hover-accent-link">
                Contact
              </a>
            </nav>

            {/* Theme Toggle (minimal pill toggle) */}
            <button
              type="button"
              onClick={() => setTheme((curr) => (curr === 'light' ? 'dark' : 'light'))}
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              className="font-mono text-xs rounded-full border border-[var(--color-border)] px-2.5 py-1 text-[var(--color-text-subtle)] hover:text-[var(--color-text)] hover:border-[var(--color-border-hover)] cursor-pointer transition-colors"
            >
              {theme === 'light' ? 'Dark' : 'Light'}
            </button>

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
              <a
                href="#contact"
                onClick={() => setMobileMenuOpen(false)}
                className="text-[var(--color-text-muted)] hover-accent-link"
              >
                Contact
              </a>
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
            I build developer tools and mobile apps: a Rust MCP server for coding agents, a PDF engine in TypeScript, Android in Kotlin.
          </h1>

          <p className="text-base sm:text-lg text-[var(--color-text-muted)] leading-relaxed">
            Computer engineering student in Bangalore. Merged contributor to Tauri.
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
              href={`mailto:${portfolioData.profile.email || 'junaidmeer055@gmail.com'}`}
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
              01 / 04
            </span>
          </div>

          <div className="space-y-16 sm:space-y-20">
            {selectedWork.map((project, idx) => {
              const liveProject = portfolioData.projects.find(
                (p) =>
                  p.title.toLowerCase().includes(project.id) ||
                  (project.id === 'tauri-cli' && p.title.toLowerCase().includes('tauri'))
              )
              const projectImage = liveProject?.imageUrl || liveProject?.bannerUrl

              return (
                <article
                  key={project.id}
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

                    <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                      {project.outcome}
                    </p>

                    <div className="pt-2 font-mono text-xs text-[var(--color-text-subtle)] leading-relaxed">
                      {project.tech}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 pt-3 font-mono text-xs">
                      {project.links.map((link) => (
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
                  </div>

                  {/* Right Column: Visual Slot / Live Image or TODO Asset Placeholder */}
                  <div className="lg:col-span-6">
                    <TodoPlaceholder
                      src={projectImage}
                      label={project.todoPlaceholder.label}
                      aspectRatio={project.todoPlaceholder.aspectRatio}
                      alt={project.todoPlaceholder.alt}
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
            {otherWork.map((item) => (
              <div
                key={item.title}
                className="journal-row group py-4 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 sm:gap-6"
              >
                {/* Year / Type */}
                <div className="font-mono text-xs text-[var(--color-text-subtle)] w-32 shrink-0">
                  {item.year} · {item.type}
                </div>

                {/* Name & One-line Description */}
                <div className="flex-1 min-w-0">
                  <a
                    href={item.url}
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
                </div>

                {/* Plain Text Link */}
                <div className="font-mono text-xs shrink-0 sm:text-right">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="editorial-link"
                  >
                    Link [↗]
                  </a>
                </div>
              </div>
            ))}
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
              <p>
                I am a computer engineering student in Bangalore building developer tools and mobile software. My work focuses on systems where efficiency and precision matter: parsing abstract syntax trees to give AI coding agents surgical context without token bloat, designing headless vector engines for PDF 1.7 layout, and engineering native Android applications with Kotlin and Jetpack Compose.
              </p>
              <p>
                I contribute upstream to developer platforms including Tauri and maintain open source software. I value software that is fast, resilient, and honest about what it does.
              </p>

              {/* 3-Item Facts List */}
              <div className="pt-4 border-t border-[var(--color-border)] grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
                <div>
                  <span className="block text-[var(--color-text-subtle)] mb-1 uppercase tracking-wider">
                    Location
                  </span>
                  <span className="text-[var(--color-text)]">Bangalore, India</span>
                </div>
                <div>
                  <span className="block text-[var(--color-text-subtle)] mb-1 uppercase tracking-wider">
                    Focus
                  </span>
                  <span className="text-[var(--color-text)]">Developer Tools & Native Mobile</span>
                </div>
                <div>
                  <span className="block text-[var(--color-text-subtle)] mb-1 uppercase tracking-wider">
                    Exploring
                  </span>
                  <span className="text-[var(--color-text)]">AST Parsing & Local Agents</span>
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

        {/* 8. Contact: One Large Email Link, Copy Action, Socials */}
        <section id="contact" className="scroll-mt-16 space-y-6 pt-4 border-t border-[var(--color-border)]">
          <div className="max-w-[720px] space-y-4">
            <h2 className="font-mono text-xs uppercase tracking-wider text-[var(--color-text-subtle)] font-medium">
              Contact
            </h2>

            <div className="space-y-3">
              <a
                href={`mailto:${portfolioData.profile.email || 'junaidmeer055@gmail.com'}`}
                className="font-display text-xl sm:text-2xl md:text-3xl lg:text-4xl font-medium tracking-tight text-[var(--color-text)] hover:text-[var(--color-accent)] transition-colors block break-words"
              >
                Say hello — {portfolioData.profile.email || 'junaidmeer055@gmail.com'}
              </a>

              <div className="flex flex-wrap items-center gap-4 text-xs font-mono pt-1">
                <button
                  type="button"
                  onClick={copyEmail}
                  className="editorial-link cursor-pointer"
                >
                  {copiedEmail ? '[Copied to clipboard]' : '[Copy email address]'}
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
          <span>Junaid Mir · {new Date().getFullYear()}</span>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-[var(--color-text)] transition-colors">
              Top [↑]
            </a>
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
