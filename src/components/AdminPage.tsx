import { useState, useEffect, type FormEvent } from 'react'
import type { PortfolioData, Project, ProfileData, ChatSession, Essay, EssayComment } from '../types'
import { savePortfolioDataLocal } from '../portfolioDataManager'
import {
  savePortfolioToFirebase,
  testFirestoreConnection,
  loginWithFirebase,
  logoutFirebase,
  subscribeToAuth,
} from '../services/portfolioService'
import { subscribeToChatSessions, deleteChatSession } from '../services/chatLogService'
import { generateProjectFromGithub } from '../services/aiAutofillService'
import {
  fetchEssayInteractions,
  deleteEssayComment,
  type EssayInteractionsMap,
} from '../services/essayService'
import { renderEssayMarkdown } from './EssaysSection'
import {
  isFirebaseConfigured,
  firebaseConfig,
  saveCustomFirebaseConfig,
  clearCustomFirebaseConfig,
  ensureFirebaseInitialized,
  type FirebaseConfig,
} from '../firebase'
import type { User } from 'firebase/auth'

type AdminTab = 'projects' | 'essays' | 'profile' | 'chats' | 'firebase' | 'backup'

type AdminPageProps = {
  initialData: PortfolioData
  onClose: () => void
  onDataUpdated: (newData: PortfolioData) => void
}

const DEFAULT_NEW_ESSAY: Essay = {
  id: '',
  title: '',
  slug: '',
  date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
  readingTime: '5 min read',
  category: 'System Architecture',
  excerpt: '',
  content: '',
  coverImage: '',
  externalLink: '',
  externalLinkLabel: '',
}

const SUGGESTED_ESSAY_CATEGORIES = [
  'System Architecture',
  'Geospatial Systems',
  'Compiler & Parser Design',
  'Android Internals',
  'AI & LLM Systems',
  'Performance Engineering',
]

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

