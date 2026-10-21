import { useState, useEffect, type FormEvent } from 'react'
import type { PortfolioData, Project, ProfileData } from '../types'
import { savePortfolioDataLocal } from '../portfolioDataManager'

type AdminTab = 'projects' | 'profile' | 'categories' | 'backup'

type AdminPageProps = {
  initialData: PortfolioData
  onClose: () => void
  onDataUpdated: (newData: PortfolioData) => void
}

const DEFAULT_NEW_PROJECT: Project = {
  title: '',
  category: 'Full Stack Web',
  description: '',
  icon: 'code',
  stack: ['TypeScript', 'React'],
  linkLabel: 'View case study',
  fullDescription: '',
  features: [''],
  githubUrl: '',
  liveUrl: '',
  technologies: [{ name: '', details: '' }],
}

const SUGGESTED_CATEGORIES = [
  'Featured Open Source, Vector PDF Engine',
  'Open Source Contribution',
  'AI Microclimate Navigation Engine',
  'Virtual Classroom App',
  'Full Stack AI App',
  'FinTech AI App',
  'Android AI Assistant',
  'Web Media Tool',
  'Mobile Engineering',
  'Full Stack Web',
  'System Architecture',
]

const AVAILABLE_ICONS = ['code', 'globe', 'rocket', 'spark', 'briefcase', 'layout', 'shield']

