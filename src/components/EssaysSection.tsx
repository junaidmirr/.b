import { useState, useEffect, useMemo, type FormEvent } from 'react'
import type { Essay } from '../types'
import {
  fetchEssayInteractions,
  recordEssayView,
  toggleEssayLike,
  hasLikedEssay,
  submitEssayComment,
  type EssayInteractionsMap,
} from '../services/essayService'

type EssaysSectionProps = {
  essays: Essay[]
}

// Render markdown snippet with Apple Books typography
export const renderEssayMarkdown = (text: string) => {
  const paragraphs = text.split('\n\n')
  return paragraphs.map((block, idx) => {
    const trimmed = block.trim()

    if (trimmed.startsWith('### ')) {
      return (
        <h3
          key={idx}
          className="mt-6 mb-3 text-lg font-semibold tracking-tight text-[var(--color-text)]"
        >
          {trimmed.replace(/^###\s+/, '')}
        </h3>
      )
    }

    if (trimmed.startsWith('## ')) {
      return (
        <h2
          key={idx}
          className="mt-8 mb-4 text-xl font-bold tracking-tight text-[var(--color-text)]"
        >
          {trimmed.replace(/^##\s+/, '')}
        </h2>
      )
    }

    if (trimmed.startsWith('```')) {
      const lines = trimmed.split('\n')
      const codeLines = lines.slice(1, -1).join('\n')
      return (
        <div key={idx} className="my-5 overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] p-4 font-mono text-xs leading-relaxed text-[var(--color-text)]">
          <pre><code>{codeLines}</code></pre>
        </div>
      )
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const items = trimmed.split('\n').filter((l) => l.trim().length > 0)
      return (
        <ul key={idx} className="my-3 space-y-2 pl-5 list-disc text-sm text-[var(--color-text-secondary)] leading-relaxed">
          {items.map((it, i) => (
            <li key={i}>{it.replace(/^[-*]\s+/, '')}</li>
          ))}
        </ul>
      )
    }

    return (
      <p
        key={idx}
        className="my-3.5 text-sm sm:text-base text-[var(--color-text-secondary)] leading-relaxed font-sans"
      >
        {trimmed}
      </p>
    )
  })
}

export function EssaysSection({ essays }: EssaysSectionProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [activeEssay, setActiveEssay] = useState<Essay | null>(null)
  const [viewMode, setViewMode] = useState<'modal' | 'full'>('modal')
  const [interactions, setInteractions] = useState<EssayInteractionsMap>({})
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({})

  // Comment form state
  const [authorName, setAuthorName] = useState('')
  const [commentText, setCommentText] = useState('')
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [commentError, setCommentError] = useState('')
  const [copiedShare, setCopiedShare] = useState(false)

  // Fetch live views, likes, and comments
  useEffect(() => {
    fetchEssayInteractions().then((data) => {
      setInteractions(data)
    })
  }, [])

  // Sync liked state from local storage
  useEffect(() => {
    const map: Record<string, boolean> = {}
    for (const e of essays) {
      map[e.id] = hasLikedEssay(e.id)
    }
    setLikedMap(map)
  }, [essays])

  // ESC to close modal or full page view
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeEssay) {
        handleCloseEssay()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeEssay])

  // Listen to URL query params, path, and hash to automatically open shared essays
  useEffect(() => {
    const handleUrlCheck = () => {
      if (typeof window === 'undefined') return

      let targetSlug = ''
      let targetFullView = false

      // 1. Check Query Params (?essay=slug&view=full)
      const urlParams = new URLSearchParams(window.location.search)
      const queryEssay = urlParams.get('essay')
      if (queryEssay) {
        targetSlug = decodeURIComponent(queryEssay)
        if (urlParams.get('view') === 'full') {
          targetFullView = true
        }
      }

      // 2. Check Path (/essay/slug or /essays/slug)
      if (!targetSlug) {
        const path = window.location.pathname
        if (path.startsWith('/essay/')) {
          targetSlug = decodeURIComponent(path.replace(/^\/essay\//, '').replace(/\/+$/, ''))
          targetFullView = true
        } else if (path.startsWith('/essays/')) {
          targetSlug = decodeURIComponent(path.replace(/^\/essays\//, '').replace(/\/+$/, ''))
          targetFullView = true
        }
      }

      // 3. Check Hash (#essay-slug or #essay/slug)
      if (!targetSlug && window.location.hash) {
        const hash = window.location.hash
        if (hash.startsWith('#essay-')) {
          targetSlug = decodeURIComponent(hash.replace(/^#essay-/, ''))
        } else if (hash.startsWith('#essay/')) {
          targetSlug = decodeURIComponent(hash.replace(/^#essay\//, ''))
        }
      }

      if (targetSlug && essays.length > 0) {
        const matched = essays.find(
          (e) =>
            e.slug?.toLowerCase() === targetSlug.toLowerCase() ||
            e.id.toLowerCase() === targetSlug.toLowerCase()
        )
        if (matched) {
          setActiveEssay(matched)
          setViewMode(targetFullView ? 'full' : 'modal')
          // Trigger view count increment
          recordEssayView(matched.id)
          setInteractions((prev) => {
            const current = prev[matched.id] || { essayId: matched.id, views: 0, likes: 0, comments: [] }
            return {
              ...prev,
              [matched.id]: {
                ...current,
                views: (current.views || 0) + 1,
              },
            }
          })
        }
      }
    }

    handleUrlCheck()
    window.addEventListener('popstate', handleUrlCheck)
    window.addEventListener('hashchange', handleUrlCheck)
    return () => {
      window.removeEventListener('popstate', handleUrlCheck)
      window.removeEventListener('hashchange', handleUrlCheck)
    }
  }, [essays])

  // Open an essay
  const handleOpenEssay = (essay: Essay, mode: 'modal' | 'full' = 'modal') => {
    setActiveEssay(essay)
    setViewMode(mode)

    // Update URL query state cleanly without full reload
    try {
      const modeParam = mode === 'full' ? '&view=full' : ''
      const newUrl = `${window.location.origin}/?essay=${encodeURIComponent(essay.slug || essay.id)}${modeParam}`
      window.history.pushState(null, '', newUrl)
    } catch {}

    // Record view in background
    recordEssayView(essay.id)
    setInteractions((prev) => {
      const current = prev[essay.id] || { essayId: essay.id, views: 0, likes: 0, comments: [] }
      return {
        ...prev,
        [essay.id]: {
          ...current,
          views: (current.views || 0) + 1,
        },
      }
    })
  }

  // Close essay and restore URL cleanly
  const handleCloseEssay = () => {
    setActiveEssay(null)
    try {
      const cleanPath = window.location.pathname.startsWith('/essay') ? '/' : window.location.pathname
      window.history.pushState(null, '', `${cleanPath}#essays`)
    } catch {}
  }

  // Handle like toggle
  const handleLike = async (essayId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const wasLiked = likedMap[essayId]
    const delta = wasLiked ? -1 : 1

    // Optimistic UI update
    setLikedMap((prev) => ({ ...prev, [essayId]: !wasLiked }))
    setInteractions((prev) => {
      const current = prev[essayId] || { essayId, views: 0, likes: 0, comments: [] }
      return {
        ...prev,
        [essayId]: {
          ...current,
          likes: Math.max(0, (current.likes || 0) + delta),
        },
      }
    })

    const res = await toggleEssayLike(essayId)
    if (res.newCount !== undefined) {
      setInteractions((prev) => {
        const current = prev[essayId] || { essayId, views: 0, likes: 0, comments: [] }
        return {
          ...prev,
          [essayId]: {
            ...current,
            likes: res.newCount!,
          },
        }
      })
    }
  }

  // Handle comment submit
  const handleCommentSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!activeEssay || !commentText.trim() || isSubmittingComment) return

    setIsSubmittingComment(true)
    setCommentError('')

    try {
      const newComment = await submitEssayComment(activeEssay.id, authorName, commentText)
      if (newComment) {
        setInteractions((prev) => {
          const current = prev[activeEssay.id] || { essayId: activeEssay.id, views: 0, likes: 0, comments: [] }
          return {
            ...prev,
            [activeEssay.id]: {
              ...current,
              comments: [newComment, ...(current.comments || [])],
            },
          }
        })
        setCommentText('')
      }
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : 'Could not submit comment.')
    } finally {
      setIsSubmittingComment(false)
    }
  }

  // Share essay link with mobile native share or clipboard feedback
  const handleShare = async (essay: Essay, mode: 'modal' | 'full' = viewMode) => {
    const isFull = mode === 'full'
    const url = `${window.location.origin}/?essay=${encodeURIComponent(essay.slug || essay.id)}${isFull ? '&view=full' : ''}`

    // Try Web Share API on mobile phones
    if (navigator.share && /mobile|android|iphone|ipad|ipod/i.test(navigator.userAgent)) {
      try {
        await navigator.share({
          title: essay.title,
          text: essay.excerpt,
          url: url,
        })
        return
      } catch {}
    }

    // Fallback to clipboard
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url)
      } else {
        const el = document.createElement('textarea')
        el.value = url
        document.body.appendChild(el)
        el.select()
        document.execCommand('copy')
        document.body.removeChild(el)
      }
      setCopiedShare(true)
      setTimeout(() => setCopiedShare(false), 2200)
    } catch {}
  }

  // Categories
  const categories = useMemo(() => {
    const set = new Set<string>(['All'])
    for (const e of essays) {
      if (e.category) set.add(e.category)
    }
    return Array.from(set)
  }, [essays])

  // Filtered essays
  const filteredEssays = useMemo(() => {
    if (selectedCategory === 'All') return essays
    return essays.filter((e) => e.category === selectedCategory)
  }, [essays, selectedCategory])

  const activeStats = activeEssay ? interactions[activeEssay.id] || { views: 0, likes: 0, comments: [] } : null

  // Reusable essay body content for both full-page and modal views
  const renderEssayBody = (isFullPage: boolean) => {
    if (!activeEssay) return null

    return (
      <div className="space-y-6">
        {/* Breadcrumb row for full page view */}
        {isFullPage && (
          <div className="flex items-center gap-2 text-xs text-[var(--color-muted)] font-medium">
            <button
              type="button"
              onClick={handleCloseEssay}
              className="hover:text-[var(--color-text)] cursor-pointer tap-spring"
            >
              Portfolio
            </button>
            <span>/</span>
            <span>Essays</span>
            <span>/</span>
            <span className="text-[var(--color-text)]">{activeEssay.category}</span>
          </div>
        )}

        {/* Essay Title */}
        <div>
          <h1
            className={`${
              isFullPage ? 'text-3xl sm:text-4xl lg:text-5xl' : 'text-2xl sm:text-3xl'
            } font-semibold tracking-tight text-[var(--color-text)] leading-[1.18]`}
          >
            {activeEssay.title}
          </h1>
          <p className="mt-3.5 text-sm sm:text-base leading-relaxed text-[var(--color-text-secondary)] border-l-2 border-blue-500/50 pl-3.5">
            {activeEssay.excerpt}
          </p>

          {isFullPage && (
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-[var(--color-muted)] border-t border-[var(--color-border)] pt-3 font-medium">
              <span className="font-semibold text-[var(--color-text)]">Junaid</span>
              <span>•</span>
              <span>{activeEssay.date}</span>
              <span>•</span>
              <span>{activeEssay.readingTime}</span>
              <span>•</span>
              <span>👁️ {activeStats?.views || 0} views</span>
            </div>
          )}
        </div>

        {/* Attached Cover / Architecture Visual */}
        {activeEssay.coverImage && (
          <div className="overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg)]">
            <img
              src={activeEssay.coverImage}
              alt={activeEssay.title}
              className={`w-full ${isFullPage ? 'max-h-[520px]' : 'max-h-[380px]'} object-cover`}
            />
          </div>
        )}

        {/* Attached External Link Banner */}
        {activeEssay.externalLink && (
          <a
            href={activeEssay.externalLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] p-4 text-xs text-[var(--color-text)] transition-all hover:border-[var(--color-border-hover)] tap-spring"
          >
            <div className="flex items-center gap-2.5">
              <span className="text-base">🔗</span>
              <div>
                <p className="font-semibold">
                  {activeEssay.externalLinkLabel || 'Attached Resource'}
                </p>
                <p className="text-[11px] text-[var(--color-muted)] truncate max-w-md">
                  {activeEssay.externalLink}
                </p>
              </div>
            </div>
            <span className="text-xs text-[var(--color-muted)] font-medium">Open ↗</span>
          </a>
        )}

        {/* Markdown Body Content */}
        <div className="border-t border-[var(--color-border)] pt-4">
          {renderEssayMarkdown(activeEssay.content)}
        </div>

        {/* Engagement Bar */}
        <div className="mt-8 pt-4 border-t border-[var(--color-border)] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleLike(activeEssay.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-medium transition-all tap-spring cursor-pointer ${
                likedMap[activeEssay.id]
                  ? 'border-red-500/50 bg-red-500/10 text-red-500 font-semibold'
                  : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:border-red-500/40 hover:text-red-500'
              }`}
            >
              <svg
                className="w-4 h-4"
                fill={likedMap[activeEssay.id] ? 'currentColor' : 'none'}
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
              <span>{likedMap[activeEssay.id] ? 'Liked' : 'Like'}</span>
              <span className="opacity-70">({activeStats?.likes || 0})</span>
            </button>

            <button
              type="button"
              onClick={() => handleShare(activeEssay, isFullPage ? 'full' : 'modal')}
              className="flex items-center gap-2 px-3.5 py-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-hover)] tap-spring cursor-pointer"
            >
              <span>{copiedShare ? '✓ Link Copied' : 'Share ↗'}</span>
            </button>
          </div>

          <div className="text-xs text-[var(--color-muted)] font-medium">
            <span>👁️ {activeStats?.views || 0} total reads</span>
          </div>
        </div>

        {/* Reader Discussion / Comments Section */}
        <div className="mt-8 pt-6 border-t border-[var(--color-border)] space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-[var(--color-text)] tracking-tight">
              Discussion & Reader Notes ({activeStats?.comments?.length || 0})
            </h3>
            <span className="text-xs text-[var(--color-muted)]">Open to everyone</span>
          </div>

          {/* Comment Form */}
          <form onSubmit={handleCommentSubmit} className="space-y-3 rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <div>
              <input
                type="text"
                placeholder="Your name or handle (optional)"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                maxLength={50}
                className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-2 text-xs text-[var(--color-text)] placeholder-[var(--color-muted)] focus:outline-none focus:border-[var(--color-accent)] transition-all"
              />
            </div>

            <div>
              <textarea
                rows={3}
                placeholder="Write a comment or ask a question about this architecture..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                maxLength={1000}
                required
                className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-2.5 text-xs text-[var(--color-text)] placeholder-[var(--color-muted)] focus:outline-none focus:border-[var(--color-accent)] resize-none transition-all"
              />
            </div>

            {commentError && (
              <p className="text-xs text-red-500 font-medium">{commentError}</p>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="submit"
                disabled={isSubmittingComment || !commentText.trim()}
                className="btn-primary px-4 py-1.5 text-xs tap-spring cursor-pointer disabled:opacity-50"
              >
                {isSubmittingComment ? 'Posting...' : 'Post Comment'}
              </button>
            </div>
          </form>

          {/* Comments List */}
          <div className="space-y-3">
            {activeStats?.comments && activeStats.comments.length > 0 ? (
              activeStats.comments.map((c) => (
                <div
                  key={c.id}
                  className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-1.5 text-left"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[var(--color-text)]">
                      {c.authorName || 'Anonymous Reader'}
                    </span>
                    <span className="text-[11px] text-[var(--color-muted)]">
                      {new Date(c.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm leading-relaxed text-[var(--color-text-secondary)] whitespace-pre-wrap">
                    {c.content}
                  </p>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-xs text-[var(--color-muted)] rounded-2xl border border-dashed border-[var(--color-border)]">
                No comments yet. Start the conversation above!
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <section id="essays" className="mb-24 scroll-mt-24">
      {/* Section Header */}
      <div className="pb-6">
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-600 dark:text-blue-400">
          <span>Perspectives & Writing</span>
        </div>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--color-text)] sm:text-3xl">
          Technical Essays & Notes
        </h2>
        <p className="mt-1.5 text-sm sm:text-base text-[var(--color-muted)] max-w-2xl">
          Deep dives into system architecture, developer tooling friction, AST parsing, and spatial algorithms. Includes live analytics and open discussion.
        </p>
      </div>

      {/* Category Pills */}
      {categories.length > 2 && (
        <div className="mb-6 inline-flex flex-wrap items-center gap-1 rounded-full bg-black/[0.04] dark:bg-white/[0.06] p-1 text-xs border border-[var(--color-border)]">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-full px-3 py-1.5 transition-all tap-spring cursor-pointer ${
                  isSelected
                    ? 'filter-btn-active'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                {cat}
              </button>
            )
          })}
        </div>
      )}

      {/* Essays Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {filteredEssays.map((essay) => {
          const stats = interactions[essay.id] || { views: 0, likes: 0, comments: [] }
          const isLiked = Boolean(likedMap[essay.id])
          const commentsCount = stats.comments?.length || 0

          return (
            <article
              key={essay.id}
              onClick={() => handleOpenEssay(essay)}
              className="glass-card rounded-3xl p-6 flex flex-col justify-between group cursor-pointer tap-spring"
            >
              <div>
                {/* Meta Header */}
                <div className="flex items-center justify-between text-xs text-[var(--color-muted)] mb-3">
                  <span className="rounded-full bg-black/[0.04] dark:bg-white/[0.06] px-2.5 py-0.5 font-medium text-[var(--color-text-secondary)]">
                    {essay.category}
                  </span>
                  <span className="text-[11px] font-medium">{essay.readingTime || '4 min read'}</span>
                </div>

                {/* Optional Attached Cover Image Thumbnail */}
                {essay.coverImage && (
                  <div className="mb-4 overflow-hidden rounded-2xl aspect-video bg-black/[0.03] dark:bg-white/[0.03]">
                    <img
                      src={essay.coverImage}
                      alt={essay.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                )}

                {/* Title */}
                <h3 className="text-base font-semibold leading-snug tracking-tight text-[var(--color-text)] group-hover:text-blue-500 transition-colors">
                  {essay.title}
                </h3>

                {/* Excerpt */}
                <p className="mt-2.5 text-xs sm:text-sm leading-relaxed text-[var(--color-text-secondary)] line-clamp-3">
                  {essay.excerpt}
                </p>

                {/* Attached Link Badge */}
                {essay.externalLink && (
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-[var(--color-muted)] group-hover:text-[var(--color-text)]">
                    <span className="text-xs">🔗</span>
                    <span className="truncate">{essay.externalLinkLabel || 'Attached Resource'}</span>
                  </div>
                )}
              </div>

              {/* Card Footer: Live Counters */}
              <div className="mt-5 pt-3.5 border-t border-[var(--color-border)] flex items-center justify-between text-xs text-[var(--color-muted)]">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1" title="Total views">
                    <svg className="w-3.5 h-3.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    {stats.views || 0}
                  </span>

                  <button
                    type="button"
                    onClick={(e) => handleLike(essay.id, e)}
                    title={isLiked ? 'Unlike' : 'Like'}
                    className={`flex items-center gap-1 transition-colors cursor-pointer hover:text-red-500 ${
                      isLiked ? 'text-red-500 font-medium' : ''
                    }`}
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill={isLiked ? 'currentColor' : 'none'}
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    {stats.likes || 0}
                  </button>

                  <span className="flex items-center gap-1" title="Comments">
                    <svg className="w-3.5 h-3.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    {commentsCount}
                  </span>
                </div>

                <div className="flex items-center gap-2.5">
                  <span className="text-xs text-[var(--color-text)] group-hover:translate-x-0.5 transition-transform font-medium">
                    Read →
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleOpenEssay(essay, 'full')
                    }}
                    title="Open in full page view"
                    className="hidden sm:inline-flex items-center gap-1 text-[11px] text-[var(--color-muted)] hover:text-[var(--color-text)] underline underline-offset-4 cursor-pointer"
                  >
                    <span>Full page</span>
                    <span>↗</span>
                  </button>
                </div>
              </div>
            </article>
          )
        })}
      </div>

      {/* ================= FULL PAGE ESSAY VIEW ================= */}
      {activeEssay && viewMode === 'full' && (
        <div
          role="region"
          aria-label={activeEssay.title}
          className="fixed inset-0 z-50 overflow-y-auto bg-[var(--color-bg)] text-[var(--color-text)] transition-colors duration-200"
        >
          {/* Top Sticky Header */}
          <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-surface)]/85 backdrop-blur-xl">
            <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3.5">
              <button
                type="button"
                onClick={handleCloseEssay}
                className="group flex items-center gap-2 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] cursor-pointer transition-colors tap-spring font-medium"
              >
                <span className="transition-transform group-hover:-translate-x-1">←</span>
                <span>Back to Portfolio</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('modal')
                    try {
                      const url = `${window.location.origin}/?essay=${encodeURIComponent(activeEssay.slug || activeEssay.id)}`
                      window.history.replaceState(null, '', url)
                    } catch {}
                  }}
                  title="Switch to compact modal view"
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-hover)] cursor-pointer transition-colors tap-spring font-medium"
                >
                  <span>⤡</span>
                  <span>Compact Modal</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleLike(activeEssay.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all tap-spring cursor-pointer ${
                    likedMap[activeEssay.id]
                      ? 'border-red-500/50 bg-red-500/10 text-red-500 font-semibold'
                      : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:border-red-500/40 hover:text-red-500'
                  }`}
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill={likedMap[activeEssay.id] ? 'currentColor' : 'none'}
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                    />
                  </svg>
                  <span>{activeStats?.likes || 0}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleShare(activeEssay, 'full')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-hover)] cursor-pointer transition-colors tap-spring font-medium"
                >
                  <span>{copiedShare ? '✓ Copied' : 'Share ↗'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCloseEssay}
                  aria-label="Close essay"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-text)] cursor-pointer transition-colors tap-spring"
                >
                  ✕
                </button>
              </div>
            </div>
          </header>

          {/* Full Page Reading Body */}
          <main className="mx-auto max-w-3xl px-6 py-10 sm:py-16 space-y-8">
            {renderEssayBody(true)}
          </main>
        </div>
      )}

      {/* ================= COMPACT ESSAY MODAL ================= */}
      {activeEssay && viewMode === 'modal' && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/50 backdrop-blur-md animate-in fade-in duration-200"
          onClick={handleCloseEssay}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative flex flex-col w-full max-w-3xl max-h-[92vh] rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl overflow-hidden text-left animate-in zoom-in-95 duration-200"
          >
            {/* Modal Top Bar */}
            <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)]/80 px-6 py-4 backdrop-blur-md">
              <div className="flex items-center gap-2 text-xs text-[var(--color-muted)] font-medium">
                <span className="rounded-full bg-black/[0.04] dark:bg-white/[0.06] px-2.5 py-0.5 text-xs text-[var(--color-text-secondary)]">
                  {activeEssay.category}
                </span>
                <span>•</span>
                <span>{activeEssay.date}</span>
                <span>•</span>
                <span>{activeEssay.readingTime}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('full')
                    try {
                      const url = `${window.location.origin}/?essay=${encodeURIComponent(activeEssay.slug || activeEssay.id)}&view=full`
                      window.history.replaceState(null, '', url)
                    } catch {}
                  }}
                  title="Expand to full page view"
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-[var(--color-border)] text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-hover)] cursor-pointer transition-colors tap-spring font-medium"
                >
                  <span>⤢</span>
                  <span className="hidden sm:inline">Full Page</span>
                </button>

                <button
                  type="button"
                  onClick={handleCloseEssay}
                  aria-label="Close reader"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-muted)] transition-colors hover:border-[var(--color-border-hover)] hover:text-[var(--color-text)] cursor-pointer tap-spring"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-6 sm:px-10 py-6 sm:py-8 space-y-6">
              {renderEssayBody(false)}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
