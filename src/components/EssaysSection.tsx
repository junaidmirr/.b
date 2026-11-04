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

// Render markdown snippet
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
        <div key={idx} className="my-4 overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-4 font-mono text-xs leading-relaxed text-[var(--color-text)]">
          <pre><code>{codeLines}</code></pre>
        </div>
      )
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const items = trimmed.split('\n').filter((l) => l.trim().length > 0)
      return (
        <ul key={idx} className="my-3 space-y-1.5 pl-5 list-disc text-xs sm:text-sm text-[var(--color-text)] leading-relaxed">
          {items.map((it, i) => (
            <li key={i}>{it.replace(/^[-*]\s+/, '')}</li>
          ))}
        </ul>
      )
    }

    return (
      <p
        key={idx}
        className="my-3 text-xs sm:text-sm text-[var(--color-text)] leading-relaxed font-sans opacity-95"
      >
        {trimmed}
      </p>
    )
  })
}

export function EssaysSection({ essays }: EssaysSectionProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [activeEssay, setActiveEssay] = useState<Essay | null>(null)
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

  // ESC to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeEssay) {
        setActiveEssay(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeEssay])

  // Open essay & record view
  const handleOpenEssay = (essay: Essay) => {
    setActiveEssay(essay)
    recordEssayView(essay.id)

    // Optimistically increment view count
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

  const handleShare = (essay: Essay) => {
    const url = `${window.location.origin}/#essay-${essay.slug || essay.id}`
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        setCopiedShare(true)
        setTimeout(() => setCopiedShare(false), 2000)
      })
    }
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

  return (
    <section id="essays" className="mb-20 scroll-mt-20">
      {/* Section Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <span className="font-mono text-xs uppercase tracking-wider text-[var(--color-muted)]">
            02.5 / Perspectives & Writing
          </span>
          <div className="h-px flex-1 bg-[var(--color-border)] opacity-60" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--color-text)]">
          Technical Essays & Notes
        </h2>
        <p className="mt-2 text-xs sm:text-sm leading-relaxed text-[var(--color-muted)] max-w-2xl">
          Deep dives into system architecture, developer tooling friction, AST parsing, and spatial algorithms. Includes live analytics and open discussion.
        </p>
      </div>

      {/* Category Pills */}
      {categories.length > 2 && (
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 text-xs font-mono rounded-full border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[var(--color-text)] bg-[var(--color-text)] text-[var(--color-bg)] font-medium shadow-xs'
                    : 'border-[var(--color-border)] bg-[var(--color-panel)] text-[var(--color-muted)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-text)]'
                }`}
              >
                {cat}
              </button>
            )
          })}
        </div>
      )}

      {/* Essays Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {filteredEssays.map((essay) => {
          const stats = interactions[essay.id] || { views: 0, likes: 0, comments: [] }
          const isLiked = Boolean(likedMap[essay.id])
          const commentsCount = stats.comments?.length || 0

          return (
            <article
              key={essay.id}
              onClick={() => handleOpenEssay(essay)}
              className="group relative flex flex-col justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--color-border-hover)] hover:shadow-sm cursor-pointer"
            >
              <div>
                {/* Meta Header */}
                <div className="flex items-center justify-between text-[11px] font-mono text-[var(--color-muted)] mb-3">
                  <span className="px-2 py-0.5 rounded border border-[var(--color-border)] bg-[var(--color-bg)] uppercase tracking-wider text-[10px]">
                    {essay.category}
                  </span>
                  <span>{essay.readingTime || '4 min read'}</span>
                </div>

                {/* Optional Attached Cover Image Thumbnail */}
                {essay.coverImage && (
                  <div className="mb-3.5 overflow-hidden rounded-lg border border-[var(--color-border)] aspect-video bg-[var(--color-bg)]">
                    <img
                      src={essay.coverImage}
                      alt={essay.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                )}

                {/* Title */}
                <h3 className="text-base font-semibold leading-snug tracking-tight text-[var(--color-text)] transition-colors group-hover:text-blue-400">
                  {essay.title}
                </h3>

                {/* Excerpt */}
                <p className="mt-2 text-xs leading-relaxed text-[var(--color-muted)] line-clamp-3">
                  {essay.excerpt}
                </p>

                {/* Attached Link Badge */}
                {essay.externalLink && (
                  <div className="mt-3 flex items-center gap-1.5 text-[11px] font-mono text-[var(--color-muted)] group-hover:text-[var(--color-text)]">
                    <span className="text-xs">🔗</span>
                    <span className="truncate">{essay.externalLinkLabel || 'Attached Resource'}</span>
                  </div>
                )}
              </div>

              {/* Card Footer: Live Counters */}
              <div className="mt-5 pt-3.5 border-t border-[var(--color-border)] flex items-center justify-between text-[11px] font-mono text-[var(--color-muted)]">
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
                    className={`flex items-center gap-1 transition-colors cursor-pointer hover:text-red-400 ${
                      isLiked ? 'text-red-400 font-medium' : ''
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

                <span className="text-[11px] font-mono text-[var(--color-text)] group-hover:translate-x-0.5 transition-transform">
                  Read →
                </span>
              </div>
            </article>
          )
        })}
      </div>

      {/* ================= FULL ESSAY READER MODAL ================= */}
      {activeEssay && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setActiveEssay(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative flex flex-col w-full max-w-3xl max-h-[92vh] rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] shadow-2xl overflow-hidden text-left"
          >
            {/* Modal Top Bar */}
            <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg)]/80 px-6 py-4 backdrop-blur-md">
              <div className="flex items-center gap-2 text-xs font-mono text-[var(--color-muted)]">
                <span className="px-2 py-0.5 rounded border border-[var(--color-border)] uppercase tracking-wider text-[10px]">
                  {activeEssay.category}
                </span>
                <span>•</span>
                <span>{activeEssay.date}</span>
                <span>•</span>
                <span>{activeEssay.readingTime}</span>
              </div>

              <button
                type="button"
                onClick={() => setActiveEssay(null)}
                aria-label="Close reader"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] transition-colors hover:border-[var(--color-border-hover)] hover:text-[var(--color-text)] cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-6 sm:px-10 py-6 sm:py-8 space-y-6">
              {/* Essay Title */}
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--color-text)] leading-tight">
                  {activeEssay.title}
                </h1>
                <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)] font-mono border-l-2 border-[var(--color-border-hover)] pl-3">
                  {activeEssay.excerpt}
                </p>
              </div>

              {/* Attached Cover / Architecture Visual */}
              {activeEssay.coverImage && (
                <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]">
                  <img
                    src={activeEssay.coverImage}
                    alt={activeEssay.title}
                    className="w-full max-h-[380px] object-cover"
                  />
                </div>
              )}

              {/* Attached External Link Banner */}
              {activeEssay.externalLink && (
                <a
                  href={activeEssay.externalLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3.5 text-xs font-mono text-[var(--color-text)] transition-all hover:border-[var(--color-border-hover)] hover:bg-[var(--color-surface)]"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">🔗</span>
                    <div>
                      <p className="font-semibold">{activeEssay.externalLinkLabel || 'Attached Resource'}</p>
                      <p className="text-[10px] text-[var(--color-muted)] truncate max-w-md">{activeEssay.externalLink}</p>
                    </div>
                  </div>
                  <span className="text-xs text-[var(--color-muted)]">Open ↗</span>
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
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-xs font-mono transition-all cursor-pointer ${
                      likedMap[activeEssay.id]
                        ? 'border-red-500/50 bg-red-500/10 text-red-400 font-semibold'
                        : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] hover:border-red-500/40 hover:text-red-400'
                    }`}
                  >
                    <svg className="w-4 h-4" fill={likedMap[activeEssay.id] ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    <span>{likedMap[activeEssay.id] ? 'Liked' : 'Like'}</span>
                    <span className="opacity-70">({activeStats?.likes || 0})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleShare(activeEssay)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-xs font-mono text-[var(--color-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-hover)] cursor-pointer"
                  >
                    <span>{copiedShare ? '✓ Copied' : 'Share ↗'}</span>
                  </button>
                </div>

                <div className="text-xs font-mono text-[var(--color-muted)]">
                  👁 <strong className="text-[var(--color-text)]">{activeStats?.views || 0}</strong> views
                </div>
              </div>

              {/* ================= COMMENTS & DISCUSSION ================= */}
              <div className="mt-8 pt-6 border-t border-[var(--color-border)] space-y-5">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold tracking-tight text-[var(--color-text)] font-mono">
                    Discussion ({activeStats?.comments?.length || 0})
                  </h4>
                  <span className="text-[11px] font-mono text-[var(--color-muted)]">
                    Share your technical perspective
                  </span>
                </div>

                {/* Comment Form */}
                <form onSubmit={handleCommentSubmit} className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
                  <div>
                    <input
                      type="text"
                      placeholder="Your name or handle (e.g. Alex or @dev)"
                      value={authorName}
                      onChange={(e) => setAuthorName(e.target.value)}
                      maxLength={50}
                      className="w-full rounded border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-1.5 text-xs font-mono text-[var(--color-text)] placeholder-[var(--color-muted)] focus:outline-none focus:border-[var(--color-text)]"
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
                      className="w-full rounded border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 text-xs font-sans text-[var(--color-text)] placeholder-[var(--color-muted)] focus:outline-none focus:border-[var(--color-text)] resize-none"
                    />
                  </div>

                  {commentError && (
                    <p className="text-[11px] font-mono text-red-400">{commentError}</p>
                  )}

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="submit"
                      disabled={isSubmittingComment || !commentText.trim()}
                      className="btn-primary px-4 py-1.5 text-xs font-mono cursor-pointer disabled:opacity-50"
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
                        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/60 p-3.5 space-y-1.5 text-left"
                      >
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="font-semibold text-[var(--color-text)]">
                            {c.authorName || 'Anonymous Reader'}
                          </span>
                          <span className="text-[10px] text-[var(--color-muted)]">
                            {new Date(c.createdAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed text-[var(--color-text)] whitespace-pre-wrap">
                          {c.content}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="p-6 text-center text-xs font-mono text-[var(--color-muted)] rounded-lg border border-dashed border-[var(--color-border)]">
                      No comments yet. Start the conversation above!
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
