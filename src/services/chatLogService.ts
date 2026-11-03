import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  limit,
} from 'firebase/firestore'
import { db, isFirebaseConfigured, ensureFirebaseInitialized } from '../firebase'
import type { ChatSession } from '../types'

// Storing under 'portfolio' collection where Firestore Security Rules allow read/write
const FIRESTORE_PORTFOLIO_COLLECTION = 'portfolio'
const LOCAL_STORAGE_CHATS_KEY = 'junaid_saved_chat_sessions'

function formatChatDocId(id: string): string {
  if (id.startsWith('chat_')) return id
  return `chat_${id}`
}

let inMemoryChatSessions: ChatSession[] = []

function getLocalChatSessions(): ChatSession[] {
  if (typeof window === 'undefined') return inMemoryChatSessions
  try {
    const raw = window.localStorage?.getItem(LOCAL_STORAGE_CHATS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        inMemoryChatSessions = parsed
        return parsed
      }
    }
  } catch (err) {
    console.warn('Could not read local chat sessions:', err)
  }
  return inMemoryChatSessions
}

function saveLocalChatSessions(sessions: ChatSession[]) {
  inMemoryChatSessions = sessions
  if (typeof window === 'undefined') return
  try {
    window.localStorage?.setItem(LOCAL_STORAGE_CHATS_KEY, JSON.stringify(sessions))
  } catch (err) {
    console.warn('Could not save local chat sessions:', err)
  }
}

/**
 * Merges two arrays of sessions by ID, keeping the latest updatedAt timestamp.
 */
function mergeSessions(primary: ChatSession[], secondary: ChatSession[]): ChatSession[] {
  const map = new Map<string, ChatSession>()
  for (const s of [...primary, ...secondary]) {
    if (!s || !s.id) continue
    const normId = s.id
    const existing = map.get(normId)
    if (!existing) {
      map.set(normId, s)
    } else {
      const timeNew = new Date(s.updatedAt || s.createdAt || 0).getTime()
      const timeOld = new Date(existing.updatedAt || existing.createdAt || 0).getTime()
      map.set(normId, timeNew >= timeOld ? s : existing)
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime()
    const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime()
    return timeB - timeA
  })
}

/**
 * Saves or updates a chat session directly into Firebase Firestore
 * and through the serverless bridge for resilient cross-device synchronization.
 */
export async function saveChatSession(session: ChatSession): Promise<void> {
  // 1. Update local & memory cache
  const local = getLocalChatSessions()
  const existingIdx = local.findIndex((s) => s.id === session.id)
  let updatedLocal: ChatSession[]
  if (existingIdx >= 0) {
    updatedLocal = [...local]
    updatedLocal[existingIdx] = session
  } else {
    updatedLocal = [session, ...local]
  }
  saveLocalChatSessions(updatedLocal)

  // 2. Direct Firestore Client SDK write to 'portfolio' collection
  const chatDocId = formatChatDocId(session.id)
  try {
    if (!isFirebaseConfigured() || !db) {
      await ensureFirebaseInitialized()
    }

    if (isFirebaseConfigured() && db) {
      const docRef = doc(db, FIRESTORE_PORTFOLIO_COLLECTION, chatDocId)
      await setDoc(docRef, { ...session, id: chatDocId }, { merge: true })
    }
  } catch (err) {
    console.warn('Direct Firestore save note (serverless bridge will sync):', err)
  }

  // 3. Serverless API Bridge via Beacon / Fetch keepalive
  try {
    const payload = JSON.stringify({ ...session, id: chatDocId })
    let beaconSent = false
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      try {
        const blob = new Blob([payload], { type: 'application/json' })
        beaconSent = navigator.sendBeacon('/api/save-chat-session', blob)
      } catch {}
    }

    if (!beaconSent && typeof fetch === 'function') {
      fetch('/api/save-chat-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {})
    }
  } catch (err) {
    console.warn('Notice from serverless chat session logger:', err)
  }
}

