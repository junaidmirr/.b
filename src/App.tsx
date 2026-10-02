import { useState, useEffect, useId, type FormEvent } from 'react'
import { TurnstileCaptcha } from './components/TurnstileCaptcha'
import { projects } from './projectsData'
import type { Theme, Project, SkillCategory } from './types'

const skillCategories: SkillCategory[] = [
  {
    title: 'Mobile Engineering',
    description: 'Native Android application development with modern architecture',
    skills: [
      'Kotlin',
      'Jetpack Compose',
      'Coroutines & Flow',
      'Android Jetpack & MVVM',
      'Room Database',
      'Foreground Services',
      'MediaProjection API',
      'CameraX',
      'Agora RTC SDK',
    ],
  },
  {
    title: 'Frontend Development',
    description: 'Accessible, responsive, and performance-focused web apps',
    skills: [
      'React 19',
      'TypeScript',
      'Tailwind CSS',
      'Vite',
      'HTML5 & Web APIs',
      'Component Architecture',
      'State Management',
    ],
  },
  {
    title: 'Backend & AI Systems',
    description: 'Server development, AI model integration, and cloud services',
    skills: [
      'Python & FastAPI',
      'Node.js & Flask',
      'Google Gemini AI SDK',
      'REST API Design',
      'Firebase Auth & Firestore',
      'Cloudflare Turnstile',
    ],
  },
  {
    title: 'Tooling & Data',
    description: 'Build tooling, spatial data, and deployment workflows',
    skills: [
      'Git & GitHub',
      'Android Studio',
      'Shapely & Spatial Indexing',
      'OpenCV & Pillow',
      'PDF 1.7 Spec & Vector Layout',
      'Vercel Deployment',
    ],
  },
]

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  const stored = window.localStorage.getItem('theme')
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
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

  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY
  const formId = useId()

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    window.localStorage.setItem('theme', theme)
  }, [theme])

  // Handle ESC for modals & mobile menu
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
    if (activeModalProject || contactModalOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [activeModalProject, contactModalOpen])

  const copyEmail = () => {
    navigator.clipboard.writeText('junaidmeer055@gmail.com')
    setCopiedEmail(true)
    setTimeout(() => setCopiedEmail(false), 2000)
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

  const ossCount = projects.filter((p) => p.category.toLowerCase().includes('open source') || p.title === 'doc-engine').length
  const androidCount = projects.filter(
    (p) =>
      p.category.toLowerCase().includes('android') ||
      p.stack.includes('Kotlin') ||
      p.stack.includes('Jetpack Compose')
  ).length
  const webCount = projects.filter(
    (p) =>
      p.title !== 'doc-engine' &&
      (p.category.toLowerCase().includes('web') ||
        p.category.toLowerCase().includes('full stack') ||
        p.category.toLowerCase().includes('ai &') ||
        p.stack.includes('React 19') ||
        p.stack.includes('Python') ||
        p.stack.includes('JavaScript'))
  ).length

  const filteredProjects = projects.filter((project) => {
    if (selectedFilter === 'oss') {
      return (
        project.title.toLowerCase().includes('doc-engine') ||
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
        (project.category.toLowerCase().includes('web') ||
          project.category.toLowerCase().includes('full stack') ||
          project.category.toLowerCase().includes('ai &') ||
          project.stack.includes('React 19') ||
          project.stack.includes('Python') ||
          project.stack.includes('JavaScript'))
      )
    }
    return true
  })

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] transition-colors duration-200">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-bg)]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <a href="#" className="group flex flex-col">
            <span className="text-base font-semibold tracking-tight text-[var(--color-text)]">
              Junaid
            </span>
            <span className="text-xs text-[var(--color-muted)]">
              Software Developer
            </span>
          </a>

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-6 text-sm md:flex">
            <a
              href="#open-source"
              className="text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)]"
            >
              Open Source
            </a>
            <a
              href="#projects"
              className="text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)]"
            >
              Projects
            </a>
            <a
              href="#skills"
              className="text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)]"
            >
              Skills
            </a>
            <a
              href="#about"
              className="text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)]"
            >
              About
            </a>
            <button
              type="button"
              onClick={() => setContactModalOpen(true)}
              className="text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)] cursor-pointer"
            >
              Contact
            </button>

            <button
              type="button"
              onClick={() => setTheme((curr) => (curr === 'light' ? 'dark' : 'light'))}
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              className="flex h-8 w-8 items-center justify-center rounded border border-[var(--color-border)] text-[var(--color-muted)] transition-colors hover:border-[var(--color-border-hover)] hover:text-[var(--color-text)] cursor-pointer"
            >
              {theme === 'light' ? (
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                  />
                </svg>
              ) : (
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              )}
            </button>
          </nav>

          {/* Mobile Right Controls: Theme + Hamburger Button */}
          <div className="flex items-center gap-2 md:hidden">
            <button
              type="button"
              onClick={() => setTheme((curr) => (curr === 'light' ? 'dark' : 'light'))}
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              className="flex h-8 w-8 items-center justify-center rounded border border-[var(--color-border)] text-[var(--color-muted)] transition-colors hover:border-[var(--color-border-hover)] hover:text-[var(--color-text)] cursor-pointer"
            >
              {theme === 'light' ? (
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                  />
                </svg>
              ) : (
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              )}
            </button>

            {/* Hamburger Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((curr) => !curr)}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
              className="flex h-8 w-8 items-center justify-center rounded border border-[var(--color-border)] text-[var(--color-text)] transition-colors hover:border-[var(--color-border-hover)] cursor-pointer"
            >
              {mobileMenuOpen ? (
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="border-t border-[var(--color-border)] bg-[var(--color-bg)] px-6 py-4 md:hidden">
            <nav className="flex flex-col gap-3 text-sm">
              <a
                href="#open-source"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)]"
              >
                Open Source
              </a>
              <a
                href="#projects"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)]"
              >
                Projects
              </a>
              <a
                href="#skills"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)]"
              >
                Skills
              </a>
              <a
                href="#about"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)]"
              >
                About
              </a>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false)
                  setContactModalOpen(true)
                }}
                className="py-1 text-left text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)] cursor-pointer"
              >
                Contact Form
              </button>
            </nav>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="mx-auto max-w-4xl px-6 py-12 md:py-16">
        {/* Hero Section */}
        <section className="mb-20">
          <div className="mb-4 inline-flex items-center gap-2 rounded border border-[var(--color-border)] bg-[var(--color-panel)] px-2.5 py-1 text-xs font-mono text-[var(--color-muted)]">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Available for new opportunities · Bangalore, India
          </div>

          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl text-[var(--color-text)]">
            Native Android and full-stack web developer.
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-relaxed text-[var(--color-muted)] sm:text-lg">
            I'm Junaid, a software engineer with 3+ years of experience building applications.
            Creator of <span className="font-medium text-[var(--color-text)]">doc-engine</span>, an open source vector PDF engine,
            and developer of production Android apps with Kotlin and Jetpack Compose.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4 text-sm">
            {/* Get in touch button with solid theme behavior */}
            <button
              type="button"
              onClick={() => setContactModalOpen(true)}
              className="btn-primary px-4 py-2 text-sm"
            >
              Get in touch
            </button>
            <a
              href="#projects"
              className="btn-secondary px-4 py-2 text-sm"
            >
              View projects
            </a>
            <div className="flex items-center gap-3 pl-1 text-xs font-mono text-[var(--color-muted)]">
              <a
                href="https://github.com/junaidmirr"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-4 hover:text-[var(--color-text)]"
              >
                GitHub ↗
              </a>
              <span>·</span>
              <a
                href="https://www.linkedin.com/in/junaidmeer055/"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-4 hover:text-[var(--color-text)]"
              >
                LinkedIn ↗
              </a>
              <span>·</span>
              <button
                type="button"
                onClick={copyEmail}
                className="underline underline-offset-4 hover:text-[var(--color-text)] cursor-pointer"
              >
                {copiedEmail ? 'Copied to clipboard' : 'junaidmeer055@gmail.com'}
              </button>
            </div>
          </div>
        </section>

        {/* Featured Open Source Project Showcase */}
        <section id="open-source" className="mb-20 scroll-mt-20">
          <div className="border-b border-[var(--color-border)] pb-4">
            <div className="flex items-center gap-2">
              <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs font-mono font-medium text-emerald-600 dark:text-emerald-400">
                Open Source
              </span>
              <span className="text-xs font-mono text-[var(--color-muted)]">Featured Project</span>
            </div>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-[var(--color-text)]">
              doc-engine — High Performance PDF Engine
            </h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              A headless document layout and vector rendering engine for React and TypeScript.
            </p>
          </div>

          <div className="mt-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-[var(--color-muted)]">
                  <span className="font-semibold text-[var(--color-text)]">@worklabs05/doc-engine</span>
                  <span>·</span>
                  <span>TypeScript & React</span>
                  <span>·</span>
                  <span>PDF 1.7 Spec</span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)] max-w-2xl">
                  Compiles React JSX components or serializable JSON AST directly to real, searchable vector PDFs
                  and 60 FPS HTML5 Canvas previews. Zero heavyweight Python daemons, zero Puppeteer headless browsers.
                  Emits native vector PDF 1.7 paths, text operators, and multi-page flows.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 text-xs font-mono sm:flex-col sm:items-end">
                <a
                  href="https://docengine.worklabs.studio"
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary px-3 py-1.5"
                >
                  docengine.worklabs.studio ↗
                </a>
                <a
                  href="https://github.com/junaidmirr/doc-engine.git"
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary px-3 py-1.5"
                >
                  GitHub Repository ↗
                </a>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-[var(--color-border)] pt-4 text-xs font-mono text-[var(--color-muted)]">
              <span className="text-[var(--color-text)] font-semibold">Install:</span>
              <code className="rounded bg-[var(--color-panel)] px-2 py-0.5 text-[var(--color-text)]">
                npm install @worklabs05/doc-engine pdf-lib
              </code>
            </div>
          </div>
        </section>

        {/* Selected Projects */}
        <section id="projects" className="mb-20 scroll-mt-20">
          <div className="flex flex-col justify-between gap-4 border-b border-[var(--color-border)] pb-4 sm:flex-row sm:items-end">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-[var(--color-text)]">
                Selected Projects
              </h2>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                Real-world Android, AI navigation, and full-stack systems built from concept to deployment.
              </p>
            </div>

            {/* Filter buttons */}
            <div className="flex items-center gap-1 text-xs">
              <button
                type="button"
                onClick={() => setSelectedFilter('all')}
                className={`rounded px-2.5 py-1 transition-colors cursor-pointer ${
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
                className={`rounded px-2.5 py-1 transition-colors cursor-pointer ${
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
                className={`rounded px-2.5 py-1 transition-colors cursor-pointer ${
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
                className={`rounded px-2.5 py-1 transition-colors cursor-pointer ${
                  selectedFilter === 'web'
                    ? 'filter-btn-active'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                Web & AI ({webCount})
              </button>
            </div>
          </div>

          <div className="mt-6 divide-y divide-[var(--color-border)] border-b border-[var(--color-border)]">
            {filteredProjects.map((project) => (
              <article key={project.title} className="py-8 group">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-baseline">
                  <div className="flex flex-wrap items-baseline gap-2.5">
                    <h3 className="text-lg font-semibold text-[var(--color-text)]">
                      {project.title}
                    </h3>
                    <span className="text-xs font-mono text-[var(--color-muted)]">
                      {project.category}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    {project.githubUrl && (
                      <a
                        href={project.githubUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-[var(--color-muted)] underline underline-offset-4 hover:text-[var(--color-text)]"
                      >
                        GitHub ↗
                      </a>
                    )}
                    {project.liveUrl && project.liveUrl !== '#' && (
                      <a
                        href={project.liveUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-[var(--color-muted)] underline underline-offset-4 hover:text-[var(--color-text)]"
                      >
                        {project.title === 'doc-engine' ? 'Documentation ↗' : 'Live Demo ↗'}
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => setActiveModalProject(project)}
                      className="inline-flex items-center gap-1 font-mono font-medium text-[var(--color-text)] underline underline-offset-4 hover:opacity-80 cursor-pointer"
                    >
                      Architecture & Details →
                    </button>
                  </div>
                </div>

                <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)] max-w-3xl">
                  {project.description}
                </p>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {project.stack.map((tech) => (
                    <span
                      key={tech}
                      className="rounded border border-[var(--color-border)] bg-[var(--color-panel)] px-2 py-0.5 text-xs font-mono text-[var(--color-muted)]"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Technical Skills & Architecture */}
        <section id="skills" className="mb-20 scroll-mt-20">
          <div className="border-b border-[var(--color-border)] pb-4">
            <h2 className="text-xl font-semibold tracking-tight text-[var(--color-text)]">
              Technical Skills & Tooling
            </h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Technologies and platforms I use to build robust software systems.
            </p>
          </div>

          <div className="mt-8 grid gap-8 sm:grid-cols-2">
            {skillCategories.map((group) => (
              <div
                key={group.title}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
              >
                <h3 className="text-sm font-semibold text-[var(--color-text)]">
                  {group.title}
                </h3>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  {group.description}
                </p>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {group.skills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded border border-[var(--color-border)] bg-[var(--color-panel)] px-2.5 py-1 text-xs font-mono text-[var(--color-text)]"
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
        <section id="about" className="mb-20 scroll-mt-20">
          <div className="border-b border-[var(--color-border)] pb-4">
            <h2 className="text-xl font-semibold tracking-tight text-[var(--color-text)]">
              About
            </h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Engineering background, principles, and workflow.
            </p>
          </div>

          <div className="mt-6 space-y-4 text-sm leading-relaxed text-[var(--color-muted)] max-w-3xl">
            <p>
              I am a software engineer focused on building clean, reliable applications. My work spans
              native Android engineering—leveraging Kotlin, Jetpack Compose, Room, and foreground services—to
              full-stack web development with React, TypeScript, and Python.
            </p>
            <p>
              I author open source software including <span className="text-[var(--color-text)] font-medium">doc-engine</span>,
              a high-performance headless PDF and layout engine that compiles React JSX and AST into vector PDF 1.7 streams without
              relying on headless browsers or server daemons.
            </p>
            <p>
              When engineering native Android applications, I prioritize reactive state management (Coroutines, Flow,
              StateFlow), clean separation of concerns via MVVM, and deep integration with device APIs such as
              MediaProjection for screen sharing, Agora SDK for RTC video conferencing, and Room for offline persistence.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-4 border-t border-[var(--color-border)] pt-6 sm:grid-cols-4 font-mono text-xs">
            <div>
              <span className="text-[var(--color-muted)] block">Location</span>
              <span className="font-medium text-[var(--color-text)]">Bangalore, India</span>
            </div>
            <div>
              <span className="text-[var(--color-muted)] block">Experience</span>
              <span className="font-medium text-[var(--color-text)]">3+ Years</span>
            </div>
            <div>
              <span className="text-[var(--color-muted)] block">Mobile Focus</span>
              <span className="font-medium text-[var(--color-text)]">Kotlin / Compose</span>
            </div>
            <div>
              <span className="text-[var(--color-muted)] block">Web & Systems</span>
              <span className="font-medium text-[var(--color-text)]">TS / React / Python</span>
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section id="contact" className="mb-16 scroll-mt-20">
          <div className="border-b border-[var(--color-border)] pb-4">
            <h2 className="text-xl font-semibold tracking-tight text-[var(--color-text)]">
              Contact
            </h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Reach out for contracts, full-time engineering roles, or collaboration.
            </p>
          </div>

          <div className="mt-8 flex flex-col justify-between gap-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:flex-row sm:items-center">
            <div className="space-y-4">
              <div>
                <span className="text-xs font-mono uppercase tracking-wider text-[var(--color-muted)]">
                  Direct Email
                </span>
                <div className="mt-1 flex items-center gap-3">
                  <a
                    href="mailto:junaidmeer055@gmail.com"
                    className="text-base font-medium text-[var(--color-text)] hover:underline"
                  >
                    junaidmeer055@gmail.com
                  </a>
                  <button
                    type="button"
                    onClick={copyEmail}
                    className="rounded border border-[var(--color-border)] bg-[var(--color-panel)] px-2 py-0.5 text-xs font-mono text-[var(--color-muted)] hover:text-[var(--color-text)] cursor-pointer"
                  >
                    {copiedEmail ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 text-xs font-mono text-[var(--color-muted)]">
                <a
                  href="https://github.com/junaidmirr"
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-4 hover:text-[var(--color-text)]"
                >
                  GitHub: github.com/junaidmirr ↗
                </a>
                <span>·</span>
                <a
                  href="https://www.linkedin.com/in/junaidmeer055/"
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-4 hover:text-[var(--color-text)]"
                >
                  LinkedIn: in/junaidmeer055 ↗
                </a>
                <span>·</span>
                <span>Bangalore, India (UTC+5:30)</span>
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={() => setContactModalOpen(true)}
                className="btn-primary px-5 py-2.5 text-sm"
              >
                Open Contact Form
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--color-border)] bg-[var(--color-surface)] py-8 text-xs font-mono text-[var(--color-muted)]">
        <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          <p>© {new Date().getFullYear()} Junaid. Minimal portfolio.</p>
          <div className="flex items-center gap-4">
            <a href="#open-source" className="hover:text-[var(--color-text)]">
              Open Source
            </a>
            <a href="#projects" className="hover:text-[var(--color-text)]">
              Projects
            </a>
            <a href="#skills" className="hover:text-[var(--color-text)]">
              Skills
            </a>
            <button
              type="button"
              onClick={() => setContactModalOpen(true)}
              className="hover:text-[var(--color-text)] cursor-pointer"
            >
              Contact
            </button>
            <a href="#" className="hover:text-[var(--color-text)]">
              Back to top ↑
            </a>
          </div>
        </div>
      </footer>

      {/* Contact Form Modal */}
      {contactModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="contact-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 sm:p-6 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) setContactModalOpen(false)
          }}
        >
          <div className="relative flex max-h-[92vh] w-full max-w-lg flex-col rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-6 shadow-xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-[var(--color-border)] pb-4">
              <div>
                <span className="text-xs font-mono uppercase tracking-wider text-[var(--color-muted)]">
                  Get in Touch
                </span>
                <h3 id="contact-modal-title" className="text-xl font-semibold text-[var(--color-text)]">
                  Send a Message
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setContactModalOpen(false)}
                aria-label="Close dialog"
                className="rounded border border-[var(--color-border)] p-1 text-[var(--color-muted)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-text)] cursor-pointer"
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
                  <label htmlFor={`${formId}-name`} className="block text-xs font-medium text-[var(--color-muted)]">
                    Your Name
                  </label>
                  <input
                    id={`${formId}-name`}
                    type="text"
                    name="name"
                    required
                    placeholder="e.g. Alex Smith"
                    className="mt-1.5 w-full rounded border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)]/60 focus:border-[var(--color-accent)] focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor={`${formId}-email`} className="block text-xs font-medium text-[var(--color-muted)]">
                    Email Address
                  </label>
                  <input
                    id={`${formId}-email`}
                    type="email"
                    name="email"
                    required
                    placeholder="name@example.com"
                    className="mt-1.5 w-full rounded border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)]/60 focus:border-[var(--color-accent)] focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor={`${formId}-message`} className="block text-xs font-medium text-[var(--color-muted)]">
                    Message
                  </label>
                  <textarea
                    id={`${formId}-message`}
                    name="message"
                    rows={4}
                    required
                    placeholder="Describe your project, role, or inquiry..."
                    className="mt-1.5 w-full resize-y rounded border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)]/60 focus:border-[var(--color-accent)] focus:outline-none"
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
                  <p className="rounded border border-emerald-500/20 bg-emerald-500/10 p-2.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    Message sent successfully. I will get back to you soon.
                  </p>
                ) : null}

                <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--color-border)]">
                  <button
                    type="button"
                    onClick={() => setContactModalOpen(false)}
                    className="rounded border border-[var(--color-border)] px-4 py-2 text-xs font-mono text-[var(--color-text)] hover:bg-[var(--color-panel)] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || messageSent || (Boolean(turnstileSiteKey) && !captchaToken)}
                    className="btn-primary px-4 py-2 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Sending...' : messageSent ? 'Sent' : 'Send Message'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Architecture & Case Study Modal */}
      {activeModalProject && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-project-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 sm:p-6 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveModalProject(null)
          }}
        >
          <div
            className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-6 shadow-xl overflow-hidden"
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-[var(--color-border)] pb-4">
              <div>
                <span className="text-xs font-mono text-[var(--color-muted)]">
                  {activeModalProject.category}
                </span>
                <h3 id="modal-project-title" className="text-xl font-semibold text-[var(--color-text)]">
                  {activeModalProject.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModalProject(null)}
                aria-label="Close dialog"
                className="rounded border border-[var(--color-border)] p-1 text-[var(--color-muted)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-text)] cursor-pointer"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto py-5 space-y-6 text-sm">
              <div>
                <h4 className="text-xs font-mono uppercase tracking-wider text-[var(--color-muted)]">
                  Overview
                </h4>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-text)]">
                  {activeModalProject.fullDescription}
                </p>
              </div>

              <div>
                <h4 className="text-xs font-mono uppercase tracking-wider text-[var(--color-muted)]">
                  Key Technical Features
                </h4>
                <ul className="mt-2 space-y-1.5 list-disc pl-4 text-sm text-[var(--color-muted)] marker:text-[var(--color-text)]">
                  {activeModalProject.features.map((feature) => (
                    <li key={feature} className="leading-relaxed">
                      <span className="text-[var(--color-text)]">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-xs font-mono uppercase tracking-wider text-[var(--color-muted)]">
                  Architecture & Technologies
                </h4>
                <div className="mt-2 divide-y divide-[var(--color-border)] rounded border border-[var(--color-border)] bg-[var(--color-panel)] text-xs">
                  {activeModalProject.technologies.map((tech) => (
                    <div key={tech.name} className="p-3">
                      <span className="font-semibold text-[var(--color-text)]">{tech.name}: </span>
                      <span className="text-[var(--color-muted)]">{tech.details}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-4 text-xs font-mono">
              <div className="flex items-center gap-3">
                {activeModalProject.githubUrl && (
                  <a
                    href={activeModalProject.githubUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-[var(--color-text)] underline underline-offset-4 hover:opacity-80"
                  >
                    GitHub Repository ↗
                  </a>
                )}
                {activeModalProject.liveUrl && activeModalProject.liveUrl !== '#' && (
                  <a
                    href={activeModalProject.liveUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-[var(--color-text)] underline underline-offset-4 hover:opacity-80"
                  >
                    {activeModalProject.title === 'doc-engine' ? 'Documentation & Workbench ↗' : 'Live Deployment ↗'}
                  </a>
                )}
              </div>

              <button
                type="button"
                onClick={() => setActiveModalProject(null)}
                className="rounded border border-[var(--color-border)] px-3 py-1 text-[var(--color-text)] hover:bg-[var(--color-panel)] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
