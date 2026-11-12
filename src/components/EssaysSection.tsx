import { useState, useEffect, type FormEvent } from 'react'
import type { Essay } from '../types'
import {
  subscribeToEssayInteractions,
  getCachedInteractions,
  recordEssayView,
  toggleEssayLike,
  hasLikedEssay,
  submitEssayComment,
  type EssayInteractionsMap,
} from '../services/essayService'

type EssaysSectionProps = {
  essays: Essay[]
}

// Render markdown content with restrained editorial journal typography
export const renderEssayMarkdown = (text: string) => {
  const paragraphs = text.split('\n\n')
  return paragraphs.map((block, idx) => {
    const trimmed = block.trim()

    if (trimmed.startsWith('### ')) {
      return (
        <h3
          key={idx}
          className="mt-8 mb-3 font-display text-xl font-medium tracking-tight text-[var(--color-text)]"
        >
          {trimmed.replace(/^###\s+/, '')}
        </h3>
      )
    }

    if (trimmed.startsWith('## ')) {
      return (
        <h2
          key={idx}
          className="mt-10 mb-4 font-display text-2xl font-medium tracking-tight text-[var(--color-text)]"
        >
          {trimmed.replace(/^##\s+/, '')}
        </h2>
      )
    }

    if (trimmed.startsWith('```')) {
      const lines = trimmed.split('\n')
      const codeLines = lines.slice(1, -1).join('\n')
      return (
        <div
          key={idx}
          className="my-6 overflow-x-auto border border-[var(--color-border)] bg-[var(--color-code-bg)] p-4 font-mono text-xs leading-relaxed text-[var(--color-text)]"
        >
          <pre><code>{codeLines}</code></pre>
        </div>
      )
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const items = trimmed.split('\n').filter((l) => l.trim().length > 0)
      return (
        <ul
          key={idx}
          className="my-4 space-y-2 pl-5 list-disc text-base text-[var(--color-text)] leading-relaxed marker:text-[var(--color-text-subtle)]"
        >
          {items.map((it, i) => (
            <li key={i}>{it.replace(/^[-*]\s+/, '')}</li>
          ))}
        </ul>
      )
    }

    return (
      <p
        key={idx}
        className="my-4 text-[17px] leading-[1.65] text-[var(--color-text)]"
      >
        {trimmed}
      </p>
    )
  })
}

export function EssaysSection({ essays }: EssaysSectionProps) {
  const [activeEssay, setActiveEssay] = useState<Essay | null>(null)
  const [viewMode, setViewMode] = useState<'modal' | 'full'>('modal')
  const [interactions, setInteractions] = useState<EssayInteractionsMap>(getCachedInteractions)
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({})

  // Comment form state
  const [authorName, setAuthorName] = useState('')
  const [commentText, setCommentText] = useState('')
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [commentError, setCommentError] = useState('')
  const [copiedShare, setCopiedShare] = useState(false)

  // Real-time synchronization of views, likes, and comments from Firebase & API
  useEffect(() => {
    const unsubscribe = subscribeToEssayInteractions((data) => {
      setInteractions((prev) => ({ ...prev, ...data }))
    })
    return () => unsubscribe()
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
          // Optimistically increment view count
          setInteractions((prev) => {
            const current = prev[matched.id] || { essayId: matched.id, views: 0, likes: 0, comments: [] }
            return {
              ...prev,
              [matched.id]: {
                ...current,
                views: (Number(current.views) || 0) + 1,
              },
            }
          })
          // Persist view to Firebase and update with authoritative count
          recordEssayView(matched.id).then((serverViews) => {
            if (typeof serverViews === 'number') {
              setInteractions((prev) => {
                const current = prev[matched.id] || { essayId: matched.id, views: 0, likes: 0, comments: [] }
                return {
                  ...prev,
                  [matched.id]: {
                    ...current,
                    views: serverViews,
                  },
                }
              })
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
  const handleOpenEssay = async (essay: Essay, mode: 'modal' | 'full' = 'modal') => {
    setActiveEssay(essay)
    setViewMode(mode)

    try {
      const modeParam = mode === 'full' ? '&view=full' : ''
      const newUrl = `${window.location.origin}/?essay=${encodeURIComponent(essay.slug || essay.id)}${modeParam}`
      window.history.pushState(null, '', newUrl)
    } catch {}

    // Optimistically update views locally
    setInteractions((prev) => {
      const current = prev[essay.id] || { essayId: essay.id, views: 0, likes: 0, comments: [] }
      return {
        ...prev,
        [essay.id]: {
          ...current,
          views: (Number(current.views) || 0) + 1,
        },
      }
    })

    // Record in Firebase & update state with verified count
    const serverViews = await recordEssayView(essay.id)
    if (typeof serverViews === 'number') {
      setInteractions((prev) => {
        const current = prev[essay.id] || { essayId: essay.id, views: 0, likes: 0, comments: [] }
        return {
          ...prev,
          [essay.id]: {
            ...current,
            views: serverViews,
          },
        }
      })
    }
  }

  // Close essay and restore URL cleanly
  const handleCloseEssay = () => {
    setActiveEssay(null)
    try {
      const cleanPath = window.location.pathname.startsWith('/essay') ? '/' : window.location.pathname
      window.history.pushState(null, '', `${cleanPath}#writing`)
    } catch {}
  }

  // Handle like toggle
  const handleLike = async (essayId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const wasLiked = likedMap[essayId]
    const delta = wasLiked ? -1 : 1

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

  // Share essay link with fallback to clipboard
  const handleShare = async (essay: Essay, mode: 'modal' | 'full' = viewMode) => {
    const isFull = mode === 'full'
    const url = `${window.location.origin}/?essay=${encodeURIComponent(essay.slug || essay.id)}${isFull ? '&view=full' : ''}`

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

  const activeStats = activeEssay ? interactions[activeEssay.id] || { views: 0, likes: 0, comments: [] } : null

  // Reusable essay body content for both full-page and modal views
  const renderEssayBody = (isFullPage: boolean) => {
    if (!activeEssay) return null

    return (
      <article className="max-w-[720px] mx-auto space-y-8">
        {/* Header Metadata */}
        <header className="border-b border-[var(--color-border)] pb-8 space-y-4">
          <div className="flex flex-wrap items-center gap-3 font-mono text-xs text-[var(--color-text-subtle)]">
            <span>{activeEssay.category}</span>
            <span>/</span>
            <span>{activeEssay.date || 'TODO: Supply date'}</span>
            <span>/</span>
            <span>{activeEssay.readingTime || '4 min read'}</span>
            {activeStats && activeStats.views > 0 && (
              <>
                <span>/</span>
                <span>{activeStats.views} views</span>
              </>
            )}
          </div>

          <h1
            className={`${
              isFullPage ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl'
            } font-display font-medium tracking-tight text-[var(--color-text)] leading-[1.18]`}
          >
            {activeEssay.title}
          </h1>

          <p className="text-base text-[var(--color-text-muted)] leading-relaxed italic">
            {activeEssay.excerpt}
          </p>

          {activeEssay.externalLink && (
            <div className="pt-2">
              <a
                href={activeEssay.externalLink}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs editorial-link"
              >
                {activeEssay.externalLinkLabel || 'External Reference'} [↗]
              </a>
            </div>
          )}
        </header>

        {/* Markdown Body */}
        <div className="prose-journal pt-2">
          {renderEssayMarkdown(activeEssay.content)}
        </div>

        {/* Discussion and Engagement Footer */}
        <footer className="border-t border-[var(--color-border)] pt-8 mt-12 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleLike(activeEssay.id)}
                className={`border border-[var(--color-border)] px-3 py-1.5 transition-colors cursor-pointer ${
                  likedMap[activeEssay.id]
                    ? 'border-[var(--color-accent)] text-[var(--color-accent)] font-medium'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-hover)]'
                }`}
              >
                {likedMap[activeEssay.id] ? 'Liked' : 'Like'}
                {activeStats && activeStats.likes > 0 ? ` (${activeStats.likes})` : ''}
              </button>

              <button
                type="button"
                onClick={() => handleShare(activeEssay, isFullPage ? 'full' : 'modal')}
                className="border border-[var(--color-border)] px-3 py-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-hover)] transition-colors cursor-pointer"
              >
                {copiedShare ? 'Link Copied' : 'Share Link'}
              </button>
            </div>

            <div className="text-[var(--color-text-subtle)]">
              Author: Junaid Mir
            </div>
          </div>

          {/* Reader Notes / Comments */}
          <section className="space-y-4 pt-4">
            <div className="flex items-baseline justify-between border-b border-[var(--color-border)] pb-2">
              <h3 className="font-display text-lg font-medium text-[var(--color-text)]">
                Discussion
              </h3>
              <span className="font-mono text-xs text-[var(--color-text-subtle)]">
                {activeStats?.comments?.length || 0} comments
              </span>
            </div>

            {/* Comment Form */}
            <form onSubmit={handleCommentSubmit} className="space-y-3">
              <div>
                <input
                  type="text"
                  placeholder="Your name or handle (optional)"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  maxLength={50}
                  className="w-full border border-[var(--color-border)] bg-[var(--color-code-bg)] px-3 py-2 text-xs font-mono text-[var(--color-text)] placeholder-[var(--color-text-subtle)] focus:outline-none focus:border-[var(--color-accent)]"
                />
              </div>

              <div>
                <textarea
                  rows={3}
                  placeholder="Leave a comment or question..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  maxLength={1000}
                  required
                  className="w-full border border-[var(--color-border)] bg-[var(--color-code-bg)] px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-text-subtle)] focus:outline-none focus:border-[var(--color-accent)] resize-y"
                />
              </div>

              {commentError && (
                <p className="font-mono text-xs text-[var(--color-accent)]">{commentError}</p>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmittingComment || !commentText.trim()}
                  className="border border-[var(--color-border)] px-4 py-1.5 font-mono text-xs text-[var(--color-text)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors disabled:opacity-40 cursor-pointer"
                >
                  {isSubmittingComment ? 'Submitting...' : 'Post Comment'}
                </button>
              </div>
            </form>

            {/* Existing Comments */}
            <div className="space-y-3 pt-2">
              {activeStats?.comments && activeStats.comments.length > 0 ? (
                activeStats.comments.map((c) => (
                  <div
                    key={c.id}
                    className="border-b border-[var(--color-border)] pb-3 space-y-1"
                  >
                    <div className="flex items-center justify-between font-mono text-xs">
                      <span className="font-medium text-[var(--color-text)]">
                        {c.authorName || 'Reader'}
                      </span>
                      <span className="text-[var(--color-text-subtle)] text-[11px]">
                        {new Date(c.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--color-text-muted)] leading-relaxed whitespace-pre-wrap">
                      {c.content}
                    </p>
                  </div>
                ))
              ) : (
                <p className="font-mono text-xs text-[var(--color-text-subtle)] pt-2">
                  No comments yet.
                </p>
              )}
            </div>
          </section>
        </footer>
      </article>
    )
  }

  return (
    <section id="writing" className="scroll-mt-16">
      {/* Section Header */}
      <div className="mb-6 flex items-baseline justify-between border-b border-[var(--color-border)] pb-3">
        <h2 className="font-display text-2xl sm:text-[28px] font-medium tracking-tight text-[var(--color-text)]">
          Writing
        </h2>
        <span className="font-mono text-xs text-[var(--color-text-subtle)]">
          {essays.length} essays
        </span>
      </div>

      {/* Text-Only List Rows */}
      <div className="divide-y divide-[var(--color-border)] border-b border-[var(--color-border)]">
        {essays.map((essay) => (
          <article
            key={essay.id}
            onClick={() => handleOpenEssay(essay)}
            className="journal-row group py-5 sm:py-6 cursor-pointer flex flex-col sm:flex-row sm:items-baseline justify-between gap-3 sm:gap-6"
          >
            {/* Title and Summary */}
            <div className="space-y-1.5 flex-1 min-w-0">
              <h3 className="text-lg font-medium tracking-tight text-[var(--color-text)] group-hover:text-[var(--color-accent)] transition-colors leading-snug">
                {essay.title}
              </h3>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed line-clamp-2 max-w-[620px]">
                {essay.excerpt}
              </p>
            </div>

            {/* Read Time & Date in Mono */}
            <div className="font-mono text-xs text-[var(--color-text-subtle)] shrink-0 flex sm:flex-col sm:items-end gap-2 sm:gap-1">
              <span>{essay.date || 'TODO: Date'}</span>
              <span className="text-[var(--color-border)] sm:hidden">/</span>
              <span>{essay.readingTime || '4 min'}</span>
            </div>
          </article>
        ))}
      </div>

      {/* Full Page Reading View */}
      {activeEssay && viewMode === 'full' && (
        <div
          role="region"
          aria-label={activeEssay.title}
          className="fixed inset-0 z-50 overflow-y-auto bg-[var(--color-bg)] text-[var(--color-text)]"
        >
          {/* Header Bar */}
          <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-bg)]/95">
            <div className="mx-auto flex max-w-[1040px] items-center justify-between px-6 py-4">
              <button
                type="button"
                onClick={handleCloseEssay}
                className="font-mono text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors cursor-pointer"
              >
                [← Back to portfolio]
              </button>

              <div className="flex items-center gap-3 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('modal')
                    try {
                      const url = `${window.location.origin}/?essay=${encodeURIComponent(activeEssay.slug || activeEssay.id)}`
                      window.history.replaceState(null, '', url)
                    } catch {}
                  }}
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer hidden sm:inline"
                >
                  [Compact view]
                </button>
                <button
                  type="button"
                  onClick={handleCloseEssay}
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors cursor-pointer px-1"
                  aria-label="Close"
                >
                  [Esc / Close]
                </button>
              </div>
            </div>
          </header>

          <main className="px-6 py-12 sm:py-16">
            {renderEssayBody(true)}
          </main>
        </div>
      )}

      {/* Compact Modal View */}
      {activeEssay && viewMode === 'modal' && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60"
          onClick={handleCloseEssay}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative flex flex-col w-full max-w-[800px] max-h-[90vh] border border-[var(--color-border)] bg-[var(--color-bg)] shadow-xl overflow-hidden text-left"
          >
            {/* Modal Top Bar */}
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-3.5 bg-[var(--color-bg)]">
              <span className="font-mono text-xs text-[var(--color-text-subtle)]">
                {activeEssay.category} / {activeEssay.readingTime}
              </span>

              <div className="flex items-center gap-3 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('full')
                    try {
                      const url = `${window.location.origin}/?essay=${encodeURIComponent(activeEssay.slug || activeEssay.id)}&view=full`
                      window.history.replaceState(null, '', url)
                    } catch {}
                  }}
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer hidden sm:inline"
                >
                  [Full page]
                </button>
                <button
                  type="button"
                  onClick={handleCloseEssay}
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  [Close]
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto px-6 sm:px-10 py-8">
              {renderEssayBody(false)}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