export function AdminPage({ initialData, onClose, onDataUpdated }: AdminPageProps) {
  // Authentication states
  const [authToken, setAuthToken] = useState<string>(() => {
    return sessionStorage.getItem('junaid_admin_token') || ''
  })
  const [passwordInput, setPasswordInput] = useState('')
  const [authError, setAuthError] = useState('')
  const [isAuthenticating, setIsAuthenticating] = useState(false)

  // Active Tab
  const [currentTab, setCurrentTab] = useState<AdminTab>('projects')

  // Portfolio Data under edit
  const [data, setData] = useState<PortfolioData>(initialData)
  const [editingProjectIndex, setEditingProjectIndex] = useState<number | null>(null)
  const [activeProjectDraft, setActiveProjectDraft] = useState<Project | null>(null)
  const [isNewProject, setIsNewProject] = useState(false)

  // Save states
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<{
    type: 'success' | 'error' | 'info' | null
    message: string
  }>({ type: null, message: '' })

  // Verify stored token on mount
  useEffect(() => {
    if (authToken) {
      sessionStorage.setItem('junaid_admin_token', authToken)
    } else {
      sessionStorage.removeItem('junaid_admin_token')
    }
  }, [authToken])

  // Login handler
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    setAuthError('')
    setIsAuthenticating(true)

    try {
      const res = await fetch('/api/admin-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput }),
      })

      const result = await res.json()
      if (!res.ok) {
        throw new Error(result.error || 'Authentication failed.')
      }

      setAuthToken(result.token)
      setPasswordInput('')
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Invalid password.')
    } finally {
      setIsAuthenticating(false)
    }
  }

  const handleLogout = () => {
    setAuthToken('')
    sessionStorage.removeItem('junaid_admin_token')
  }

  // Save changes to backend & local storage
  const handleSaveAll = async () => {
    setIsSaving(true)
    setSaveStatus({ type: null, message: '' })

    try {
      // 1. Instantly persist to local storage for immediate preview
      savePortfolioDataLocal(data)
      onDataUpdated(data)

      // 2. Transmit to secure backend API
      const res = await fetch('/api/admin-save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(data),
      })

      const result = await res.json()
      if (!res.ok) {
        throw new Error(result.error || 'Failed to save changes to server.')
      }

      setSaveStatus({
        type: 'success',
        message: result.message || 'Changes saved successfully.',
      })
    } catch (err) {
      setSaveStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'An error occurred while saving.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Profile fields helper
  const updateProfileField = <K extends keyof ProfileData>(field: K, value: ProfileData[K]) => {
    setData((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        [field]: value,
      },
    }))
  }

  // Project Editor Helpers
  const startAddNewProject = () => {
    setActiveProjectDraft({ ...DEFAULT_NEW_PROJECT })
    setIsNewProject(true)
    setEditingProjectIndex(null)
  }

  const startEditProject = (index: number) => {
    setActiveProjectDraft({ ...data.projects[index] })
    setIsNewProject(false)
    setEditingProjectIndex(index)
  }

  const cancelProjectEdit = () => {
    setActiveProjectDraft(null)
    setIsNewProject(false)
    setEditingProjectIndex(null)
  }

  const commitProjectDraft = () => {
    if (!activeProjectDraft) return
    if (!activeProjectDraft.title.trim()) {
      alert('Project title is required.')
      return
    }

    const updatedProjects = [...data.projects]
    if (isNewProject) {
      updatedProjects.unshift(activeProjectDraft)
    } else if (editingProjectIndex !== null) {
      updatedProjects[editingProjectIndex] = activeProjectDraft
    }

    const updatedData = { ...data, projects: updatedProjects }
    setData(updatedData)
    savePortfolioDataLocal(updatedData)
    onDataUpdated(updatedData)
    cancelProjectEdit()
  }

  const deleteProject = (index: number) => {
    const proj = data.projects[index]
    if (!confirm(`Are you sure you want to delete "${proj.title}"?`)) return
    const updatedProjects = data.projects.filter((_, i) => i !== index)
    const updatedData = { ...data, projects: updatedProjects }
    setData(updatedData)
    savePortfolioDataLocal(updatedData)
    onDataUpdated(updatedData)
    if (editingProjectIndex === index) {
      cancelProjectEdit()
    }
  }

  const moveProject = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= data.projects.length) return
    const updated = [...data.projects]
    const temp = updated[index]
    updated[index] = updated[targetIndex]
    updated[targetIndex] = temp
    const updatedData = { ...data, projects: updated }
    setData(updatedData)
    savePortfolioDataLocal(updatedData)
    onDataUpdated(updatedData)
  }

  // --- Render Authentication Prompt if not logged in ---
  if (!authToken) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-bg)]/90 p-4 backdrop-blur-md">
        <div className="w-full max-w-md border border-[var(--color-border)] bg-[var(--color-panel)] p-8">
          <div className="mb-6 flex items-center justify-between border-b border-[var(--color-border)] pb-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-[var(--color-text)]">
                Admin Authentication
              </h2>
              <p className="mt-1 text-xs font-mono text-[var(--color-muted)]">
                Protected portfolio management portal
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-mono text-[var(--color-muted)] hover:text-[var(--color-text)] cursor-pointer"
            >
              Close [ESC]
            </button>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="admin-password"
                className="block text-xs font-mono text-[var(--color-muted)] mb-1.5"
              >
                Master Password
              </label>
              <input
                id="admin-password"
                type="password"
                required
                autoFocus
                placeholder="Enter admin password..."
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-muted)] focus:border-[var(--color-border-hover)] focus:outline-none font-mono"
              />
            </div>

            {authError && (
              <div className="border border-red-500/40 bg-red-500/10 p-2.5 text-xs text-red-400 font-mono">
                {authError}
              </div>
            )}

            <div className="pt-2 flex items-center gap-3">
              <button
                type="submit"
                disabled={isAuthenticating}
                className="btn-primary w-full py-2 text-xs font-mono tracking-wide"
              >
                {isAuthenticating ? 'Verifying...' : 'Unlock Portal'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary w-full py-2 text-xs font-mono tracking-wide"
              >
                Cancel
              </button>
            </div>
          </form>

          <p className="mt-6 text-[11px] font-mono text-[var(--color-muted)] border-t border-[var(--color-border)] pt-4 leading-relaxed">
            Note: Set <span className="text-[var(--color-text)]">ADMIN_PASSWORD</span> in your Vercel
            environment variables for production security.
          </p>
        </div>
      </div>
    )
  }

  // --- Render Authenticated Admin Dashboard ---
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[var(--color-bg)] text-[var(--color-text)]">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-bg)]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <span className="font-mono text-sm font-semibold tracking-tight text-[var(--color-text)]">
              /iam_admin
            </span>
            <span className="text-xs text-[var(--color-muted)] font-mono">
              Database Free Git Automation
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isSaving}
              className="btn-primary px-4 py-1.5 text-xs font-mono"
            >
              {isSaving ? 'Deploying...' : 'Save & Deploy'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary px-3 py-1.5 text-xs font-mono"
            >
              Exit to Portfolio
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="border border-[var(--color-border)] px-3 py-1.5 text-xs font-mono text-[var(--color-muted)] hover:text-red-400 hover:border-red-500/40"
            >
              Log Out
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mx-auto flex max-w-6xl border-t border-[var(--color-border)] px-6 text-xs font-mono">
          <button
            type="button"
            onClick={() => {
              setCurrentTab('projects')
              cancelProjectEdit()
            }}
            className={`border-b-2 px-4 py-3 cursor-pointer transition-colors ${
              currentTab === 'projects'
                ? 'border-[var(--color-text)] text-[var(--color-text)] font-semibold'
                : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            Projects ({data.projects.length})
          </button>
          <button
            type="button"
            onClick={() => setCurrentTab('profile')}
            className={`border-b-2 px-4 py-3 cursor-pointer transition-colors ${
              currentTab === 'profile'
                ? 'border-[var(--color-text)] text-[var(--color-text)] font-semibold'
                : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            Profile & Social Links
          </button>
          <button
            type="button"
            onClick={() => setCurrentTab('backup')}
            className={`border-b-2 px-4 py-3 cursor-pointer transition-colors ${
              currentTab === 'backup'
                ? 'border-[var(--color-text)] text-[var(--color-text)] font-semibold'
                : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            Raw JSON & Backup
          </button>
        </div>
      </header>

      {/* Status banner */}
      {saveStatus.message && (
        <div className="mx-auto max-w-6xl px-6 pt-4">
          <div
            className={`p-3 text-xs font-mono border ${
              saveStatus.type === 'success'
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : 'border-red-500/40 bg-red-500/10 text-red-300'
            }`}
          >
            {saveStatus.message}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="mx-auto max-w-6xl p-6">
        {/* ================= TAB 1: PROJECTS ================= */}
        {currentTab === 'projects' && (
          <div>
            {activeProjectDraft ? (
              // Project Editor Form
              <div className="border border-[var(--color-border)] bg-[var(--color-panel)] p-6 space-y-6">
                <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-4">
                  <h3 className="text-base font-semibold text-[var(--color-text)]">
                    {isNewProject ? 'Add New Project' : `Edit: ${activeProjectDraft.title}`}
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={commitProjectDraft}
                      className="btn-primary px-3 py-1.5 text-xs font-mono"
                    >
                      Apply To In Memory List
                    </button>
                    <button
                      type="button"
                      onClick={cancelProjectEdit}
                      className="btn-secondary px-3 py-1.5 text-xs font-mono"
                    >
                      Cancel
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {/* Title */}
                  <div>
                    <label className="block text-xs font-mono text-[var(--color-muted)] mb-1">
                      Project Title *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. doc engine"
                      value={activeProjectDraft.title}
                      onChange={(e) =>
                        setActiveProjectDraft({ ...activeProjectDraft, title: e.target.value })
                      }
                      className="w-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none"
                    />
                  </div>

                  {/* Category Selector */}
                  <div>
                    <label className="block text-xs font-mono text-[var(--color-muted)] mb-1">
                      Category Selector *
                    </label>
                    <div className="space-y-2">
                      <select
                        value={activeProjectDraft.category}
                        onChange={(e) =>
                          setActiveProjectDraft({ ...activeProjectDraft, category: e.target.value })
                        }
                        className="w-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none"
                      >
                        {SUGGESTED_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                        <option value="custom">Custom category...</option>
                      </select>
                      <input
                        type="text"
                        placeholder="Or type a custom category title..."
                        value={activeProjectDraft.category}
                        onChange={(e) =>
                          setActiveProjectDraft({ ...activeProjectDraft, category: e.target.value })
                        }
                        className="w-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-xs text-[var(--color-text)] focus:outline-none font-mono"
                      />
                    </div>
                  </div>

                  {/* Short Description */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-mono text-[var(--color-muted)] mb-1">
                      Short Description (Card view) *
                    </label>
                    <textarea
                      rows={2}
                      placeholder="A short summary of what this project does..."
                      value={activeProjectDraft.description}
                      onChange={(e) =>
                        setActiveProjectDraft({
                          ...activeProjectDraft,
                          description: e.target.value,
                        })
                      }
                      className="w-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none"
                    />
                  </div>

                  {/* Full Description / Deep Dive */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-mono text-[var(--color-muted)] mb-1">
                      Detailed Overview (Modal Case Study)
                    </label>
                    <textarea
                      rows={4}
                      placeholder="Comprehensive technical breakdown, challenges, and implementation details..."
                      value={activeProjectDraft.fullDescription}
                      onChange={(e) =>
                        setActiveProjectDraft({
                          ...activeProjectDraft,
                          fullDescription: e.target.value,
                        })
                      }
                      className="w-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none leading-relaxed"
                    />
                  </div>

                  {/* Tech Stack Tags */}
                  <div>
                    <label className="block text-xs font-mono text-[var(--color-muted)] mb-1">
                      Tech Stack Tags (Comma separated)
                    </label>
                    <input
                      type="text"
                      placeholder="TypeScript, React, Kotlin, Gemini"
                      value={activeProjectDraft.stack.join(', ')}
                      onChange={(e) =>
                        setActiveProjectDraft({
                          ...activeProjectDraft,
                          stack: e.target.value
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                      className="w-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] font-mono focus:outline-none"
                    />
                  </div>

                  {/* Link Label */}
                  <div>
                    <label className="block text-xs font-mono text-[var(--color-muted)] mb-1">
                      Modal Link Button Label
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. View case study"
                      value={activeProjectDraft.linkLabel}
                      onChange={(e) =>
                        setActiveProjectDraft({ ...activeProjectDraft, linkLabel: e.target.value })
                      }
                      className="w-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none"
                    />
                  </div>

                  {/* GitHub URL */}
                  <div>
                    <label className="block text-xs font-mono text-[var(--color-muted)] mb-1">
                      GitHub Repository URL
                    </label>
                    <input
                      type="url"
                      placeholder="https://github.com/..."
                      value={activeProjectDraft.githubUrl || ''}
                      onChange={(e) =>
                        setActiveProjectDraft({ ...activeProjectDraft, githubUrl: e.target.value })
                      }
                      className="w-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] font-mono focus:outline-none"
                    />
                  </div>

                  {/* Live URL */}
                  <div>
                    <label className="block text-xs font-mono text-[var(--color-muted)] mb-1">
                      Live Project / Demo URL
                    </label>
                    <input
                      type="text"
                      placeholder="https://... or #"
                      value={activeProjectDraft.liveUrl || ''}
                      onChange={(e) =>
                        setActiveProjectDraft({ ...activeProjectDraft, liveUrl: e.target.value })
                      }
                      className="w-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] font-mono focus:outline-none"
                    />
                  </div>

                  {/* Icon Selector */}
                  <div>
                    <label className="block text-xs font-mono text-[var(--color-muted)] mb-1">
                      Icon Identifier
                    </label>
                    <select
                      value={activeProjectDraft.icon || 'code'}
                      onChange={(e) =>
                        setActiveProjectDraft({ ...activeProjectDraft, icon: e.target.value })
                      }
                      className="w-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none font-mono"
                    >
                      {AVAILABLE_ICONS.map((ic) => (
                        <option key={ic} value={ic}>
                          {ic}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Key Features Bullet List */}
                <div className="border-t border-[var(--color-border)] pt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-xs font-mono text-[var(--color-muted)]">
                      Key Highlights & Features
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveProjectDraft({
                          ...activeProjectDraft,
                          features: [...activeProjectDraft.features, ''],
                        })
                      }
                      className="text-xs font-mono text-[var(--color-text)] underline cursor-pointer"
                    >
                      + Add Feature
                    </button>
                  </div>
                  <div className="space-y-2">
                    {activeProjectDraft.features.map((feat, fi) => (
                      <div key={fi} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={feat}
                          placeholder={`Feature highlight ${fi + 1}`}
                          onChange={(e) => {
                            const updated = [...activeProjectDraft.features]
                            updated[fi] = e.target.value
                            setActiveProjectDraft({ ...activeProjectDraft, features: updated })
                          }}
                          className="w-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-xs text-[var(--color-text)] focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const updated = activeProjectDraft.features.filter((_, i) => i !== fi)
                            setActiveProjectDraft({ ...activeProjectDraft, features: updated })
                          }}
                          className="px-2 py-1 text-xs font-mono text-red-400 hover:text-red-300 border border-[var(--color-border)]"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Technologies List */}
                <div className="border-t border-[var(--color-border)] pt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-xs font-mono text-[var(--color-muted)]">
                      Architecture & Technologies Breakdown
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveProjectDraft({
                          ...activeProjectDraft,
                          technologies: [
                            ...activeProjectDraft.technologies,
                            { name: '', details: '' },
                          ],
                        })
                      }
                      className="text-xs font-mono text-[var(--color-text)] underline cursor-pointer"
                    >
                      + Add Technology
                    </button>
                  </div>
                  <div className="space-y-2">
                    {activeProjectDraft.technologies.map((tech, ti) => (
                      <div key={ti} className="grid grid-cols-12 gap-2">
                        <input
                          type="text"
                          value={tech.name}
                          placeholder="Category / Layer name"
                          onChange={(e) => {
                            const updated = [...activeProjectDraft.technologies]
                            updated[ti] = { ...updated[ti], name: e.target.value }
                            setActiveProjectDraft({ ...activeProjectDraft, technologies: updated })
                          }}
                          className="col-span-4 border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-xs text-[var(--color-text)] focus:outline-none font-mono"
                        />
                        <input
                          type="text"
                          value={tech.details}
                          placeholder="Technical details, libraries, protocols"
                          onChange={(e) => {
                            const updated = [...activeProjectDraft.technologies]
                            updated[ti] = { ...updated[ti], details: e.target.value }
                            setActiveProjectDraft({ ...activeProjectDraft, technologies: updated })
                          }}
                          className="col-span-7 border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-xs text-[var(--color-text)] focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const updated = activeProjectDraft.technologies.filter(
                              (_, i) => i !== ti
                            )
                            setActiveProjectDraft({
                              ...activeProjectDraft,
                              technologies: updated,
                            })
                          }}
                          className="col-span-1 px-1 py-1 text-xs font-mono text-red-400 hover:text-red-300 border border-[var(--color-border)]"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-[var(--color-border)] pt-4">
                  <button
                    type="button"
                    onClick={cancelProjectEdit}
                    className="btn-secondary px-4 py-2 text-xs font-mono"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={commitProjectDraft}
                    className="btn-primary px-5 py-2 text-xs font-mono"
                  >
                    Apply To Project List
                  </button>
                </div>
              </div>
            ) : (
              // Project List View
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-[var(--color-text)]">
                      Current Projects ({data.projects.length})
                    </h3>
                    <p className="text-xs font-mono text-[var(--color-muted)] mt-1">
                      Manage order, content, and links. Changes persist when you click Save & Deploy.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={startAddNewProject}
                    className="btn-primary px-4 py-2 text-xs font-mono"
                  >
                    + Add New Project
                  </button>
                </div>

                <div className="space-y-3">
                  {data.projects.map((project, idx) => (
                    <div
                      key={project.title + idx}
                      className="flex flex-col sm:flex-row sm:items-center justify-between border border-[var(--color-border)] bg-[var(--color-panel)] p-4 gap-4"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-[var(--color-text)]">
                            {project.title}
                          </span>
                          <span className="border border-[var(--color-border)] px-2 py-0.5 text-[11px] font-mono text-[var(--color-muted)]">
                            {project.category}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--color-muted)] line-clamp-1">
                          {project.description}
                        </p>
                        <div className="flex flex-wrap gap-1 text-[11px] font-mono text-[var(--color-muted)]">
                          {project.stack.slice(0, 4).map((tech) => (
                            <span key={tech}>#{tech}</span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <button
                          type="button"
                          onClick={() => moveProject(idx, 'up')}
                          disabled={idx === 0}
                          title="Move up"
                          className="px-2 py-1 text-xs font-mono border border-[var(--color-border)] disabled:opacity-30 hover:border-[var(--color-border-hover)]"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => moveProject(idx, 'down')}
                          disabled={idx === data.projects.length - 1}
                          title="Move down"
                          className="px-2 py-1 text-xs font-mono border border-[var(--color-border)] disabled:opacity-30 hover:border-[var(--color-border-hover)]"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => startEditProject(idx)}
                          className="btn-secondary px-3 py-1 text-xs font-mono"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteProject(idx)}
                          className="px-3 py-1 text-xs font-mono text-red-400 hover:text-red-300 border border-[var(--color-border)]"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 2: PROFILE & SOCIALS ================= */}
        {currentTab === 'profile' && (
          <div className="border border-[var(--color-border)] bg-[var(--color-panel)] p-6 space-y-6">
            <div>
              <h3 className="text-base font-semibold text-[var(--color-text)]">
                Profile & Social Links
              </h3>
              <p className="text-xs font-mono text-[var(--color-muted)] mt-1">
                Update your identity, hero statements, bio, and public social URLs.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <label className="block text-xs font-mono text-[var(--color-muted)] mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={data.profile.name}
                  onChange={(e) => updateProfileField('name', e.target.value)}
                  className="w-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-[var(--color-muted)] mb-1">
                  Professional Title / Role
                </label>
                <input
                  type="text"
                  value={data.profile.role}
                  onChange={(e) => updateProfileField('role', e.target.value)}
                  className="w-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-[var(--color-muted)] mb-1">
                  Primary Email
                </label>
                <input
                  type="email"
                  value={data.profile.email}
                  onChange={(e) => updateProfileField('email', e.target.value)}
                  className="w-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-[var(--color-muted)] mb-1">
                  Location / Timezone
                </label>
                <input
                  type="text"
                  value={data.profile.location}
                  onChange={(e) => updateProfileField('location', e.target.value)}
                  className="w-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-[var(--color-muted)] mb-1">
                  GitHub Profile URL
                </label>
                <input
                  type="url"
                  value={data.profile.github}
                  onChange={(e) => updateProfileField('github', e.target.value)}
                  className="w-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-[var(--color-muted)] mb-1">
                  LinkedIn Profile URL
                </label>
                <input
                  type="url"
                  value={data.profile.linkedin}
                  onChange={(e) => updateProfileField('linkedin', e.target.value)}
                  className="w-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] font-mono focus:outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-mono text-[var(--color-muted)] mb-1">
                  Headline (Hero Title)
                </label>
                <textarea
                  rows={2}
                  value={data.profile.headline}
                  onChange={(e) => updateProfileField('headline', e.target.value)}
                  className="w-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none leading-relaxed"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-mono text-[var(--color-muted)] mb-1">
                  Bio (Hero Subtitle / Description)
                </label>
                <textarea
                  rows={3}
                  value={data.profile.bio}
                  onChange={(e) => updateProfileField('bio', e.target.value)}
                  className="w-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none leading-relaxed"
                />
              </div>
            </div>

            <div className="flex items-center justify-end border-t border-[var(--color-border)] pt-4">
              <button
                type="button"
                onClick={handleSaveAll}
                disabled={isSaving}
                className="btn-primary px-5 py-2 text-xs font-mono"
              >
                {isSaving ? 'Deploying...' : 'Save & Deploy Changes'}
              </button>
            </div>
          </div>
        )}

        {/* ================= TAB 3: RAW JSON & BACKUP ================= */}
        {currentTab === 'backup' && (
          <div className="border border-[var(--color-border)] bg-[var(--color-panel)] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-[var(--color-text)]">
                  Raw JSON Configuration
                </h3>
                <p className="text-xs font-mono text-[var(--color-muted)] mt-1">
                  Direct snapshot of your portfolio data structure. Download or copy anytime for offline backups.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
                    alert('Configuration copied to clipboard!')
                  }}
                  className="btn-secondary px-3 py-1.5 text-xs font-mono"
                >
                  Copy JSON
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(data, null, 2)], {
                      type: 'application/json',
                    })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = 'portfolioData.json'
                    a.click()
                    URL.revokeObjectURL(url)
                  }}
                  className="btn-primary px-3 py-1.5 text-xs font-mono"
                >
                  Download .json
                </button>
              </div>
            </div>

            <pre className="max-h-96 overflow-auto border border-[var(--color-border)] bg-[var(--color-bg)] p-4 text-xs font-mono text-[var(--color-text)] leading-relaxed">
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        )}
      </main>
    </div>
  )
}
