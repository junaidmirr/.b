import type { EssayComment, EssayInteraction } from '../types'

const LIKED_STORAGE_KEY = 'junaid_liked_essays'
const VIEWED_SESSION_PREFIX = 'junaid_viewed_essay_'

export type EssayInteractionsMap = Record<string, EssayInteraction>

function getLikedEssayIds(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(LIKED_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    }
  } catch {}
  return []
}

function saveLikedEssayIds(ids: string[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LIKED_STORAGE_KEY, JSON.stringify(ids))
  } catch {}
}

export function hasLikedEssay(essayId: string): boolean {
  return getLikedEssayIds().includes(essayId)
}

/**
 * Fetches real-time views, likes, and comments for all essays
 */
export async function fetchEssayInteractions(): Promise<EssayInteractionsMap> {
  try {
    const res = await fetch('/api/essay-interactions')
    if (res.ok) {
      const data = await res.json()
      if (data.success && data.interactions) {
        return data.interactions
      }
    }
  } catch (err) {
    console.warn('Could not fetch essay interactions from API:', err)
  }
  return {}
}

/**
 * Records a page view for an essay (debounced per browser session)
 */
export async function recordEssayView(essayId: string): Promise<void> {
  if (typeof window === 'undefined') return

  const sessionKey = `${VIEWED_SESSION_PREFIX}${essayId}`
  try {
    if (window.sessionStorage.getItem(sessionKey)) {
      // Already recorded in this browser session
      return
    }
    window.sessionStorage.setItem(sessionKey, '1')
  } catch {}

  try {
    await fetch('/api/essay-interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'view', essayId }),
      keepalive: true,
    })
  } catch {}
}

/**
 * Toggles like for an essay (persists visitor like state locally)
 */
export async function toggleEssayLike(
  essayId: string
): Promise<{ liked: boolean; newCount?: number }> {
  const likedIds = getLikedEssayIds()
  const currentlyLiked = likedIds.includes(essayId)
  const newLiked = !currentlyLiked

  if (newLiked) {
    saveLikedEssayIds([...likedIds, essayId])
  } else {
    saveLikedEssayIds(likedIds.filter((id) => id !== essayId))
  }

  try {
    const res = await fetch('/api/essay-interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'like',
        essayId,
        delta: newLiked ? 1 : -1,
      }),
      keepalive: true,
    })
    if (res.ok) {
      const data = await res.json()
      return { liked: newLiked, newCount: data.data?.likes }
    }
  } catch (err) {
    console.warn('Like sync error:', err)
  }

  return { liked: newLiked }
}

/**
 * Submits a new comment for an essay
 */
export async function submitEssayComment(
  essayId: string,
  authorName: string,
  content: string
): Promise<EssayComment | null> {
  const trimmedAuthor = authorName.trim() || 'Anonymous Reader'
  const trimmedContent = content.trim()

  if (!trimmedContent) {
    throw new Error('Comment content cannot be empty.')
  }

  const res = await fetch('/api/essay-interactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'comment',
      essayId,
      authorName: trimmedAuthor,
      content: trimmedContent,
    }),
  })

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}))
    throw new Error(errData.error || `Failed to submit comment (${res.status})`)
  }

  const result = await res.json()
  const comments = result.data?.comments
  return Array.isArray(comments) && comments.length > 0 ? comments[0] : null
}

/**
 * Deletes a comment (admin moderation)
 */
export async function deleteEssayComment(
  essayId: string,
  commentId: string,
  adminToken?: string
): Promise<boolean> {
  const token =
    adminToken ||
    (typeof window !== 'undefined'
      ? sessionStorage.getItem('junaid_admin_token') || ''
      : '')

  try {
    const res = await fetch('/api/essay-interactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        action: 'delete_comment',
        essayId,
        commentId,
        adminToken: token,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}
