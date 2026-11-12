import { doc, onSnapshot } from 'firebase/firestore'
import { db, ensureFirebaseInitialized } from '../firebase'
import type { EssayComment, EssayInteraction } from '../types'

const LIKED_STORAGE_KEY = 'junaid_liked_essays'
const VIEWED_SESSION_PREFIX = 'junaid_viewed_essay_'
const CACHE_STORAGE_KEY = 'junaid_essay_interactions_cache'

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

export function getCachedInteractions(): EssayInteractionsMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(CACHE_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' ? parsed : {}
    }
  } catch {}
  return {}
}

export function saveCachedInteractions(map: EssayInteractionsMap) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(map))
  } catch {}
}

export function updateCachedInteractions(essayId: string, item: EssayInteraction) {
  const current = getCachedInteractions()
  current[essayId] = item
  saveCachedInteractions(current)
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
        saveCachedInteractions(data.interactions)
        return data.interactions
      }
    }
  } catch (err) {
    console.warn('Could not fetch essay interactions from API:', err)
  }
  return getCachedInteractions()
}

/**
 * Subscribes to real-time essay interactions from cache, API, and Firebase Firestore
 */
export function subscribeToEssayInteractions(
  callback: (interactions: EssayInteractionsMap) => void
): () => void {
  // 1. Immediately provide cached data to prevent flash of 0 views
  const cached = getCachedInteractions()
  if (Object.keys(cached).length > 0) {
    callback(cached)
  }

  // 2. Refresh from serverless API
  fetchEssayInteractions().then((data) => {
    if (Object.keys(data).length > 0) {
      callback(data)
    }
  })

  // 3. Attach real-time snapshot listener on Firestore 'portfolio/essay_interactions'
  let unsubscribeFirestore = () => {}
  ensureFirebaseInitialized().then((ready) => {
    if (ready && db) {
      try {
        const docRef = doc(db, 'portfolio', 'essay_interactions')
        unsubscribeFirestore = onSnapshot(
          docRef,
          (snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.data()
              if (data && data.interactions) {
                try {
                  const parsed =
                    typeof data.interactions === 'string'
                      ? JSON.parse(data.interactions)
                      : data.interactions
                  if (parsed && typeof parsed === 'object') {
                    saveCachedInteractions(parsed)
                    callback(parsed)
                  }
                } catch {}
              }
            }
          },
          (err) => {
            console.warn('Essay interactions snapshot notice:', err)
          }
        )
      } catch {}
    }
  })

  return () => {
    unsubscribeFirestore()
  }
}

/**
 * Records a page view for an essay and returns the updated views count
 */
export async function recordEssayView(essayId: string): Promise<number | undefined> {
  if (typeof window === 'undefined') return undefined

  // Deduplicate rapid re-clicks within 10 seconds per session
  const sessionKey = `${VIEWED_SESSION_PREFIX}${essayId}`
  const lastViewTime = Number(window.sessionStorage.getItem(sessionKey) || 0)
  const now = Date.now()
  if (lastViewTime && now - lastViewTime < 10000) {
    return undefined
  }
  try {
    window.sessionStorage.setItem(sessionKey, String(now))
  } catch {}

  try {
    const res = await fetch('/api/essay-interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'view', essayId }),
      keepalive: true,
    })
    if (res.ok) {
      const data = await res.json()
      if (data.data && typeof data.data.views === 'number') {
        updateCachedInteractions(essayId, data.data)
        return data.data.views
      }
    }
  } catch (err) {
    console.warn('Could not record essay view:', err)
  }
  return undefined
}

/**
 * Toggles like for an essay (persists visitor like state locally and in Firebase)
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
      if (data.data) {
        updateCachedInteractions(essayId, data.data)
      }
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
  if (result.data) {
    updateCachedInteractions(essayId, result.data)
  }
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
