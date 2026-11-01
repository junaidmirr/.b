import { useState, useEffect, type FormEvent } from 'react'
import type { PortfolioData, Project, ProfileData } from '../types'
import { savePortfolioDataLocal } from '../portfolioDataManager'
import {
  savePortfolioToFirebase,
  testFirestoreConnection,
  loginWithFirebase,
  logoutFirebase,
  subscribeToAuth,
} from '../services/portfolioService'
import {
  isFirebaseConfigured,
  firebaseConfig,
  saveCustomFirebaseConfig,
  clearCustomFirebaseConfig,
  ensureFirebaseInitialized,
  type FirebaseConfig,
} from '../firebase'
import type { User } from 'firebase/auth'

type AdminTab = 'projects' | 'profile' | 'firebase' | 'backup'

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
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null)
  const [authMode, setAuthMode] = useState<'password' | 'firebase'>('password')
  const [passwordInput, setPasswordInput] = useState('')
  const [emailInput, setEmailInput] = useState('')
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
  const [isSeeding, setIsSeeding] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testFeedback, setTestFeedback] = useState<{ ok: boolean; message: string } | null>(null)
  const [saveStatus, setSaveStatus] = useState<{
    type: 'success' | 'error' | 'info' | null
    message: string
  }>({ type: null, message: '' })

  const isConfigured = isFirebaseConfigured()
  const [configDraft, setConfigDraft] = useState<FirebaseConfig>({ ...firebaseConfig })

  // Track Firebase Auth user
  useEffect(() => {
    ensureFirebaseInitialized().then((ready) => {
      if (ready) {
        setConfigDraft({ ...firebaseConfig })
      }
    })
    const unsub = subscribeToAuth((user) => {
      setFirebaseUser(user)
    })
    return () => unsub()
  }, [])

  // Sync token in sessionStorage
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
      if (authMode === 'firebase' && isConfigured) {
        if (!emailInput.trim() || !passwordInput.trim()) {
          throw new Error('Please enter both email and password.')
        }
        await loginWithFirebase(emailInput.trim(), passwordInput.trim())
        setAuthToken('firebase_session_' + Date.now())
        setPasswordInput('')
      } else {
        // Master password authentication
        const res = await fetch('/api/admin-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: passwordInput }),
        })

        const result = await res.json()
        if (!res.ok) {
          throw new Error(result.error || 'Invalid password.')
        }

        setAuthToken(result.token)
        setPasswordInput('')
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Authentication failed.')
    } finally {
      setIsAuthenticating(false)
    }
  }

  const handleLogout = async () => {
    setAuthToken('')
    sessionStorage.removeItem('junaid_admin_token')
    await logoutFirebase()
  }

  // Save changes to Firebase & local storage (zero redeploy required!)
  const handleSaveAll = async () => {
    setIsSaving(true)
    setSaveStatus({ type: null, message: '' })

    try {
      // 1. Instantly save to Firebase Firestore
      const res = await savePortfolioToFirebase(data)
      onDataUpdated(data)

      // 2. Also inform serverless backup if token exists
      if (authToken && !authToken.startsWith('firebase_session_')) {
        fetch('/api/admin-save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(data),
        }).catch(() => {})
      }

      setSaveStatus({
        type: 'success',
        message: res.message,
      })
    } catch (err) {
      setSaveStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'An error occurred while saving to Firebase.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  // 1-Click seed current data to Firestore
  const handleSeedFirebase = async () => {
    setIsSeeding(true)
    setSaveStatus({ type: null, message: '' })
    try {
      await savePortfolioToFirebase(data)
      setSaveStatus({
        type: 'success',
        message: `Successfully synchronized all ${data.projects.length} projects and profile data to Firebase Firestore!`,
      })
    } catch (err) {
      setSaveStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to sync data to Firebase.',
      })
    } finally {
      setIsSeeding(false)
    }
  }

  const handleTestConnection = async () => {
    setIsTesting(true)
    setTestFeedback(null)
    const result = await testFirestoreConnection()
    setTestFeedback(result)
    setIsTesting(false)
  }

  const handleSaveFirebaseConfig = () => {
    if (!configDraft.apiKey.trim() || !configDraft.projectId.trim()) {
      alert('API Key and Project ID are required.')
      return
    }
    const ok = saveCustomFirebaseConfig(configDraft)
    if (ok) {
      setTestFeedback({
        ok: true,
        message: 'Firebase configuration saved locally and initialized successfully! Testing connection...',
      })
      handleTestConnection()
    } else {
      setTestFeedback({
        ok: false,
        message: 'Failed to initialize Firebase with provided credentials. Please double check values.',
      })
    }
  }

  const handleResetFirebaseConfig = () => {
    clearCustomFirebaseConfig()
    setConfigDraft({ ...firebaseConfig })
    setTestFeedback(null)
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

  const isAuthenticated = Boolean(authToken || firebaseUser)

  // --- Render Authentication Prompt if not logged in ---
  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-bg)]/90 p-4 backdrop-blur-md">
        <div className="w-full max-w-md border border-[var(--color-border)] bg-[var(--color-panel)] p-8">
          <div className="mb-6 flex items-center justify-between border-b border-[var(--color-border)] pb-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-[var(--color-text)]">
                Admin Authentication
              </h2>
              <p className="mt-1 text-xs font-mono text-[var(--color-muted)]">
                {isConfigured ? 'Firebase Cloud Connected' : 'Local / Master Password Mode'}
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

          {/* Mode Switcher */}
          {isConfigured && (
            <div className="mb-4 flex border border-[var(--color-border)] text-xs font-mono">
              <button
                type="button"
                onClick={() => setAuthMode('password')}
                className={`flex-1 py-1.5 transition-colors cursor-pointer ${
                  authMode === 'password'
                    ? 'bg-[var(--color-text)] text-[var(--color-bg)] font-semibold'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                Master Password
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('firebase')}
                className={`flex-1 py-1.5 transition-colors cursor-pointer ${
                  authMode === 'firebase'
                    ? 'bg-[var(--color-text)] text-[var(--color-bg)] font-semibold'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                Firebase Auth
              </button>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {authMode === 'firebase' && isConfigured && (
              <div>
                <label
                  htmlFor="admin-email"
                  className="block text-xs font-mono text-[var(--color-muted)] mb-1.5"
                >
                  Firebase Admin Email
                </label>
                <input
                  id="admin-email"
                  type="email"
                  required
                  placeholder="admin@example.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-muted)] focus:border-[var(--color-border-hover)] focus:outline-none font-mono"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="admin-password"
                className="block text-xs font-mono text-[var(--color-muted)] mb-1.5"
              >
                {authMode === 'firebase' ? 'Firebase Password' : 'Master Password'}
              </label>
              <input
                id="admin-password"
                type="password"
                required
                autoFocus
                placeholder="Enter password..."
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
                className="btn-primary w-full py-2 text-xs font-mono tracking-wide cursor-pointer"
              >
                {isAuthenticating ? 'Verifying...' : 'Unlock Portal'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary w-full py-2 text-xs font-mono tracking-wide cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>

          <p className="mt-6 text-[11px] font-mono text-[var(--color-muted)] border-t border-[var(--color-border)] pt-4 leading-relaxed">
            Instant updates with Firebase Cloud Firestore. Zero redeployment needed.
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
          <div className="flex items-center gap-4 flex-wrap">
            <span className="font-mono text-sm font-semibold tracking-tight text-[var(--color-text)]">
              /iam_admin
            </span>
            <div className="flex items-center gap-2">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  isConfigured ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
              <span className="text-xs font-mono text-[var(--color-muted)]">
                {isConfigured
                  ? `Firebase Firestore Live (${firebaseConfig.projectId || 'Connected'})`
                  : 'Firebase Pending Config (Local Mode)'}
              </span>
            </div>
            {firebaseUser && (
              <span className="text-[11px] font-mono text-emerald-500 border border-emerald-500/30 px-2 py-0.5 rounded">
                User: {firebaseUser.email}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isSaving}
              className="btn-primary px-4 py-1.5 text-xs font-mono cursor-pointer"
            >
              {isSaving ? 'Saving to Firebase...' : 'Save to Firebase'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary px-3 py-1.5 text-xs font-mono cursor-pointer"
            >
              Exit to Portfolio
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="border border-[var(--color-border)] px-3 py-1.5 text-xs font-mono text-[var(--color-muted)] hover:text-red-400 hover:border-red-500/40 cursor-pointer"
            >
              Log Out
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mx-auto flex max-w-6xl border-t border-[var(--color-border)] px-6 text-xs font-mono overflow-x-auto">
          <button
            type="button"
            onClick={() => {
              setCurrentTab('projects')
              cancelProjectEdit()
            }}
            className={`border-b-2 px-4 py-3 cursor-pointer transition-colors whitespace-nowrap ${
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
            className={`border-b-2 px-4 py-3 cursor-pointer transition-colors whitespace-nowrap ${
              currentTab === 'profile'
                ? 'border-[var(--color-text)] text-[var(--color-text)] font-semibold'
                : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            Profile & Social Links
          </button>
          <button
            type="button"
            onClick={() => setCurrentTab('firebase')}
            className={`border-b-2 px-4 py-3 cursor-pointer transition-colors whitespace-nowrap ${
              currentTab === 'firebase'
                ? 'border-[var(--color-text)] text-[var(--color-text)] font-semibold'
                : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            Firebase Cloud Sync
          </button>
          <button
            type="button"
            onClick={() => setCurrentTab('backup')}
            className={`border-b-2 px-4 py-3 cursor-pointer transition-colors whitespace-nowrap ${
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
                      className="btn-primary px-3 py-1.5 text-xs font-mono cursor-pointer"
                    >
                      Apply To In Memory List
                    </button>
                    <button
                      type="button"
                      onClick={cancelProjectEdit}
                      className="btn-secondary px-3 py-1.5 text-xs font-mono cursor-pointer"
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
                          className="px-2 py-1 text-xs font-mono text-red-400 hover:text-red-300 border border-[var(--color-border)] cursor-pointer"
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
                          className="col-span-1 px-1 py-1 text-xs font-mono text-red-400 hover:text-red-300 border border-[var(--color-border)] cursor-pointer"
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
                    className="btn-secondary px-4 py-2 text-xs font-mono cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={commitProjectDraft}
                    className="btn-primary px-5 py-2 text-xs font-mono cursor-pointer"
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
                      Manage order, content, and links. Changes persist directly to Firebase with zero redeployment.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={startAddNewProject}
                    className="btn-primary px-4 py-2 text-xs font-mono cursor-pointer"
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
                          className="px-2 py-1 text-xs font-mono border border-[var(--color-border)] disabled:opacity-30 hover:border-[var(--color-border-hover)] cursor-pointer"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => moveProject(idx, 'down')}
                          disabled={idx === data.projects.length - 1}
                          title="Move down"
                          className="px-2 py-1 text-xs font-mono border border-[var(--color-border)] disabled:opacity-30 hover:border-[var(--color-border-hover)] cursor-pointer"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => startEditProject(idx)}
                          className="btn-secondary px-3 py-1 text-xs font-mono cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteProject(idx)}
                          className="px-3 py-1 text-xs font-mono text-red-400 hover:text-red-300 border border-[var(--color-border)] cursor-pointer"
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
                className="btn-primary px-5 py-2 text-xs font-mono cursor-pointer"
              >
                {isSaving ? 'Saving to Firebase...' : 'Save to Firebase'}
              </button>
            </div>
          </div>
        )}

        {/* ================= TAB 3: FIREBASE CLOUD SYNC ================= */}
        {currentTab === 'firebase' && (
          <div className="border border-[var(--color-border)] bg-[var(--color-panel)] p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-4">
              <div>
                <h3 className="text-base font-semibold text-[var(--color-text)]">
                  Firebase Cloud Connection
                </h3>
                <p className="text-xs font-mono text-[var(--color-muted)] mt-1">
                  Real-time database integration: instant live updates without Git commits or Vercel rebuilds.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${
                    isConfigured ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                />
                <span className="text-xs font-mono font-medium">
                  {isConfigured ? 'Connected' : 'Configuration Required'}
                </span>
              </div>
            </div>

            {/* Connection Test & Quick Sync Actions */}
            <div className="space-y-4">
              <div className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-semibold text-[var(--color-text)]">
                    Live Connection Test
                  </h4>
                  <p className="text-xs text-[var(--color-muted)] mt-1 leading-relaxed">
                    Verify that your credentials and Firestore security rules allow active read and write operations.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="btn-secondary px-4 py-2 text-xs font-mono shrink-0 cursor-pointer disabled:opacity-40"
                >
                  {isTesting ? 'Testing...' : 'Test Connection'}
                </button>
              </div>

              {testFeedback && (
                <div
                  className={`p-3.5 text-xs font-mono border leading-relaxed ${
                    testFeedback.ok
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                      : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                  }`}
                >
                  <strong>{testFeedback.ok ? '✓ Status:' : '⚠ Warning:'}</strong> {testFeedback.message}
                </div>
              )}

              <div className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-semibold text-[var(--color-text)]">
                    Synchronize Current Data to Firestore
                  </h4>
                  <p className="text-xs text-[var(--color-muted)] mt-1 leading-relaxed">
                    Upload all current {data.projects.length} projects, categories, and profile details to your Firebase database in a single click.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSeedFirebase}
                  disabled={isSeeding || !isConfigured}
                  className="btn-primary px-4 py-2 text-xs font-mono shrink-0 cursor-pointer disabled:opacity-40"
                >
                  {isSeeding ? 'Syncing...' : 'Sync to Firestore Now'}
                </button>
              </div>
            </div>

            {/* Direct In-Browser Firebase Config Setup */}
            <div className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--color-border)] pb-3">
                <div>
                  <h4 className="text-sm font-semibold text-[var(--color-text)]">
                    Direct Firebase Configuration (Instant Setup)
                  </h4>
                  <p className="text-xs text-[var(--color-muted)] mt-0.5">
                    Paste your Firebase credentials here to connect immediately without waiting for redeploys.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetFirebaseConfig}
                    className="border border-[var(--color-border)] px-2.5 py-1 text-[11px] font-mono text-[var(--color-muted)] hover:text-[var(--color-text)] cursor-pointer"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveFirebaseConfig}
                    className="btn-primary px-3.5 py-1 text-xs font-mono cursor-pointer"
                  >
                    Save & Connect Now
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs font-mono">
                <div>
                  <label className="block text-[11px] text-[var(--color-muted)] mb-1">
                    apiKey *
                  </label>
                  <input
                    type="text"
                    placeholder="AIzaSy..."
                    value={configDraft.apiKey}
                    onChange={(e) => setConfigDraft({ ...configDraft, apiKey: e.target.value.trim() })}
                    className="w-full border border-[var(--color-border)] bg-[var(--color-panel)] px-2.5 py-1.5 text-xs text-[var(--color-text)] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-[var(--color-muted)] mb-1">
                    projectId *
                  </label>
                  <input
                    type="text"
                    placeholder="your-project-id"
                    value={configDraft.projectId}
                    onChange={(e) => setConfigDraft({ ...configDraft, projectId: e.target.value.trim() })}
                    className="w-full border border-[var(--color-border)] bg-[var(--color-panel)] px-2.5 py-1.5 text-xs text-[var(--color-text)] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-[var(--color-muted)] mb-1">
                    authDomain
                  </label>
                  <input
                    type="text"
                    placeholder="your-project-id.firebaseapp.com"
                    value={configDraft.authDomain}
                    onChange={(e) => setConfigDraft({ ...configDraft, authDomain: e.target.value.trim() })}
                    className="w-full border border-[var(--color-border)] bg-[var(--color-panel)] px-2.5 py-1.5 text-xs text-[var(--color-text)] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-[var(--color-muted)] mb-1">
                    storageBucket
                  </label>
                  <input
                    type="text"
                    placeholder="your-project-id.firebasestorage.app"
                    value={configDraft.storageBucket}
                    onChange={(e) => setConfigDraft({ ...configDraft, storageBucket: e.target.value.trim() })}
                    className="w-full border border-[var(--color-border)] bg-[var(--color-panel)] px-2.5 py-1.5 text-xs text-[var(--color-text)] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-[var(--color-muted)] mb-1">
                    messagingSenderId
                  </label>
                  <input
                    type="text"
                    placeholder="123456789012"
                    value={configDraft.messagingSenderId}
                    onChange={(e) => setConfigDraft({ ...configDraft, messagingSenderId: e.target.value.trim() })}
                    className="w-full border border-[var(--color-border)] bg-[var(--color-panel)] px-2.5 py-1.5 text-xs text-[var(--color-text)] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-[var(--color-muted)] mb-1">
                    appId
                  </label>
                  <input
                    type="text"
                    placeholder="1:123456789012:web:abcdef"
                    value={configDraft.appId}
                    onChange={(e) => setConfigDraft({ ...configDraft, appId: e.target.value.trim() })}
                    className="w-full border border-[var(--color-border)] bg-[var(--color-panel)] px-2.5 py-1.5 text-xs text-[var(--color-text)] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Environment Variables Status */}
            <div>
              <h4 className="text-xs font-mono uppercase tracking-wider text-[var(--color-muted)] mb-3">
                Firebase Environment Configuration
              </h4>
              <div className="space-y-2 font-mono text-xs">
                {[
                  { key: 'VITE_FIREBASE_API_KEY', val: firebaseConfig.apiKey },
                  { key: 'VITE_FIREBASE_AUTH_DOMAIN', val: firebaseConfig.authDomain },
                  { key: 'VITE_FIREBASE_PROJECT_ID', val: firebaseConfig.projectId },
                  { key: 'VITE_FIREBASE_STORAGE_BUCKET', val: firebaseConfig.storageBucket },
                  { key: 'VITE_FIREBASE_MESSAGING_SENDER_ID', val: firebaseConfig.messagingSenderId },
                  { key: 'VITE_FIREBASE_APP_ID', val: firebaseConfig.appId },
                ].map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between border border-[var(--color-border)] bg-[var(--color-bg)] p-2.5"
                  >
                    <span className="text-[var(--color-text)]">{item.key}</span>
                    <span
                      className={`text-[11px] ${
                        item.val ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      {item.val ? '✓ Set' : '✗ Missing in .env'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommended Firestore Security Rules */}
            <div>
              <h4 className="text-xs font-mono uppercase tracking-wider text-[var(--color-muted)] mb-2">
                Recommended Firestore Security Rules
              </h4>
              <p className="text-xs text-[var(--color-muted)] mb-2">
                Paste these rules in your Firebase Console under <strong>Firestore Database → Rules</strong>:
              </p>
              <pre className="overflow-auto border border-[var(--color-border)] bg-[var(--color-bg)] p-4 text-xs font-mono text-[var(--color-text)] leading-relaxed">
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /portfolio/{document} {
      // Anyone can read portfolio projects and profile info
      allow read: if true;
      // Only authenticated admin can update
      allow write: if request.auth != null;
    }
  }
}`}
              </pre>
            </div>
          </div>
        )}

        {/* ================= TAB 4: RAW JSON & BACKUP ================= */}
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
                  className="btn-secondary px-3 py-1.5 text-xs font-mono cursor-pointer"
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
                  className="btn-primary px-3 py-1.5 text-xs font-mono cursor-pointer"
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
