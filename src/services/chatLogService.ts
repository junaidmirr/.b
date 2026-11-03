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

function sanitizeForFirestore(session: ChatSession, chatDocId: string): Record<string, any> {
  const clean: Record<string, any> = {
    id: chatDocId,
    createdAt: session.createdAt || new Date().toISOString(),
    updatedAt: session.updatedAt || new Date().toISOString(),
    summary: String(session.summary || 'Visitor conversation').slice(0, 150),
    messageCount: Number(session.messageCount) || (Array.isArray(session.messages) ? session.messages.length : 0),
    browser: session.browser || 'Web Browser',
    messages: (session.messages || []).map((m) => ({
      id: String(m.id || Date.now()),
      role: m.role === 'user' ? 'user' : 'assistant',
      content: String(m.content || ''),
      timestamp: m.timestamp || new Date().toISOString(),
    })),
  }
  if (session.userAgent) {
    clean.userAgent = String(session.userAgent).slice(0, 200)
  }
  return clean
}

/**
 * Saves or updates a chat session directly into Firebase Firestore
 * and through the serverless bridge for resilient cross-device synchronization.
 */
export async function saveChatSession(session: ChatSession): Promise<void> {
  const chatDocId = formatChatDocId(session.id)
  const cleanData = sanitizeForFirestore(session, chatDocId)

  // 1. Update local & memory cache
  const local = getLocalChatSessions()
  const existingIdx = local.findIndex((s) => s.id === session.id || s.id === chatDocId)
  let updatedLocal: ChatSession[]
  if (existingIdx >= 0) {
    updatedLocal = [...local]
    updatedLocal[existingIdx] = cleanData as ChatSession
  } else {
    updatedLocal = [cleanData as ChatSession, ...local]
  }
  saveLocalChatSessions(updatedLocal)

  // 2. Direct Firestore Client SDK write to 'portfolio' collection
  try {
    if (!isFirebaseConfigured() || !db) {
      await ensureFirebaseInitialized()
    }

    if (isFirebaseConfigured() && db) {
      const docRef = doc(db, FIRESTORE_PORTFOLIO_COLLECTION, chatDocId)
      await setDoc(docRef, cleanData, { merge: true })
    }
  } catch (err) {
    console.warn('Direct Firestore client write note:', err)
  }

  // 3. Serverless API Bridge via fetch with keepalive: true (always runs reliably)
  try {
    const payload = JSON.stringify(cleanData)
    if (typeof fetch === 'function') {
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
