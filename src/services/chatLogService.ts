import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
} from 'firebase/firestore'
import { db, isFirebaseConfigured, ensureFirebaseInitialized } from '../firebase'
import type { ChatSession } from '../types'

const AI_CHATS_COLLECTION = 'ai_chats'
const LOCAL_STORAGE_CHATS_KEY = 'junaid_saved_chat_sessions'

function getLocalChatSessions(): ChatSession[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_CHATS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed
      }
    }
  } catch (err) {
    console.warn('Could not read local chat sessions:', err)
  }
  return []
}

function saveLocalChatSessions(sessions: ChatSession[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LOCAL_STORAGE_CHATS_KEY, JSON.stringify(sessions))
  } catch (err) {
    console.warn('Could not save local chat sessions:', err)
  }
}

/**
 * Saves or updates a chat session in Firestore and local backup.
 */
export async function saveChatSession(session: ChatSession): Promise<void> {
  // Always update local storage first so conversations are never lost
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

  // Ensure Firebase is ready
  if (!isFirebaseConfigured() || !db) {
    await ensureFirebaseInitialized()
  }

  if (!isFirebaseConfigured() || !db) {
    return
  }

  try {
    const docRef = doc(db, AI_CHATS_COLLECTION, session.id)
    await setDoc(docRef, session, { merge: true })
  } catch (err) {
    console.warn('Could not save chat session to Firestore (will use local fallback):', err)
  }
}

/**
 * Subscribes to live chat sessions from Firestore with local storage fallback.
 */
export function subscribeToChatSessions(
  callback: (sessions: ChatSession[]) => void
): () => void {
  const local = getLocalChatSessions()
  callback(local)

  let unsubscribeFirestore = () => {}

  const setupSubscription = () => {
    if (!db) {
      callback(getLocalChatSessions())
      return
    }

    try {
      const q = query(
        collection(db, AI_CHATS_COLLECTION),
        orderBy('updatedAt', 'desc'),
        limit(100)
      )

      unsubscribeFirestore = onSnapshot(
        q,
        (snapshot) => {
          const sessions: ChatSession[] = []
          snapshot.forEach((docSnap) => {
            sessions.push(docSnap.data() as ChatSession)
          })
          if (sessions.length > 0) {
            saveLocalChatSessions(sessions)
            callback(sessions)
          } else {
            callback(getLocalChatSessions())
          }
        },
        (error) => {
          console.warn('Firestore chat sessions listener notice:', error.message)
          callback(getLocalChatSessions())
        }
      )
    } catch (err) {
      console.warn('Failed to start Firestore chat sessions subscription:', err)
      callback(getLocalChatSessions())
    }
  }

  if (isFirebaseConfigured() && db) {
    setupSubscription()
  } else {
    ensureFirebaseInitialized().then((ready) => {
      if (ready && db) {
        setupSubscription()
      }
    })
  }

  return () => {
    unsubscribeFirestore()
  }
}

/**
 * Deletes a chat session from Firestore and local storage.
 */
export async function deleteChatSession(sessionId: string): Promise<void> {
  const local = getLocalChatSessions().filter((s) => s.id !== sessionId)
  saveLocalChatSessions(local)

  if (!isFirebaseConfigured() || !db) {
    await ensureFirebaseInitialized()
  }

  if (db) {
    try {
      const docRef = doc(db, AI_CHATS_COLLECTION, sessionId)
      await deleteDoc(docRef)
    } catch (err) {
      console.warn('Could not delete chat session from Firestore:', err)
    }
  }
}