const POPULAR_STACK_SUGGESTIONS = [
  'Kotlin',
  'Jetpack Compose',
  'Coroutines & Flow',
  'TypeScript',
  'React 19',
  'Tailwind CSS',
  'Vite',
  'Rust',
  'Python',
  'FastAPI',
  'Google Gemini 2.0',
  'HTML5 Canvas 2D',
  'Cloud Firestore',
  'Firebase Auth',
  'Shapely STRtree',
  'OpenStreetMap',
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

  // Navigation & Data
  const [currentTab, setCurrentTab] = useState<AdminTab>('projects')
  const [data, setData] = useState<PortfolioData>(initialData)
  const [editingProjectIndex, setEditingProjectIndex] = useState<number | null>(null)
  const [activeProjectDraft, setActiveProjectDraft] = useState<Project | null>(null)
  const [isNewProject, setIsNewProject] = useState(false)
  const [projectSearchQuery, setProjectSearchQuery] = useState('')
  const [previewMarkdown, setPreviewMarkdown] = useState(false)
  const [tagInput, setTagInput] = useState('')

  // Swirl AI Autofill states
  const [aiRepoUrl, setAiRepoUrl] = useState('')
  const [aiCustomInstructions, setAiCustomInstructions] = useState('')
  const [isGeneratingAi, setIsGeneratingAi] = useState(false)
  const [aiStatusMessage, setAiStatusMessage] = useState('')
  const [aiError, setAiError] = useState('')
  const [showAiImportModal, setShowAiImportModal] = useState(false)

  // Save & Sync states
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testFeedback, setTestFeedback] = useState<{ ok: boolean; message: string } | null>(null)
  const [saveStatus, setSaveStatus] = useState<{
    type: 'success' | 'error' | 'info' | null
    message: string
  }>({ type: null, message: '' })

  // AI Chat Sessions State
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([])
  const [selectedChatSessionId, setSelectedChatSessionId] = useState<string | null>(null)
  const [isDeletingChat, setIsDeletingChat] = useState(false)
  const [chatSearchQuery, setChatSearchQuery] = useState('')

  // Essays Management State
  const [editingEssayIndex, setEditingEssayIndex] = useState<number | null>(null)
  const [activeEssayDraft, setActiveEssayDraft] = useState<Essay | null>(null)
  const [isNewEssay, setIsNewEssay] = useState(false)
  const [essaySearchQuery, setEssaySearchQuery] = useState('')
  const [previewEssayMarkdown, setPreviewEssayMarkdown] = useState(false)
  const [essayInteractions, setEssayInteractions] = useState<EssayInteractionsMap>({})
  const [isLoadingInteractions, setIsLoadingInteractions] = useState(false)
  const [commentFilterEssayId, setCommentFilterEssayId] = useState<string>('all')
  const [isDeletingCommentId, setIsDeletingCommentId] = useState<string | null>(null)

  const isConfigured = isFirebaseConfigured()
  const [configDraft, setConfigDraft] = useState<FirebaseConfig>({ ...firebaseConfig })

  // Subscribe to live chat sessions
  useEffect(() => {
    const unsub = subscribeToChatSessions((sessions) => {
      setChatSessions(sessions)
      setSelectedChatSessionId((prev) => {
        if (prev && sessions.some((s) => s.id === prev)) return prev
        return sessions.length > 0 ? sessions[0].id : null
      })
    })
    return () => unsub()
  }, [firebaseUser, authToken])

  // Auto-refresh chats when switching to chats tab and every 10 seconds while viewing
  useEffect(() => {
    if (currentTab !== 'chats') return
    handleRefreshChats()
    const interval = setInterval(() => {
      handleRefreshChats()
    }, 10000)
    return () => clearInterval(interval)
  }, [currentTab])

  // Fetch real-time essay interactions when on essays tab
  const loadInteractions = async () => {
    setIsLoadingInteractions(true)
    try {
      const map = await fetchEssayInteractions()
      setEssayInteractions(map)
    } finally {
      setIsLoadingInteractions(false)
    }
  }

  useEffect(() => {
    if (currentTab === 'essays') {
      loadInteractions()
    }
  }, [currentTab])

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

  // ESC to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isGeneratingAi) {
        if (activeProjectDraft) {
          cancelProjectEdit()
        } else if (showAiImportModal) {
          setShowAiImportModal(false)
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeProjectDraft, showAiImportModal, isGeneratingAi])

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
      const res = await savePortfolioToFirebase(data)
      onDataUpdated(data)

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
    setAiRepoUrl('')
    setAiStatusMessage('')
    setAiError('')
  }

  const startEditProject = (index: number) => {
    const proj = data.projects[index]
    setActiveProjectDraft({ ...proj })
    setIsNewProject(false)
    setEditingProjectIndex(index)
    setAiRepoUrl(proj.githubUrl || '')
    setAiStatusMessage('')
    setAiError('')
  }

  const cancelProjectEdit = () => {
    setActiveProjectDraft(null)
    setIsNewProject(false)
    setEditingProjectIndex(null)
    setAiStatusMessage('')
    setAiError('')
  }

  const commitProjectDraft = () => {
    if (!activeProjectDraft) return
    if (!activeProjectDraft.title.trim()) {
      alert('Project title is required.')
      return
    }

    let updatedProjects: Project[]
    if (isNewProject || editingProjectIndex === null) {
      updatedProjects = [activeProjectDraft, ...data.projects]
    } else {
      updatedProjects = data.projects.map((p, idx) =>
        idx === editingProjectIndex ? activeProjectDraft : p
      )
    }

    const updatedData = { ...data, projects: updatedProjects }
    setData(updatedData)
    savePortfolioDataLocal(updatedData)
    onDataUpdated(updatedData)
    cancelProjectEdit()
    setSaveStatus({
      type: 'info',
      message: `Project "${activeProjectDraft.title}" updated in working memory. Click "Save to Firebase" to sync changes to the cloud.`,
    })
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

  // --- Essays & Perspectives Handlers ---
  const startNewEssay = () => {
    const newId = `essay-${Date.now()}`
    setActiveEssayDraft({
      ...DEFAULT_NEW_ESSAY,
      id: newId,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    })
    setIsNewEssay(true)
    setEditingEssayIndex(null)
    setPreviewEssayMarkdown(false)
  }

  const startEditEssay = (index: number) => {
    const target = data.essays?.[index]
    if (!target) return
    setActiveEssayDraft({ ...target })
    setEditingEssayIndex(index)
    setIsNewEssay(false)
    setPreviewEssayMarkdown(false)
  }

  const cancelEssayEdit = () => {
    setActiveEssayDraft(null)
    setEditingEssayIndex(null)
    setIsNewEssay(false)
    setPreviewEssayMarkdown(false)
  }

  const commitEssayDraft = () => {
    if (!activeEssayDraft) return
    if (!activeEssayDraft.title.trim()) {
      alert('Essay title is required.')
      return
    }

    const currentEssays = data.essays || []
    const autoSlug =
      activeEssayDraft.slug.trim() ||
      activeEssayDraft.title
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')

    const finalDraft: Essay = {
      ...activeEssayDraft,
      slug: autoSlug,
    }

    let updatedEssays: Essay[]
    if (isNewEssay || editingEssayIndex === null) {
      updatedEssays = [finalDraft, ...currentEssays]
    } else {
      updatedEssays = currentEssays.map((e, idx) =>
        idx === editingEssayIndex ? finalDraft : e
      )
    }

    const updatedData = { ...data, essays: updatedEssays }
    setData(updatedData)
    savePortfolioDataLocal(updatedData)
    onDataUpdated(updatedData)
    cancelEssayEdit()
    setSaveStatus({
      type: 'info',
      message: `Essay "${finalDraft.title}" updated in working memory. Click "Save to Firebase" to sync changes to the cloud.`,
    })
  }

  const deleteEssay = (index: number) => {
    const essay = data.essays?.[index]
    if (!essay) return
    if (!confirm(`Are you sure you want to delete essay "${essay.title}"?`)) return
    const updatedEssays = (data.essays || []).filter((_, i) => i !== index)
    const updatedData = { ...data, essays: updatedEssays }
    setData(updatedData)
    savePortfolioDataLocal(updatedData)
    onDataUpdated(updatedData)
    if (editingEssayIndex === index) {
      cancelEssayEdit()
    }
  }

  const moveEssay = (index: number, direction: 'up' | 'down') => {
    const list = [...(data.essays || [])]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= list.length) return
    const [moved] = list.splice(index, 1)
    list.splice(targetIndex, 0, moved)
    const updatedData = { ...data, essays: list }
    setData(updatedData)
    savePortfolioDataLocal(updatedData)
    onDataUpdated(updatedData)
  }

  const handleDeleteComment = async (essayId: string, commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return
    setIsDeletingCommentId(commentId)
    try {
      const ok = await deleteEssayComment(essayId, commentId)
      if (ok) {
        await loadInteractions()
      } else {
        alert('Could not delete comment.')
      }
    } finally {
      setIsDeletingCommentId(null)
    }
  }

  // --- Swirl AI Autofill Handler ---
  const handleAiAutofill = async (targetRepoUrl?: string) => {
    const url = (targetRepoUrl || aiRepoUrl || activeProjectDraft?.githubUrl || '').trim()
    if (!url) {
      setAiError('Please enter a valid GitHub repository URL (e.g. https://github.com/owner/repo).')
      return
    }

    setIsGeneratingAi(true)
    setAiError('')
    setAiStatusMessage('Connecting to GitHub repository and fetching README...')

    try {
      const result = await generateProjectFromGithub(url, aiCustomInstructions)
      setAiStatusMessage('Swirl AI analyzed architecture! Populating project fields...')

      const gen = result.project

      if (showAiImportModal || !activeProjectDraft) {
        // Direct import as a new project draft
        setActiveProjectDraft(gen)
        setIsNewProject(true)
        setEditingProjectIndex(null)
        setShowAiImportModal(false)
      } else {
        // Populate into existing project draft
        setActiveProjectDraft((prev) => {
          const base = prev || { ...DEFAULT_NEW_PROJECT }
          return {
            ...base,
            title: gen.title || base.title,
            category: gen.category || base.category,
            description: gen.description || base.description,
            fullDescription: gen.fullDescription || base.fullDescription,
            stack: Array.isArray(gen.stack) && gen.stack.length > 0 ? gen.stack : base.stack,
            features: Array.isArray(gen.features) && gen.features.length > 0 ? gen.features : base.features,
            technologies:
              Array.isArray(gen.technologies) && gen.technologies.length > 0
                ? gen.technologies
                : base.technologies,
            githubUrl: gen.githubUrl || url,
            liveUrl: gen.liveUrl || base.liveUrl || '',
            icon: gen.icon || base.icon || 'code',
            linkLabel: gen.linkLabel || base.linkLabel || 'View case study',
          }
        })
      }

      setAiStatusMessage('✨ Successfully generated from README with Swirl AI!')
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Failed to generate project details.')
    } finally {
      setIsGeneratingAi(false)
    }
  }

  // Tag helper
  const handleAddTag = (tagToAdd?: string) => {
    const tag = (tagToAdd || tagInput).trim()
    if (!tag || !activeProjectDraft) return
    if (!activeProjectDraft.stack.includes(tag)) {
      setActiveProjectDraft({
        ...activeProjectDraft,
        stack: [...activeProjectDraft.stack, tag],
      })
    }
    setTagInput('')
  }

  const handleRemoveTag = (tagToRemove: string) => {
    if (!activeProjectDraft) return
    setActiveProjectDraft({
      ...activeProjectDraft,
      stack: activeProjectDraft.stack.filter((t) => t !== tagToRemove),
    })
  }

  // Feature bullet helper
  const handleAddFeature = () => {
    if (!activeProjectDraft) return
    setActiveProjectDraft({
      ...activeProjectDraft,
      features: [...activeProjectDraft.features, ''],
    })
  }

  const handleUpdateFeature = (index: number, val: string) => {
    if (!activeProjectDraft) return
    const updated = [...activeProjectDraft.features]
    updated[index] = val
    setActiveProjectDraft({ ...activeProjectDraft, features: updated })
  }

  const handleRemoveFeature = (index: number) => {
    if (!activeProjectDraft) return
    setActiveProjectDraft({
      ...activeProjectDraft,
      features: activeProjectDraft.features.filter((_, i) => i !== index),
    })
  }

  // Technology architecture helper
  const handleAddTech = () => {
    if (!activeProjectDraft) return
    setActiveProjectDraft({
      ...activeProjectDraft,
      technologies: [...activeProjectDraft.technologies, { name: '', details: '' }],
    })
  }

  const handleUpdateTech = (index: number, field: 'name' | 'details', val: string) => {
    if (!activeProjectDraft) return
    const updated = [...activeProjectDraft.technologies]
    updated[index] = { ...updated[index], [field]: val }
    setActiveProjectDraft({ ...activeProjectDraft, technologies: updated })
  }

  const handleRemoveTech = (index: number) => {
    if (!activeProjectDraft) return
    setActiveProjectDraft({
      ...activeProjectDraft,
      technologies: activeProjectDraft.technologies.filter((_, i) => i !== index),
    })
  }

  // Chat Session Delete
  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this chat session log?')) return
    setIsDeletingChat(true)
    try {
      await deleteChatSession(sessionId)
      setChatSessions((prev) => prev.filter((s) => s.id !== sessionId))
      if (selectedChatSessionId === sessionId) {
        const remaining = chatSessions.filter((s) => s.id !== sessionId)
        setSelectedChatSessionId(remaining.length > 0 ? remaining[0].id : null)
      }
    } catch (err) {
      alert(`Could not delete session: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setIsDeletingChat(false)
    }
  }

  const handleRefreshChats = async () => {
    try {
      const res = await fetch('/api/save-chat-session')
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data.sessions)) {
          setChatSessions((prev) => {
            const map = new Map<string, ChatSession>()
            for (const s of [...prev, ...data.sessions]) {
              if (s && s.id) map.set(s.id, s)
            }
            return Array.from(map.values()).sort(
              (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
            )
          })
        }
      }
    } catch {}
  }

  // Filtered projects
  const filteredProjects = data.projects.filter((p) => {
    if (!projectSearchQuery.trim()) return true
    const q = projectSearchQuery.toLowerCase()
    return (
      p.title.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.stack.some((s) => s.toLowerCase().includes(q))
    )
  })

  // Filtered chat sessions
  const filteredChatSessions = chatSessions.filter((s) => {
    if (!chatSearchQuery.trim()) return true
    const q = chatSearchQuery.toLowerCase()
    return (
      (s.summary && s.summary.toLowerCase().includes(q)) ||
      s.id.toLowerCase().includes(q) ||
      (s.messages && s.messages.some((m) => m.content.toLowerCase().includes(q)))
    )
  })

  const isAuthenticated = Boolean(authToken || firebaseUser)

  // --- Render Authentication Prompt if not logged in ---
  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-bg)]/95 p-4 backdrop-blur-md">
        <div className="w-full max-w-md border border-[var(--color-border)] bg-[var(--color-panel)] p-6 md:p-8 shadow-2xl rounded-lg">
          <div className="mb-6 flex items-center justify-between border-b border-[var(--color-border)] pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <h2 className="text-base font-mono font-semibold tracking-tight text-[var(--color-text)]">
                  Admin Console
                </h2>
              </div>
              <p className="mt-1 text-xs font-mono text-[var(--color-muted)]">
                {isConfigured ? 'Firebase Cloud Connected' : 'Local / Master Password Mode'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-mono text-[var(--color-muted)] hover:text-[var(--color-text)] cursor-pointer p-1"
            >
              ✕ Close
            </button>
          </div>

          {isConfigured && (
            <div className="mb-4 flex border border-[var(--color-border)] text-xs font-mono rounded overflow-hidden">
              <button
                type="button"
                onClick={() => setAuthMode('password')}
                className={`flex-1 py-2 transition-colors cursor-pointer ${
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
                className={`flex-1 py-2 transition-colors cursor-pointer ${
                  authMode === 'firebase'
                    ? 'bg-[var(--color-text)] text-[var(--color-bg)] font-semibold'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                Firebase Auth
              </button>
            </div>
          )}

          {authError && (
            <div className="mb-4 border border-red-500/30 bg-red-500/10 p-3 text-xs font-mono text-red-400 rounded">
              {authError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4 font-mono text-xs">
            {authMode === 'firebase' && isConfigured && (
              <div>
                <label className="block text-[var(--color-muted)] mb-1">Admin Email</label>
                <input
                  type="email"
                  required
                  autoFocus
                  placeholder="admin@domain.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[var(--color-text)] focus:border-[var(--color-border-hover)] focus:outline-none rounded"
                />
              </div>
            )}

            <div>
              <label className="block text-[var(--color-muted)] mb-1">
                {authMode === 'firebase' ? 'Firebase Password' : 'Master Password'}
              </label>
              <input
                type="password"
                required
                autoFocus={authMode === 'password'}
                placeholder="Enter password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[var(--color-text)] focus:border-[var(--color-border-hover)] focus:outline-none rounded"
              />
            </div>

            <button
              type="submit"
              disabled={isAuthenticating}
              className="btn-primary w-full py-2.5 font-mono text-xs cursor-pointer disabled:opacity-50"
            >
              {isAuthenticating ? 'Authenticating...' : 'Unlock Console →'}
            </button>
          </form>

          <p className="mt-4 text-center text-[11px] font-mono text-[var(--color-muted)]">
            Changes save to Firebase Firestore and sync to visitors instantly with zero redeploy.
          </p>
        </div>
      </div>
    )
  }

  // --- Main Admin Portal Layout ---
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--color-bg)] text-[var(--color-text)] overflow-hidden font-sans">
      {/* Top Header Command Bar */}
      <header className="border-b border-[var(--color-border)] bg-[var(--color-panel)] px-4 sm:px-6 py-3 flex-shrink-0">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          {/* Left: Branding & Status */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
              <span className="font-mono text-xs font-semibold tracking-tight text-[var(--color-text)] truncate">
                Junaid Admin Portal
              </span>
            </div>
            <span className="hidden md:inline-block h-3 w-px bg-[var(--color-border)]" />
            <span className="hidden md:inline-flex items-center gap-1.5 font-mono text-[11px] text-[var(--color-muted)]">
              {isConfigured ? (
                <span className="text-emerald-500 font-medium">● Firestore Live</span>
              ) : (
                <span className="text-amber-500 font-medium">○ Local Browser Cache</span>
              )}
            </span>
            {firebaseUser && (
              <span className="hidden lg:inline-block font-mono text-[10px] text-[var(--color-muted)] truncate max-w-[180px]">
                {firebaseUser.email}
              </span>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isSaving}
              className="btn-primary px-3 sm:px-4 py-1.5 text-xs font-mono cursor-pointer flex items-center gap-1.5 shadow-sm"
              title="Save all changes to Firebase Firestore"
            >
              {isSaving ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-white animate-spin" />
                  <span>Syncing...</span>
                </>
              ) : (
                <>
                  <span>☁ Save to Firebase</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="btn-secondary px-3 py-1.5 text-xs font-mono cursor-pointer"
              title="Return to public portfolio view"
            >
              Exit
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="border border-[var(--color-border)] px-2.5 py-1.5 text-xs font-mono text-[var(--color-muted)] hover:text-red-400 hover:border-red-500/40 rounded cursor-pointer transition-colors"
              title="Log out of admin session"
            >
              Log Out
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mx-auto flex max-w-7xl pt-3 text-xs font-mono overflow-x-auto no-scrollbar gap-1">
          <button
            type="button"
            onClick={() => {
              setCurrentTab('projects')
              cancelProjectEdit()
            }}
            className={`border-b-2 px-3 py-2 cursor-pointer transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              currentTab === 'projects'
                ? 'border-[var(--color-text)] text-[var(--color-text)] font-semibold'
                : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            <span>📁 Projects</span>
            <span className="rounded bg-[var(--color-bg)] border border-[var(--color-border)] px-1.5 py-0.2 text-[10px] text-[var(--color-muted)]">
              {data.projects.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setCurrentTab('essays')
              cancelEssayEdit()
            }}
            className={`border-b-2 px-3 py-2 cursor-pointer transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              currentTab === 'essays'
                ? 'border-[var(--color-text)] text-[var(--color-text)] font-semibold'
                : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            <span>✍️ Essays & Writing</span>
            <span className="rounded bg-[var(--color-bg)] border border-[var(--color-border)] px-1.5 py-0.2 text-[10px] text-[var(--color-muted)]">
              {data.essays?.length || 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentTab('profile')}
            className={`border-b-2 px-3 py-2 cursor-pointer transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              currentTab === 'profile'
                ? 'border-[var(--color-text)] text-[var(--color-text)] font-semibold'
                : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            <span>👤 Profile & Bio</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentTab('chats')}
            className={`border-b-2 px-3 py-2 cursor-pointer transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              currentTab === 'chats'
                ? 'border-[var(--color-text)] text-[var(--color-text)] font-semibold'
                : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            <span>💬 Visitor AI Chats</span>
            <span className="rounded bg-[var(--color-bg)] border border-[var(--color-border)] px-1.5 py-0.2 text-[10px] text-[var(--color-muted)]">
              {chatSessions.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentTab('firebase')}
            className={`border-b-2 px-3 py-2 cursor-pointer transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              currentTab === 'firebase'
                ? 'border-[var(--color-text)] text-[var(--color-text)] font-semibold'
                : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            <span>☁ Cloud Sync & Rules</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentTab('backup')}
            className={`border-b-2 px-3 py-2 cursor-pointer transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              currentTab === 'backup'
                ? 'border-[var(--color-text)] text-[var(--color-text)] font-semibold'
                : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            <span>💾 Raw JSON</span>
          </button>
        </div>
      </header>

      {/* Save / Feedback Status Notification */}
      {saveStatus.message && (
        <div className="border-b border-[var(--color-border)] bg-[var(--color-bg)] px-6 py-2.5">
          <div className="mx-auto max-w-7xl flex items-center justify-between text-xs font-mono">
            <span
              className={
                saveStatus.type === 'success'
                  ? 'text-emerald-400'
                  : saveStatus.type === 'error'
                  ? 'text-red-400'
                  : 'text-sky-400'
              }
            >
              {saveStatus.type === 'success' ? '✓ ' : saveStatus.type === 'error' ? '✗ ' : 'ℹ '}
              {saveStatus.message}
            </span>
            <button
              type="button"
              onClick={() => setSaveStatus({ type: null, message: '' })}
              className="text-[var(--color-muted)] hover:text-[var(--color-text)] ml-2"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area (Scrollable) */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">
          {/* ================= TAB 1: PROJECTS ================= */}
          {currentTab === 'projects' && (
            <div>
              {activeProjectDraft ? (
                /* ================= PROJECT EDITOR VIEW ================= */
                <div className="space-y-6">
                  {/* Top Editor Bar */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-[var(--color-border)] bg-[var(--color-panel)] p-4 rounded-lg">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-[var(--color-muted)] uppercase tracking-wider">
                          {isNewProject ? 'Project Creator' : 'Project Editor'}
                        </span>
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)]">
                          {activeProjectDraft.category}
                        </span>
                      </div>
                      <h2 className="text-lg font-semibold text-[var(--color-text)] mt-1">
                        {activeProjectDraft.title || 'Untitled Project'}
                      </h2>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={commitProjectDraft}
                        className="btn-primary flex-1 sm:flex-initial px-4 py-2 text-xs font-mono cursor-pointer shadow-sm"
                      >
                        ✓ Apply To List
                      </button>
                      <button
                        type="button"
                        onClick={cancelProjectEdit}
                        className="btn-secondary flex-1 sm:flex-initial px-4 py-2 text-xs font-mono cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>

                  {/* ⚡ Swirl AI Autofill Assistant Section */}
                  <div className="border border-indigo-500/30 bg-gradient-to-r from-indigo-500/5 via-[var(--color-panel)] to-purple-500/5 p-4 sm:p-5 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400 text-xs font-mono">
                          ⚡
                        </span>
                        <div>
                          <h4 className="text-xs font-mono font-semibold text-[var(--color-text)] uppercase tracking-wider">
                            Swirl AI Project Writer
                          </h4>
                          <p className="text-[11px] text-[var(--color-muted)]">
                            Paste any GitHub repo link. AI will fetch the README and automatically write the title, descriptions, tech stack, features, and architecture components!
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-2.5 text-xs text-[var(--color-muted)] font-mono">
                          🐙
                        </span>
                        <input
                          type="text"
                          placeholder="https://github.com/owner/repository"
                          value={aiRepoUrl}
                          onChange={(e) => setAiRepoUrl(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              handleAiAutofill()
                            }
                          }}
                          className="w-full pl-8 pr-3 py-2 border border-[var(--color-border)] bg-[var(--color-bg)] text-xs font-mono text-[var(--color-text)] focus:border-indigo-500 focus:outline-none rounded"
                        />
                      </div>

                      <button
                        type="button"
                        disabled={isGeneratingAi || !aiRepoUrl.trim()}
                        onClick={() => handleAiAutofill()}
                        className="btn-primary bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 text-xs font-mono cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm rounded"
                      >
                        {isGeneratingAi ? (
                          <>
                            <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                            <span>Writing with AI...</span>
                          </>
                        ) : (
                          <>
                            <span>✨ AI Write Project</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Progress / Status / Error feedback */}
                    {aiStatusMessage && (
                      <div className="text-xs font-mono text-indigo-400 flex items-center gap-1.5 pt-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
                        <span>{aiStatusMessage}</span>
                      </div>
                    )}
                    {aiError && (
                      <div className="text-xs font-mono text-red-400 border border-red-500/20 bg-red-500/10 p-2.5 rounded">
                        {aiError}
                      </div>
                    )}
                  </div>

                  {/* Project Form Fields */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left Column (8 cols): Primary details */}
                    <div className="lg:col-span-8 space-y-6">
                      {/* Section 1: Identity & Categorization */}
                      <div className="border border-[var(--color-border)] bg-[var(--color-panel)] p-5 rounded-lg space-y-4">
                        <h4 className="text-xs font-mono uppercase tracking-wider text-[var(--color-muted)] border-b border-[var(--color-border)] pb-2">
                          1. Project Overview
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-mono text-[var(--color-muted)] mb-1">
                              Project Title *
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. doc-engine"
                              value={activeProjectDraft.title}
                              onChange={(e) =>
                                setActiveProjectDraft({ ...activeProjectDraft, title: e.target.value })
                              }
                              className="w-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-border-hover)] focus:outline-none rounded font-medium"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-mono text-[var(--color-muted)] mb-1">
                              Category *
                            </label>
                            <select
                              value={activeProjectDraft.category}
                              onChange={(e) =>
                                setActiveProjectDraft({
                                  ...activeProjectDraft,
                                  category: e.target.value,
                                })
                              }
                              className="w-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs font-mono text-[var(--color-text)] focus:border-[var(--color-border-hover)] focus:outline-none rounded"
                            >
                              {SUGGESTED_CATEGORIES.map((cat) => (
                                <option key={cat} value={cat}>
                                  {cat}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Short Card Description */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-mono text-[var(--color-muted)]">
                              Short Description (Card View Summary) *
                            </label>
                            <span className="text-[10px] font-mono text-[var(--color-muted)]">
                              {activeProjectDraft.description.length} chars
                            </span>
                          </div>
                          <textarea
                            rows={2}
                            placeholder="A concise, punchy 1-2 sentence overview of the project's engineering purpose."
                            value={activeProjectDraft.description}
                            onChange={(e) =>
                              setActiveProjectDraft({
                                ...activeProjectDraft,
                                description: e.target.value,
                              })
                            }
                            className="w-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-text)] focus:border-[var(--color-border-hover)] focus:outline-none rounded leading-relaxed"
                          />
                        </div>

                        {/* Deep Dive / Full Description (With Markdown Preview) */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-mono text-[var(--color-muted)]">
                              Technical Deep Dive (Modal Case Study)
                            </label>
                            <div className="flex border border-[var(--color-border)] rounded text-[10px] font-mono overflow-hidden">
                              <button
                                type="button"
                                onClick={() => setPreviewMarkdown(false)}
                                className={`px-2.5 py-1 ${
                                  !previewMarkdown
                                    ? 'bg-[var(--color-text)] text-[var(--color-bg)] font-semibold'
                                    : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                                }`}
                              >
                                Edit Markdown
                              </button>
                              <button
                                type="button"
                                onClick={() => setPreviewMarkdown(true)}
                                className={`px-2.5 py-1 ${
                                  previewMarkdown
                                    ? 'bg-[var(--color-text)] text-[var(--color-bg)] font-semibold'
                                    : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                                }`}
                              >
                                Live Preview
                              </button>
                            </div>
                          </div>

                          {!previewMarkdown ? (
                            <textarea
                              rows={8}
                              placeholder="Full architectural case study in Markdown: Problem statement, why it was created, internal mechanics, and tradeoffs..."
                              value={activeProjectDraft.fullDescription}
                              onChange={(e) =>
                                setActiveProjectDraft({
                                  ...activeProjectDraft,
                                  fullDescription: e.target.value,
                                })
                              }
                              className="w-full border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-xs font-mono text-[var(--color-text)] focus:border-[var(--color-border-hover)] focus:outline-none rounded leading-relaxed"
                            />
                          ) : (
                            <div className="border border-[var(--color-border)] bg-[var(--color-bg)] p-4 rounded max-h-64 overflow-y-auto text-xs leading-relaxed text-[var(--color-text)] whitespace-pre-wrap font-sans">
                              {activeProjectDraft.fullDescription || 'No markdown content yet.'}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Section 2: Key Features Manager */}
                      <div className="border border-[var(--color-border)] bg-[var(--color-panel)] p-5 rounded-lg space-y-4">
                        <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2">
                          <h4 className="text-xs font-mono uppercase tracking-wider text-[var(--color-muted)]">
                            2. Key Features ({activeProjectDraft.features.length})
                          </h4>
                          <button
                            type="button"
                            onClick={handleAddFeature}
                            className="text-xs font-mono text-[var(--color-text)] hover:underline cursor-pointer flex items-center gap-1"
                          >
                            + Add Feature
                          </button>
                        </div>

                        <div className="space-y-2">
                          {activeProjectDraft.features.map((feat, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <span className="text-xs font-mono text-[var(--color-muted)] w-5 text-right">
                                {idx + 1}.
                              </span>
                              <input
                                type="text"
                                placeholder={`Feature bullet point #${idx + 1}`}
                                value={feat}
                                onChange={(e) => handleUpdateFeature(idx, e.target.value)}
                                className="flex-1 border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-xs text-[var(--color-text)] focus:border-[var(--color-border-hover)] focus:outline-none rounded"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveFeature(idx)}
                                className="text-xs text-[var(--color-muted)] hover:text-red-400 p-1 cursor-pointer"
                                title="Remove feature"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Section 3: Architecture & Technologies Breakdown */}
                      <div className="border border-[var(--color-border)] bg-[var(--color-panel)] p-5 rounded-lg space-y-4">
                        <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2">
                          <h4 className="text-xs font-mono uppercase tracking-wider text-[var(--color-muted)]">
                            3. Subsystem Architecture ({activeProjectDraft.technologies.length})
                          </h4>
                          <button
                            type="button"
                            onClick={handleAddTech}
                            className="text-xs font-mono text-[var(--color-text)] hover:underline cursor-pointer flex items-center gap-1"
                          >
                            + Add Subsystem
                          </button>
                        </div>

                        <div className="space-y-3">
                          {activeProjectDraft.technologies.map((tech, idx) => (
                            <div
                              key={idx}
                              className="border border-[var(--color-border)] bg-[var(--color-bg)] p-3 rounded space-y-2 relative"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <input
                                  type="text"
                                  placeholder="Subsystem Name (e.g. Layout Calculation Engine)"
                                  value={tech.name}
                                  onChange={(e) => handleUpdateTech(idx, 'name', e.target.value)}
                                  className="flex-1 border-b border-[var(--color-border)] bg-transparent pb-1 text-xs font-mono font-semibold text-[var(--color-text)] focus:border-[var(--color-border-hover)] focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleRemoveTech(idx)}
                                  className="text-xs text-[var(--color-muted)] hover:text-red-400 p-1 cursor-pointer"
                                  title="Remove component"
                                >
                                  ✕
                                </button>
                              </div>
                              <textarea
                                rows={2}
                                placeholder="Describe the technical implementation, algorithm, or data structure used."
                                value={tech.details}
                                onChange={(e) => handleUpdateTech(idx, 'details', e.target.value)}
                                className="w-full bg-transparent text-xs text-[var(--color-muted)] focus:text-[var(--color-text)] focus:outline-none resize-none leading-relaxed"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Right Column (4 cols): Meta, Links & Tech Stack */}
                    <div className="lg:col-span-4 space-y-6">
                      {/* URLs & Action Links */}
                      <div className="border border-[var(--color-border)] bg-[var(--color-panel)] p-5 rounded-lg space-y-3">
                        <h4 className="text-xs font-mono uppercase tracking-wider text-[var(--color-muted)] border-b border-[var(--color-border)] pb-2">
                          Repository & Links
                        </h4>

                        <div>
                          <label className="block text-[11px] font-mono text-[var(--color-muted)] mb-1">
                            GitHub Repository Link
                          </label>
                          <input
                            type="text"
                            placeholder="https://github.com/junaidmirr/..."
                            value={activeProjectDraft.githubUrl || ''}
                            onChange={(e) =>
                              setActiveProjectDraft({
                                ...activeProjectDraft,
                                githubUrl: e.target.value,
                              })
                            }
                            className="w-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-xs font-mono text-[var(--color-text)] focus:outline-none rounded"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-mono text-[var(--color-muted)] mb-1">
                            Live Demo / Docs URL
                          </label>
                          <input
                            type="text"
                            placeholder="https://..."
                            value={activeProjectDraft.liveUrl || ''}
                            onChange={(e) =>
                              setActiveProjectDraft({ ...activeProjectDraft, liveUrl: e.target.value })
                            }
                            className="w-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-xs font-mono text-[var(--color-text)] focus:outline-none rounded"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-mono text-[var(--color-muted)] mb-1">
                            Button Link Label
                          </label>
                          <input
                            type="text"
                            placeholder="View case study"
                            value={activeProjectDraft.linkLabel}
                            onChange={(e) =>
                              setActiveProjectDraft({
                                ...activeProjectDraft,
                                linkLabel: e.target.value,
                              })
                            }
                            className="w-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-xs font-mono text-[var(--color-text)] focus:outline-none rounded"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-mono text-[var(--color-muted)] mb-1">
                            Project Icon
                          </label>
                          <div className="flex flex-wrap gap-1.5">
                            {AVAILABLE_ICONS.map((ic) => (
                              <button
                                key={ic}
                                type="button"
                                onClick={() => setActiveProjectDraft({ ...activeProjectDraft, icon: ic })}
                                className={`px-2 py-1 text-xs font-mono rounded border cursor-pointer ${
                                  activeProjectDraft.icon === ic
                                    ? 'border-[var(--color-text)] bg-[var(--color-text)] text-[var(--color-bg)] font-semibold'
                                    : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-muted)] hover:text-[var(--color-text)]'
                                }`}
                              >
                                {ic}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Tech Stack Tag Manager */}
                      <div className="border border-[var(--color-border)] bg-[var(--color-panel)] p-5 rounded-lg space-y-3">
                        <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2">
                          <h4 className="text-xs font-mono uppercase tracking-wider text-[var(--color-muted)]">
                            Tech Stack Tags ({activeProjectDraft.stack.length})
                          </h4>
                        </div>

                        {/* Tag list */}
                        <div className="flex flex-wrap gap-1.5 min-h-[40px]">
                          {activeProjectDraft.stack.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-xs font-mono text-[var(--color-text)]"
                            >
                              <span>{tag}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveTag(tag)}
                                className="text-[var(--color-muted)] hover:text-red-400 cursor-pointer"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>

                        {/* Add custom tag */}
                        <div className="flex gap-1.5 pt-1">
                          <input
                            type="text"
                            placeholder="Add tag (e.g. Rust, Kotlin)..."
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ',') {
                                e.preventDefault()
                                handleAddTag()
                              }
                            }}
                            className="flex-1 border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1.5 text-xs font-mono text-[var(--color-text)] focus:outline-none rounded"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddTag()}
                            className="btn-secondary px-3 py-1 text-xs font-mono cursor-pointer"
                          >
                            +
                          </button>
                        </div>

                        {/* Popular suggestions */}
                        <div className="pt-2">
                          <span className="text-[10px] font-mono text-[var(--color-muted)] block mb-1.5">
                            Suggestions (click to add):
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {POPULAR_STACK_SUGGESTIONS.filter(
                              (s) => !activeProjectDraft.stack.includes(s)
                            )
                              .slice(0, 10)
                              .map((s) => (
                                <button
                                  key={s}
                                  type="button"
                                  onClick={() => handleAddTag(s)}
                                  className="text-[10px] font-mono text-[var(--color-muted)] hover:text-[var(--color-text)] border border-[var(--color-border)] hover:border-[var(--color-border-hover)] bg-[var(--color-bg)] px-2 py-0.5 rounded cursor-pointer transition-colors"
                                >
                                  +{s}
                                </button>
                              ))}
                          </div>
                        </div>
                      </div>

                      {/* Live Card Preview Box */}
                      <div className="border border-[var(--color-border)] bg-[var(--color-panel)] p-4 rounded-lg space-y-2">
                        <span className="text-[10px] font-mono text-[var(--color-muted)] uppercase tracking-wider block">
                          Card Preview:
                        </span>
                        <div className="border border-[var(--color-border)] bg-[var(--color-bg)] p-3 rounded">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-sm font-semibold text-[var(--color-text)] truncate">
                              {activeProjectDraft.title || 'Project Title'}
                            </span>
                            <span className="text-[10px] font-mono text-[var(--color-muted)] truncate max-w-[120px]">
                              {activeProjectDraft.category}
                            </span>
                          </div>
                          <p className="mt-1.5 text-[11px] text-[var(--color-muted)] line-clamp-2 leading-relaxed">
                            {activeProjectDraft.description || 'Card description summary will appear here.'}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {activeProjectDraft.stack.slice(0, 4).map((t) => (
                              <span
                                key={t}
                                className="text-[9px] font-mono border border-[var(--color-border)] px-1.5 py-0.5 rounded text-[var(--color-muted)]"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* ================= PROJECTS LIST VIEW ================= */
                <div className="space-y-4">
                  {/* Action Bar */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border border-[var(--color-border)] bg-[var(--color-panel)] p-4 rounded-lg">
                    {/* Search Input */}
                    <div className="relative flex-1 max-w-md">
                      <span className="absolute left-3 top-2.5 text-xs text-[var(--color-muted)] font-mono">
                        🔍
                      </span>
                      <input
                        type="text"
                        placeholder="Search projects by name, stack, or category..."
                        value={projectSearchQuery}
                        onChange={(e) => setProjectSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 border border-[var(--color-border)] bg-[var(--color-bg)] text-xs font-mono text-[var(--color-text)] focus:border-[var(--color-border-hover)] focus:outline-none rounded"
                      />
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAiImportModal(true)}
                        className="btn-primary bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 text-xs font-mono cursor-pointer flex items-center gap-1.5 shadow-sm rounded"
                      >
                        <span>⚡ AI Import from GitHub</span>
                      </button>

                      <button
                        type="button"
                        onClick={startAddNewProject}
                        className="btn-primary px-3.5 py-2 text-xs font-mono cursor-pointer flex items-center gap-1 rounded"
                      >
                        <span>+ New Project</span>
                      </button>
                    </div>
                  </div>

                  {/* Projects List */}
                  {filteredProjects.length === 0 ? (
                    <div className="border border-[var(--color-border)] bg-[var(--color-panel)] p-12 text-center rounded-lg">
                      <p className="text-sm font-mono text-[var(--color-text)]">
                        {projectSearchQuery ? 'No matching projects found' : 'No projects added yet'}
                      </p>
                      <p className="mt-1 text-xs text-[var(--color-muted)]">
                        {projectSearchQuery
                          ? 'Try clearing the search query or search by another keyword.'
                          : 'Use "AI Import from GitHub" to automatically write your project entry in seconds.'}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      {filteredProjects.map((proj) => {
                        const originalIndex = data.projects.findIndex((p) => p.title === proj.title)
                        return (
                          <div
                            key={proj.title}
                            className="border border-[var(--color-border)] bg-[var(--color-panel)] hover:border-[var(--color-border-hover)] p-4 sm:p-5 rounded-lg transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                          >
                            <div className="space-y-1.5 min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="h-6 w-6 rounded border border-[var(--color-border)] bg-[var(--color-bg)] flex items-center justify-center text-xs font-mono text-[var(--color-text)]">
                                  {proj.icon === 'code'
                                    ? '</>'
                                    : proj.icon === 'globe'
                                    ? '🌐'
                                    : proj.icon === 'rocket'
                                    ? '🚀'
                                    : proj.icon === 'shield'
                                    ? '🛡'
                                    : '⚡'}
                                </span>
                                <h3 className="text-base font-semibold text-[var(--color-text)] truncate">
                                  {proj.title}
                                </h3>
                                <span className="text-[11px] font-mono text-[var(--color-muted)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-0.5 rounded">
                                  {proj.category}
                                </span>
                              </div>

                              <p className="text-xs text-[var(--color-muted)] line-clamp-2 leading-relaxed">
                                {proj.description}
                              </p>

                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {proj.stack.map((tech) => (
                                  <span
                                    key={tech}
                                    className="text-[10px] font-mono px-2 py-0.5 rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-muted)]"
                                  >
                                    {tech}
                                  </span>
                                ))}
                              </div>
                            </div>

                            {/* Project Item Actions */}
                            <div className="flex items-center gap-1.5 sm:self-center border-t sm:border-t-0 pt-3 sm:pt-0 border-[var(--color-border)]">
                              <button
                                type="button"
                                onClick={() => moveProject(originalIndex, 'up')}
                                disabled={originalIndex === 0}
                                title="Move project up"
                                className="px-2 py-1 text-xs font-mono border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-muted)] hover:text-[var(--color-text)] disabled:opacity-30 rounded cursor-pointer"
                              >
                                ▲
                              </button>
                              <button
                                type="button"
                                onClick={() => moveProject(originalIndex, 'down')}
                                disabled={originalIndex === data.projects.length - 1}
                                title="Move project down"
                                className="px-2 py-1 text-xs font-mono border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-muted)] hover:text-[var(--color-text)] disabled:opacity-30 rounded cursor-pointer"
                              >
                                ▼
                              </button>

                              <button
                                type="button"
                                onClick={() => startEditProject(originalIndex)}
                                className="btn-primary px-3 py-1 text-xs font-mono cursor-pointer rounded"
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() => deleteProject(originalIndex)}
                                className="px-2.5 py-1 text-xs font-mono text-[var(--color-muted)] hover:text-red-400 border border-[var(--color-border)] hover:border-red-500/40 rounded cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ================= TAB: ESSAYS & PERSPECTIVES ================= */}
          {currentTab === 'essays' && (
            <div>
              {activeEssayDraft ? (
                /* ================= ESSAY EDITOR VIEW ================= */
                <div className="space-y-6">
                  {/* Top Editor Bar */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-[var(--color-border)] bg-[var(--color-panel)] p-4 rounded-lg">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-[var(--color-muted)] uppercase tracking-wider">
                          {isNewEssay ? 'Essay Creator' : 'Essay Editor'}
                        </span>
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)]">
                          {activeEssayDraft.category || 'System Architecture'}
                        </span>
                      </div>
                      <h2 className="text-lg font-semibold text-[var(--color-text)] mt-1">
                        {activeEssayDraft.title || 'Untitled Essay'}
                      </h2>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={commitEssayDraft}
                        className="btn-primary flex-1 sm:flex-initial px-4 py-2 text-xs font-mono cursor-pointer shadow-sm"
                      >
                        ✓ Apply To List
                      </button>
                      <button
                        type="button"
                        onClick={cancelEssayEdit}
                        className="btn-secondary flex-1 sm:flex-initial px-4 py-2 text-xs font-mono cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>

                  {/* Form Card */}
                  <div className="border border-[var(--color-border)] bg-[var(--color-panel)] p-6 rounded-lg space-y-6">
                    {/* Title & Slug */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-mono text-[var(--color-muted)] mb-1">
                          Essay Title *
                        </label>
                        <input
                          type="text"
                          value={activeEssayDraft.title}
                          onChange={(e) => {
                            const val = e.target.value
                            setActiveEssayDraft((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    title: val,
                                    slug: isNewEssay
                                      ? val
                                          .toLowerCase()
                                          .replace(/[^\w\s-]/g, '')
                                          .replace(/\s+/g, '-')
                                      : prev.slug,
                                  }
                                : null
                            )
                          }}
                          placeholder="e.g. Why Grep-Based Context Fails Modern Coding Agents"
                          className="w-full px-3 py-2 border border-[var(--color-border)] bg-[var(--color-bg)] text-xs font-mono text-[var(--color-text)] rounded focus:outline-none focus:border-[var(--color-border-hover)]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-mono text-[var(--color-muted)] mb-1">
                          URL Slug
                        </label>
                        <input
                          type="text"
                          value={activeEssayDraft.slug}
                          onChange={(e) =>
                            setActiveEssayDraft((prev) => (prev ? { ...prev, slug: e.target.value } : null))
                          }
                          placeholder="e.g. why-grep-based-context-fails"
                          className="w-full px-3 py-2 border border-[var(--color-border)] bg-[var(--color-bg)] text-xs font-mono text-[var(--color-text)] rounded focus:outline-none focus:border-[var(--color-border-hover)]"
                        />
                      </div>
                    </div>

                    {/* Category with Suggested Pills */}
                    <div>
                      <label className="block text-xs font-mono text-[var(--color-muted)] mb-1">
                        Category
                      </label>
                      <input
                        type="text"
                        value={activeEssayDraft.category}
                        onChange={(e) =>
                          setActiveEssayDraft((prev) =>
                            prev ? { ...prev, category: e.target.value } : null
                          )
                        }
                        placeholder="e.g. System Architecture"
                        className="w-full px-3 py-2 border border-[var(--color-border)] bg-[var(--color-bg)] text-xs font-mono text-[var(--color-text)] rounded focus:outline-none focus:border-[var(--color-border-hover)] mb-2"
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {SUGGESTED_ESSAY_CATEGORIES.map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() =>
                              setActiveEssayDraft((prev) => (prev ? { ...prev, category: cat } : null))
                            }
                            className={`px-2 py-0.5 rounded text-[11px] font-mono cursor-pointer border transition-colors ${
                              activeEssayDraft.category === cat
                                ? 'bg-[var(--color-text)] text-[var(--color-bg)] border-[var(--color-text)]'
                                : 'bg-[var(--color-bg)] text-[var(--color-muted)] border-[var(--color-border)] hover:border-[var(--color-border-hover)]'
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Date & Reading Time */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-mono text-[var(--color-muted)] mb-1">
                          Publication Date
                        </label>
                        <input
                          type="text"
                          value={activeEssayDraft.date}
                          onChange={(e) =>
                            setActiveEssayDraft((prev) => (prev ? { ...prev, date: e.target.value } : null))
                          }
                          placeholder="e.g. Nov 2026 or Nov 4, 2026"
                          className="w-full px-3 py-2 border border-[var(--color-border)] bg-[var(--color-bg)] text-xs font-mono text-[var(--color-text)] rounded focus:outline-none focus:border-[var(--color-border-hover)]"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-mono text-[var(--color-muted)]">
                            Estimated Reading Time
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const words = (activeEssayDraft.content || '')
                                .trim()
                                .split(/\s+/)
                                .filter(Boolean).length
                              const mins = Math.max(1, Math.ceil(words / 200))
                              setActiveEssayDraft((prev) =>
                                prev ? { ...prev, readingTime: `${mins} min read` } : null
                              )
                            }}
                            className="text-[10px] font-mono text-indigo-400 hover:underline cursor-pointer"
                          >
                            ⚡ Calc from word count
                          </button>
                        </div>
                        <input
                          type="text"
                          value={activeEssayDraft.readingTime}
                          onChange={(e) =>
                            setActiveEssayDraft((prev) =>
                              prev ? { ...prev, readingTime: e.target.value } : null
                            )
                          }
                          placeholder="e.g. 5 min read"
                          className="w-full px-3 py-2 border border-[var(--color-border)] bg-[var(--color-bg)] text-xs font-mono text-[var(--color-text)] rounded focus:outline-none focus:border-[var(--color-border-hover)]"
                        />
                      </div>
                    </div>

                    {/* Excerpt */}
                    <div>
                      <label className="block text-xs font-mono text-[var(--color-muted)] mb-1">
                        Card Excerpt / Abstract
                      </label>
                      <textarea
                        rows={3}
                        value={activeEssayDraft.excerpt}
                        onChange={(e) =>
                          setActiveEssayDraft((prev) => (prev ? { ...prev, excerpt: e.target.value } : null))
                        }
                        placeholder="Brief 1-2 sentence overview displayed on the post card and reader header..."
                        className="w-full px-3 py-2 border border-[var(--color-border)] bg-[var(--color-bg)] text-xs font-mono text-[var(--color-text)] rounded focus:outline-none focus:border-[var(--color-border-hover)]"
                      />
                    </div>

                    {/* Attachments Section */}
                    <div className="border border-[var(--color-border)] bg-[var(--color-bg)] p-4 rounded-lg space-y-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">📎</span>
                        <h4 className="text-xs font-mono font-semibold text-[var(--color-text)] uppercase tracking-wider">
                          Media & Link Attachments
                        </h4>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-mono text-[var(--color-muted)] mb-1">
                            External Link URL (Optional)
                          </label>
                          <input
                            type="text"
                            value={activeEssayDraft.externalLink || ''}
                            onChange={(e) =>
                              setActiveEssayDraft((prev) =>
                                prev ? { ...prev, externalLink: e.target.value } : null
                              )
                            }
                            placeholder="https://github.com/... or https://demo..."
                            className="w-full px-3 py-2 border border-[var(--color-border)] bg-[var(--color-panel)] text-xs font-mono text-[var(--color-text)] rounded focus:outline-none focus:border-[var(--color-border-hover)]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-mono text-[var(--color-muted)] mb-1">
                            External Link Button Label (Optional)
                          </label>
                          <input
                            type="text"
                            value={activeEssayDraft.externalLinkLabel || ''}
                            onChange={(e) =>
                              setActiveEssayDraft((prev) =>
                                prev ? { ...prev, externalLinkLabel: e.target.value } : null
                              )
                            }
                            placeholder="e.g. View Interactive Map Demo ↗"
                            className="w-full px-3 py-2 border border-[var(--color-border)] bg-[var(--color-panel)] text-xs font-mono text-[var(--color-text)] rounded focus:outline-none focus:border-[var(--color-border-hover)]"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-mono text-[var(--color-muted)] mb-1">
                          Cover / Architecture Diagram Image URL (Optional)
                        </label>
                        <input
                          type="text"
                          value={activeEssayDraft.coverImage || ''}
                          onChange={(e) =>
                            setActiveEssayDraft((prev) =>
                              prev ? { ...prev, coverImage: e.target.value } : null
                            )
                          }
                          placeholder="https://images.unsplash.com/... or /path/to/diagram.png"
                          className="w-full px-3 py-2 border border-[var(--color-border)] bg-[var(--color-panel)] text-xs font-mono text-[var(--color-text)] rounded focus:outline-none focus:border-[var(--color-border-hover)]"
                        />
                        {activeEssayDraft.coverImage && (
                          <div className="mt-3 flex items-center gap-3 p-2 rounded border border-[var(--color-border)] bg-[var(--color-panel)]">
                            <img
                              src={activeEssayDraft.coverImage}
                              alt="Preview"
                              className="h-16 w-28 object-cover rounded border border-[var(--color-border)]"
                              onError={(e) => {
                                ;(e.target as HTMLElement).style.display = 'none'
                              }}
                            />
                            <span className="text-[11px] font-mono text-[var(--color-muted)]">
                              Attached image preview
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Markdown Body Content */}
                    <div>
                      <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-[var(--color-muted)]">
                            Content (Markdown)
                          </span>
                          <span className="text-[10px] font-mono text-[var(--color-muted)]">
                            ({(activeEssayDraft.content || '').split(/\s+/).filter(Boolean).length} words)
                          </span>
                        </div>

                        <div className="flex items-center gap-1 text-xs font-mono">
                          <button
                            type="button"
                            onClick={() => setPreviewEssayMarkdown(false)}
                            className={`px-3 py-1 rounded cursor-pointer transition-colors ${
                              !previewEssayMarkdown
                                ? 'bg-[var(--color-text)] text-[var(--color-bg)] font-semibold'
                                : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                            }`}
                          >
                            Write
                          </button>
                          <button
                            type="button"
                            onClick={() => setPreviewEssayMarkdown(true)}
                            className={`px-3 py-1 rounded cursor-pointer transition-colors ${
                              previewEssayMarkdown
                                ? 'bg-[var(--color-text)] text-[var(--color-bg)] font-semibold'
                                : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                            }`}
                          >
                            Live Preview
                          </button>
                        </div>
                      </div>

                      {!previewEssayMarkdown ? (
                        <textarea
                          rows={18}
                          value={activeEssayDraft.content}
                          onChange={(e) =>
                            setActiveEssayDraft((prev) =>
                              prev ? { ...prev, content: e.target.value } : null
                            )
                          }
                          placeholder="Write your technical essay here using standard Markdown...&#10;&#10;## Section Heading&#10;&#10;Explain your architectural thesis, trade-offs, and benchmarks.&#10;&#10;```python&#10;# Code example&#10;def parse_operators():&#10;    pass&#10;```&#10;&#10;- Bullet point one&#10;- Bullet point two"
                          className="w-full px-3 py-2 border border-[var(--color-border)] bg-[var(--color-bg)] text-xs font-mono text-[var(--color-text)] rounded focus:outline-none focus:border-[var(--color-border-hover)] leading-relaxed"
                        />
                      ) : (
                        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-6 min-h-[300px]">
                          {activeEssayDraft.content ? (
                            renderEssayMarkdown(activeEssayDraft.content)
                          ) : (
                            <p className="text-xs font-mono text-[var(--color-muted)] text-center py-10">
                              Nothing to preview yet. Switch back to Write mode to draft your essay.
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Bottom Save Action */}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
                      <button
                        type="button"
                        onClick={cancelEssayEdit}
                        className="btn-secondary px-4 py-2 text-xs font-mono cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={commitEssayDraft}
                        className="btn-primary px-5 py-2 text-xs font-mono cursor-pointer"
                      >
                        ✓ Apply To List
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* ================= ESSAY LIST & MODERATION VIEW ================= */
                <div className="space-y-8">
                  {/* Top Bar */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[var(--color-border)] pb-4">
                    <div>
                      <h2 className="text-lg font-semibold text-[var(--color-text)]">
                        Essays & Architectural Perspectives
                      </h2>
                      <p className="text-xs font-mono text-[var(--color-muted)] mt-1">
                        Publish deep-dives, architectural essays, and research notes with live views, likes, and reader discussions.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isLoadingInteractions}
                        onClick={loadInteractions}
                        className="btn-secondary px-3 py-1.5 text-xs font-mono cursor-pointer flex items-center gap-1.5"
                        title="Refresh analytics and comments"
                      >
                        <span className={isLoadingInteractions ? 'animate-spin' : ''}>🔄</span>
                        <span>{isLoadingInteractions ? 'Refreshing...' : 'Refresh Stats'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={startNewEssay}
                        className="btn-primary px-3.5 py-1.5 text-xs font-mono cursor-pointer flex items-center gap-1.5 shadow-sm"
                      >
                        <span>✍️ New Essay</span>
                      </button>
                    </div>
                  </div>

                  {/* Search Bar */}
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-[var(--color-muted)] font-mono">
                      🔍
                    </span>
                    <input
                      type="text"
                      placeholder="Search essays by title, category, or abstract..."
                      value={essaySearchQuery}
                      onChange={(e) => setEssaySearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 border border-[var(--color-border)] bg-[var(--color-bg)] text-xs font-mono text-[var(--color-text)] rounded focus:outline-none focus:border-[var(--color-border-hover)]"
                    />
                  </div>

                  {/* Essays List Cards */}
                  <div className="space-y-3">
                    {(!data.essays || data.essays.length === 0) ? (
                      <div className="p-8 text-center border border-dashed border-[var(--color-border)] rounded-lg text-xs font-mono text-[var(--color-muted)]">
                        No essays published yet. Click "✍️ New Essay" to publish your first post!
                      </div>
                    ) : (
                      data.essays
                        .filter((essay) => {
                          if (!essaySearchQuery.trim()) return true
                          const q = essaySearchQuery.toLowerCase()
                          return (
                            essay.title.toLowerCase().includes(q) ||
                            essay.category.toLowerCase().includes(q) ||
                            essay.excerpt.toLowerCase().includes(q)
                          )
                        })
                        .map((essay, index) => {
                          const stats = essayInteractions[essay.id]
                          const viewsCount = stats?.views ?? 0
                          const likesCount = stats?.likes ?? 0
                          const commentsCount = stats?.comments?.length ?? 0

                          return (
                            <div
                              key={essay.id || index}
                              className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] hover:border-[var(--color-border-hover)] transition-colors"
                            >
                              <div className="space-y-1.5 flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs font-semibold text-[var(--color-text)] truncate max-w-md">
                                    {essay.title}
                                  </span>
                                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-muted)]">
                                    {essay.category}
                                  </span>
                                  <span className="text-[10px] font-mono text-[var(--color-muted)]">
                                    {essay.date} • {essay.readingTime}
                                  </span>
                                </div>

                                <p className="text-xs text-[var(--color-muted)] line-clamp-1">
                                  {essay.excerpt}
                                </p>

                                {/* Badges & Analytics */}
                                <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] font-mono">
                                  <span className="flex items-center gap-1 text-[var(--color-text)] font-medium">
                                    <span>👁️</span>
                                    <span>{viewsCount} views</span>
                                  </span>
                                  <span className="flex items-center gap-1 text-rose-500 font-medium">
                                    <span>❤️</span>
                                    <span>{likesCount} likes</span>
                                  </span>
                                  <span className="flex items-center gap-1 text-indigo-400 font-medium">
                                    <span>💬</span>
                                    <span>{commentsCount} comments</span>
                                  </span>
                                  {essay.externalLink && (
                                    <span className="text-[10px] text-[var(--color-muted)]">
                                      🔗 Link attached
                                    </span>
                                  )}
                                  {essay.coverImage && (
                                    <span className="text-[10px] text-[var(--color-muted)]">
                                      🖼️ Image attached
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Action Buttons */}
                              <div className="flex items-center gap-1.5 flex-shrink-0 self-end sm:self-center">
                                <button
                                  type="button"
                                  onClick={() => moveEssay(index, 'up')}
                                  disabled={index === 0}
                                  title="Move essay up"
                                  className="px-2 py-1 text-xs font-mono border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-muted)] hover:text-[var(--color-text)] disabled:opacity-30 rounded cursor-pointer"
                                >
                                  ▲
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveEssay(index, 'down')}
                                  disabled={index === (data.essays?.length || 0) - 1}
                                  title="Move essay down"
                                  className="px-2 py-1 text-xs font-mono border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-muted)] hover:text-[var(--color-text)] disabled:opacity-30 rounded cursor-pointer"
                                >
                                  ▼
                                </button>
                                <button
                                  type="button"
                                  onClick={() => startEditEssay(index)}
                                  className="btn-secondary px-3 py-1 text-xs font-mono cursor-pointer"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteEssay(index)}
                                  className="px-2.5 py-1 text-xs font-mono text-[var(--color-muted)] hover:text-red-400 border border-[var(--color-border)] hover:border-red-500/40 rounded cursor-pointer"
                                  title="Delete essay"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          )
                        })
                    )}
                  </div>

                  {/* ================= COMMENT MODERATION SECTION ================= */}
                  <div className="border border-[var(--color-border)] bg-[var(--color-panel)] p-6 rounded-lg space-y-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3">
                      <div>
                        <h3 className="text-base font-semibold text-[var(--color-text)] flex items-center gap-2">
                          <span>💬 Reader Discussions & Comments</span>
                          <span className="text-xs font-mono px-2 py-0.5 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-muted)]">
                            {Object.values(essayInteractions).reduce(
                              (acc, curr) => acc + (curr.comments?.length || 0),
                              0
                            )}{' '}
                            total
                          </span>
                        </h3>
                        <p className="text-xs font-mono text-[var(--color-muted)] mt-1">
                          Review and moderate comments posted by visitors across all your technical essays.
                        </p>
                      </div>

                      {/* Filter by essay */}
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-mono text-[var(--color-muted)] whitespace-nowrap">
                          Filter:
                        </label>
                        <select
                          value={commentFilterEssayId}
                          onChange={(e) => setCommentFilterEssayId(e.target.value)}
                          className="px-2.5 py-1 text-xs font-mono border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] rounded focus:outline-none"
                        >
                          <option value="all">All Essays</option>
                          {(data.essays || []).map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Comments List */}
                    {(() => {
                      const allComments: Array<
                        EssayComment & { essayTitle: string; targetEssayId: string }
                      > = []
                      for (const [eId, interaction] of Object.entries(essayInteractions)) {
                        const essayObj = (data.essays || []).find((e) => e.id === eId)
                        for (const c of interaction.comments || []) {
                          allComments.push({
                            ...c,
                            targetEssayId: eId,
                            essayTitle: essayObj?.title || eId,
                          })
                        }
                      }

                      // Sort newest first
                      allComments.sort(
                        (a, b) =>
                          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                      )

                      const displayed =
                        commentFilterEssayId === 'all'
                          ? allComments
                          : allComments.filter((c) => c.targetEssayId === commentFilterEssayId)

                      if (displayed.length === 0) {
                        return (
                          <div className="p-8 text-center border border-dashed border-[var(--color-border)] rounded-lg text-xs font-mono text-[var(--color-muted)]">
                            No comments found. When visitors discuss your essays, their thoughts appear here.
                          </div>
                        )
                      }

                      return (
                        <div className="space-y-3">
                          {displayed.map((c) => (
                            <div
                              key={c.id}
                              className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]"
                            >
                              <div className="space-y-1 flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                                  <span className="font-semibold text-[var(--color-text)]">
                                    {c.authorName || 'Anonymous Reader'}
                                  </span>
                                  <span className="text-[10px] text-[var(--color-muted)]">
                                    on &ldquo;{c.essayTitle}&rdquo;
                                  </span>
                                  <span className="text-[10px] text-[var(--color-muted)]">
                                    • {new Date(c.createdAt).toLocaleDateString(undefined, {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                </div>
                                <p className="text-xs leading-relaxed text-[var(--color-text)] whitespace-pre-wrap">
                                  {c.content}
                                </p>
                              </div>

                              <button
                                type="button"
                                disabled={isDeletingCommentId === c.id}
                                onClick={() => handleDeleteComment(c.targetEssayId, c.id)}
                                className="px-2.5 py-1 text-xs font-mono text-red-400 hover:bg-red-500/10 border border-red-500/30 rounded cursor-pointer self-end sm:self-center transition-colors disabled:opacity-50 whitespace-nowrap"
                              >
                                {isDeletingCommentId === c.id ? 'Deleting...' : 'Delete'}
                              </button>
                            </div>
                          ))}
                        </div>
                      )
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 2: PROFILE & IDENTITY ================= */}
          {currentTab === 'profile' && (
            <div className="border border-[var(--color-border)] bg-[var(--color-panel)] p-6 rounded-lg space-y-6">
              <div className="border-b border-[var(--color-border)] pb-3">
                <h3 className="text-base font-semibold text-[var(--color-text)]">
                  Portfolio Profile & Social Details
                </h3>
                <p className="text-xs font-mono text-[var(--color-muted)] mt-1">
                  Updates your biography, header presentation, contact coordinates, and social media handles.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-mono text-[var(--color-muted)] mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={data.profile.name}
                    onChange={(e) => updateProfileField('name', e.target.value)}
                    className="w-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none rounded"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-[var(--color-muted)] mb-1">
                    Engineering Role Title
                  </label>
                  <input
                    type="text"
                    value={data.profile.role}
                    onChange={(e) => updateProfileField('role', e.target.value)}
                    className="w-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none rounded"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-mono text-[var(--color-muted)] mb-1">
                    Headline Greeting
                  </label>
                  <input
                    type="text"
                    value={data.profile.headline}
                    onChange={(e) => updateProfileField('headline', e.target.value)}
                    className="w-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none rounded"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-mono text-[var(--color-muted)] mb-1">
                    Bio Summary
                  </label>
                  <textarea
                    rows={4}
                    value={data.profile.bio}
                    onChange={(e) => updateProfileField('bio', e.target.value)}
                    className="w-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none rounded leading-relaxed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-[var(--color-muted)] mb-1">
                    Location & Timezone
                  </label>
                  <input
                    type="text"
                    value={data.profile.location}
                    onChange={(e) => updateProfileField('location', e.target.value)}
                    className="w-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs font-mono text-[var(--color-text)] focus:outline-none rounded"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-[var(--color-muted)] mb-1">
                    Contact Email Address
                  </label>
                  <input
                    type="email"
                    value={data.profile.email}
                    onChange={(e) => updateProfileField('email', e.target.value)}
                    className="w-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs font-mono text-[var(--color-text)] focus:outline-none rounded"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-[var(--color-muted)] mb-1">
                    GitHub Profile URL
                  </label>
                  <input
                    type="text"
                    value={data.profile.github}
                    onChange={(e) => updateProfileField('github', e.target.value)}
                    className="w-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs font-mono text-[var(--color-text)] focus:outline-none rounded"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-[var(--color-muted)] mb-1">
                    LinkedIn Profile URL
                  </label>
                  <input
                    type="text"
                    value={data.profile.linkedin}
                    onChange={(e) => updateProfileField('linkedin', e.target.value)}
                    className="w-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs font-mono text-[var(--color-text)] focus:outline-none rounded"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 3: VISITOR AI CHAT SESSIONS ================= */}
          {currentTab === 'chats' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border border-[var(--color-border)] bg-[var(--color-panel)] p-4 rounded-lg">
                <div>
                  <h3 className="text-base font-semibold text-[var(--color-text)]">
                    Visitor AI Conversations
                  </h3>
                  <p className="mt-0.5 text-xs font-mono text-[var(--color-muted)]">
                    Live recorded sessions between visitors and Junaid AI Assistant. Synced in real time to Firestore.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Search conversations..."
                    value={chatSearchQuery}
                    onChange={(e) => setChatSearchQuery(e.target.value)}
                    className="border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1.5 text-xs font-mono text-[var(--color-text)] focus:outline-none rounded w-48"
                  />
                  <span className="text-xs font-mono px-2.5 py-1.5 rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-muted)]">
                    Total: <strong className="text-[var(--color-text)]">{chatSessions.length}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={handleRefreshChats}
                    title="Fetch latest chats from Firestore and Serverless storage"
                    className="border border-[var(--color-border)] bg-[var(--color-bg)] hover:bg-[var(--color-surface)] px-2.5 py-1.5 text-xs font-mono text-[var(--color-text)] rounded cursor-pointer transition-colors"
                  >
                    ↻ Sync Chats
                  </button>
                </div>
              </div>

              {chatSessions.length === 0 ? (
                <div className="border border-[var(--color-border)] bg-[var(--color-panel)] p-12 text-center rounded-lg">
                  <p className="text-sm font-mono text-[var(--color-text)]">No Chat Sessions Logged Yet</p>
                  <p className="mt-2 text-xs text-[var(--color-muted)] max-w-md mx-auto">
                    When visitors open the "Ask Junaid AI" assistant and start chatting about your projects or skills, their full sessions will sync and appear here automatically.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  {/* Sessions List (5 cols) */}
                  <div className="md:col-span-5 space-y-2 max-h-[620px] overflow-y-auto pr-1">
                    {filteredChatSessions.map((s) => {
                      const isSelected = s.id === selectedChatSessionId
                      const dateStr = s.updatedAt
                        ? new Date(s.updatedAt).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Unknown date'

                      return (
                        <div
                          key={s.id}
                          onClick={() => setSelectedChatSessionId(s.id)}
                          className={`p-3.5 border transition-all cursor-pointer rounded-lg text-left ${
                            isSelected
                              ? 'border-[var(--color-text)] bg-[var(--color-surface)] shadow-sm'
                              : 'border-[var(--color-border)] bg-[var(--color-panel)] hover:border-[var(--color-border-hover)]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="text-[11px] font-mono font-medium text-[var(--color-text)] truncate">
                              {dateStr}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {s.browser && (
                                <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                                  s.browser.includes('Instagram')
                                    ? 'border-pink-500/30 bg-pink-500/10 text-pink-400'
                                    : s.browser.includes('Facebook')
                                    ? 'border-blue-500/30 bg-blue-500/10 text-blue-400'
                                    : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-muted)]'
                                }`}>
                                  {s.browser}
                                </span>
                              )}
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-muted)]">
                                {s.messageCount || s.messages?.length || 0} msgs
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-[var(--color-text)] line-clamp-2 leading-relaxed">
                            "{s.summary || 'Visitor conversation'}"
                          </p>
                          <div className="mt-2 text-[10px] font-mono text-[var(--color-muted)] truncate">
                            ID: {s.id}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Transcript Viewer (7 cols) */}
                  <div className="md:col-span-7 border border-[var(--color-border)] bg-[var(--color-panel)] flex flex-col h-[620px] rounded-lg overflow-hidden">
                    {(() => {
                      const activeSession = chatSessions.find((s) => s.id === selectedChatSessionId)
                      if (!activeSession) {
                        return (
                          <div className="flex flex-1 items-center justify-center p-6 text-xs font-mono text-[var(--color-muted)]">
                            Select a session on the left to read conversation transcript.
                          </div>
                        )
                      }

                      return (
                        <>
                          <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                            <div className="min-w-0 pr-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono font-semibold text-[var(--color-text)] truncate block">
                                  {activeSession.id}
                                </span>
                                {activeSession.browser && (
                                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                                    activeSession.browser.includes('Instagram')
                                      ? 'border-pink-500/30 bg-pink-500/10 text-pink-400'
                                      : activeSession.browser.includes('Facebook')
                                      ? 'border-blue-500/30 bg-blue-500/10 text-blue-400'
                                      : 'border-[var(--color-border)] bg-[var(--color-panel)] text-[var(--color-muted)]'
                                  }`}>
                                    {activeSession.browser}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] font-mono text-[var(--color-muted)]">
                                {new Date(activeSession.createdAt || activeSession.updatedAt).toLocaleString()}
                              </span>
                            </div>
                            <button
                              type="button"
                              disabled={isDeletingChat}
                              onClick={() => handleDeleteSession(activeSession.id)}
                              className="px-2.5 py-1 text-xs font-mono text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500/60 rounded cursor-pointer whitespace-nowrap"
                            >
                              {isDeletingChat ? 'Deleting...' : 'Delete Log'}
                            </button>
                          </div>

                          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
                            {activeSession.messages && activeSession.messages.length > 0 ? (
                              activeSession.messages.map((m, idx) => (
                                <div
                                  key={m.id || idx}
                                  className={`flex flex-col ${
                                    m.role === 'user' ? 'items-end' : 'items-start'
                                  }`}
                                >
                                  <span className="mb-1 text-[10px] font-mono text-[var(--color-muted)]">
                                    {m.role === 'user' ? 'Visitor' : 'Junaid AI'}
                                  </span>
                                  <div
                                    className={`rounded-md px-3.5 py-2.5 max-w-[85%] leading-relaxed whitespace-pre-wrap ${
                                      m.role === 'user'
                                        ? 'bg-[var(--color-text)] text-[var(--color-bg)] font-medium'
                                        : 'border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)]'
                                    }`}
                                  >
                                    {m.content}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <p className="text-xs text-[var(--color-muted)]">No messages in this session.</p>
                            )}
                          </div>
                        </>
                      )
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 4: FIREBASE CLOUD SYNC ================= */}
          {currentTab === 'firebase' && (
            <div className="border border-[var(--color-border)] bg-[var(--color-panel)] p-6 rounded-lg space-y-6">
              <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-4">
                <div>
                  <h3 className="text-base font-semibold text-[var(--color-text)]">
                    Firebase Cloud Infrastructure
                  </h3>
                  <p className="text-xs font-mono text-[var(--color-muted)] mt-1">
                    Real-time cloud database configuration. Edits save to Firestore instantly without redeploying code.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="btn-secondary px-3 py-1.5 text-xs font-mono cursor-pointer"
                >
                  {isTesting ? 'Testing...' : 'Test Connection'}
                </button>
              </div>

              {testFeedback && (
                <div
                  className={`border p-4 text-xs font-mono rounded ${
                    testFeedback.ok
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                      : 'border-red-500/40 bg-red-500/10 text-red-400'
                  }`}
                >
                  {testFeedback.message}
                </div>
              )}

              {/* Environment Checklist */}
              <div className="space-y-3">
                <h4 className="text-xs font-mono uppercase tracking-wider text-[var(--color-muted)]">
                  Environment Configuration Status
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-xs">
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
                      className="flex items-center justify-between border border-[var(--color-border)] bg-[var(--color-bg)] p-2.5 rounded"
                    >
                      <span className="text-[var(--color-text)] truncate">{item.key}</span>
                      <span
                        className={`text-[11px] ml-2 font-medium ${
                          item.val ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {item.val ? '✓ Set' : '✗ Missing'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Manual Firebase Config Override */}
              <div className="border border-[var(--color-border)] bg-[var(--color-bg)] p-4 rounded-lg space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h5 className="text-xs font-mono font-medium text-[var(--color-text)]">
                      Manual Firebase Configuration
                    </h5>
                    <p className="text-[11px] text-[var(--color-muted)]">
                      Overrides credentials directly in local browser storage if Vercel environment variables are not yet propagated.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSaveFirebaseConfig}
                      className="btn-primary px-3 py-1 text-xs font-mono rounded cursor-pointer"
                    >
                      Save Override
                    </button>
                    <button
                      type="button"
                      onClick={handleResetFirebaseConfig}
                      className="btn-secondary px-3 py-1 text-xs font-mono rounded cursor-pointer"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                  <div>
                    <label className="block text-[var(--color-muted)] mb-1">API Key</label>
                    <input
                      type="text"
                      placeholder="AIzaSy..."
                      value={configDraft.apiKey}
                      onChange={(e) => setConfigDraft({ ...configDraft, apiKey: e.target.value.trim() })}
                      className="w-full border border-[var(--color-border)] bg-[var(--color-panel)] px-2.5 py-1.5 text-xs text-[var(--color-text)] rounded focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[var(--color-muted)] mb-1">Project ID</label>
                    <input
                      type="text"
                      placeholder="myportfolio-..."
                      value={configDraft.projectId}
                      onChange={(e) => setConfigDraft({ ...configDraft, projectId: e.target.value.trim() })}
                      className="w-full border border-[var(--color-border)] bg-[var(--color-panel)] px-2.5 py-1.5 text-xs text-[var(--color-text)] rounded focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Recommended Firestore Security Rules */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-mono uppercase tracking-wider text-[var(--color-muted)]">
                    Recommended Firestore Security Rules
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      const rules = `rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /portfolio/{document} {\n      allow read, write: if true;\n    }\n    match /ai_chats/{document} {\n      allow read, write: if true;\n    }\n  }\n}`
                      navigator.clipboard.writeText(rules)
                      alert('Firestore rules copied to clipboard!')
                    }}
                    className="text-xs font-mono text-[var(--color-text)] underline cursor-pointer"
                  >
                    Copy Rules
                  </button>
                </div>
                <p className="text-xs text-[var(--color-muted)]">
                  Paste these rules in your Firebase Console under <strong>Firestore Database → Rules</strong>:
                </p>
                <pre className="overflow-auto border border-[var(--color-border)] bg-[var(--color-bg)] p-4 text-xs font-mono text-[var(--color-text)] leading-relaxed rounded">
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Portfolio content: readable by everyone, editable by admin
    match /portfolio/{document} {
      allow read: if true;
      allow write: if true;
    }

    // AI Chat Sessions: visitors can log chats, admin can view & delete
    match /ai_chats/{document} {
      allow read, write: if true;
    }
  }
}`}
                </pre>
              </div>
            </div>
          )}

          {/* ================= TAB 5: RAW BACKUP & JSON ================= */}
          {currentTab === 'backup' && (
            <div className="border border-[var(--color-border)] bg-[var(--color-panel)] p-6 rounded-lg space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-[var(--color-text)]">
                    Raw JSON Snapshot
                  </h3>
                  <p className="text-xs font-mono text-[var(--color-muted)] mt-1">
                    Download or copy the raw JSON configuration for safe offline backups or version control.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(data, null, 2))
                      alert('JSON configuration copied to clipboard!')
                    }}
                    className="btn-secondary px-3 py-1.5 text-xs font-mono cursor-pointer rounded"
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
                    className="btn-primary px-3 py-1.5 text-xs font-mono cursor-pointer rounded"
                  >
                    Download .json
                  </button>
                </div>
              </div>

              <pre className="max-h-96 overflow-auto border border-[var(--color-border)] bg-[var(--color-bg)] p-4 text-xs font-mono text-[var(--color-text)] leading-relaxed rounded">
                {JSON.stringify(data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </main>

      {/* ================= MODAL: QUICK AI REPO IMPORT ================= */}
      {showAiImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-bg)]/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-6 rounded-lg shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400 text-xs font-mono">
                  ⚡
                </span>
                <h3 className="text-base font-semibold text-[var(--color-text)]">
                  Import Project from GitHub
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAiImportModal(false)}
                className="text-xs font-mono text-[var(--color-muted)] hover:text-[var(--color-text)] cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            <p className="text-xs text-[var(--color-muted)] leading-relaxed">
              Paste the public repository URL. Swirl AI will fetch its README, inspect the tech stack and code architecture, and automatically write a complete portfolio project entry for you.
            </p>

            <div className="space-y-3 font-mono text-xs">
              <div>
                <label className="block text-[var(--color-muted)] mb-1">GitHub Repository Link *</label>
                <input
                  type="text"
                  autoFocus
                  placeholder="https://github.com/owner/repository"
                  value={aiRepoUrl}
                  onChange={(e) => setAiRepoUrl(e.target.value)}
                  className="w-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-text)] focus:border-indigo-500 focus:outline-none rounded"
                />
              </div>

              <div>
                <label className="block text-[var(--color-muted)] mb-1">
                  Optional Guidance for AI (e.g. emphasize Android, or focus on vector engine)
                </label>
                <input
                  type="text"
                  placeholder="Optional custom instructions..."
                  value={aiCustomInstructions}
                  onChange={(e) => setAiCustomInstructions(e.target.value)}
                  className="w-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-text)] focus:border-indigo-500 focus:outline-none rounded"
                />
              </div>

              {aiStatusMessage && (
                <div className="text-xs font-mono text-indigo-400 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
                  <span>{aiStatusMessage}</span>
                </div>
              )}

              {aiError && (
                <div className="text-xs font-mono text-red-400 border border-red-500/20 bg-red-500/10 p-2.5 rounded">
                  {aiError}
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  disabled={isGeneratingAi || !aiRepoUrl.trim()}
                  onClick={() => handleAiAutofill()}
                  className="btn-primary bg-indigo-600 hover:bg-indigo-700 text-white flex-1 py-2.5 font-mono text-xs cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 rounded"
                >
                  {isGeneratingAi ? (
                    <>
                      <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      <span>Writing with AI...</span>
                    </>
                  ) : (
                    <>
                      <span>✨ Generate with Swirl AI</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAiImportModal(false)}
                  className="btn-secondary px-4 py-2.5 font-mono text-xs cursor-pointer rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