/**
 * Subscribes to live chat sessions for the Admin Panel.
 * Listens to Firestore 'portfolio' real-time updates and merges serverless API data.
 */
export function subscribeToChatSessions(
  callback: (sessions: ChatSession[]) => void
): () => void {
  let currentSessions = getLocalChatSessions()
  callback(currentSessions)

  let isUnsubscribed = false
  let unsubscribeFirestore = () => {}

  // 1. Fetch from Serverless API immediately
  const fetchFromServerless = async () => {
    try {
      const res = await fetch('/api/save-chat-session')
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data.sessions) && data.sessions.length > 0) {
          currentSessions = mergeSessions(currentSessions, data.sessions)
          saveLocalChatSessions(currentSessions)
          if (!isUnsubscribed) {
            callback(currentSessions)
          }
        }
      }
    } catch {}
  }
  fetchFromServerless()

  // 2. Setup Firestore real-time listener on 'portfolio' collection
  const setupFirestoreSubscription = () => {
    if (!db) return

    try {
      const q = query(collection(db, FIRESTORE_PORTFOLIO_COLLECTION), limit(100))

      unsubscribeFirestore = onSnapshot(
        q,
        (snapshot) => {
          const remoteSessions: ChatSession[] = []
          snapshot.forEach((docSnap) => {
            // Ignore portfolio content document
            if (docSnap.id === 'content') return

            const data = docSnap.data() as Partial<ChatSession>
            if (data && (Array.isArray(data.messages) || data.summary || docSnap.id.startsWith('chat_'))) {
              remoteSessions.push({
                id: docSnap.id,
                createdAt: data.createdAt || new Date().toISOString(),
                updatedAt: data.updatedAt || new Date().toISOString(),
                summary: data.summary || 'Visitor conversation',
                messageCount: data.messageCount || (Array.isArray(data.messages) ? data.messages.length : 0),
                messages: Array.isArray(data.messages) ? data.messages : [],
                browser: data.browser,
                userAgent: data.userAgent,
              })
            }
          })

          if (remoteSessions.length > 0) {
            currentSessions = mergeSessions(currentSessions, remoteSessions)
            saveLocalChatSessions(currentSessions)
            if (!isUnsubscribed) {
              callback(currentSessions)
            }
          }
        },
        (error) => {
          console.warn('Firestore subscription status notice:', error.message)
          fetchFromServerless()
        }
      )
    } catch (err) {
      console.warn('Could not start Firestore listener:', err)
      fetchFromServerless()
    }
  }

  if (isFirebaseConfigured() && db) {
    setupFirestoreSubscription()
  } else {
    ensureFirebaseInitialized().then((ready) => {
      if (ready && db && !isUnsubscribed) {
        setupFirestoreSubscription()
      }
    })
  }

  return () => {
    isUnsubscribed = true
    unsubscribeFirestore()
  }
}

/**
 * Deletes a chat session from local storage, serverless API, and Firestore.
 */
export async function deleteChatSession(sessionId: string): Promise<void> {
  const chatDocId = formatChatDocId(sessionId)
  const local = getLocalChatSessions().filter((s) => s.id !== sessionId && s.id !== chatDocId)
  saveLocalChatSessions(local)

  // Delete via serverless API
  try {
    await fetch(`/api/save-chat-session?id=${encodeURIComponent(chatDocId)}`, {
      method: 'DELETE',
    })
  } catch {}

  // Delete from client Firestore
  if (!isFirebaseConfigured() || !db) {
    await ensureFirebaseInitialized()
  }

  if (db) {
    try {
      const docRef = doc(db, FIRESTORE_PORTFOLIO_COLLECTION, chatDocId)
      await deleteDoc(docRef)
    } catch (err) {
      console.warn('Could not delete from Firestore client:', err)
    }
  }
}
