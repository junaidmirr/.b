import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getFirestore, type Firestore } from 'firebase/firestore'
import { getAuth, type Auth } from 'firebase/auth'

export type FirebaseConfig = {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
}

const STORAGE_KEY = 'junaid_firebase_config'

function loadConfig(): FirebaseConfig {
  if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed && parsed.apiKey && parsed.projectId) {
          return parsed as FirebaseConfig
        }
      }
    } catch {}
  }

  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  }
}

export let firebaseConfig: FirebaseConfig = loadConfig()

export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.apiKey !== 'your_firebase_api_key'
  )
}

export let app: FirebaseApp | null = null
export let db: Firestore | null = null
export let auth: Auth | null = null

export function initFirebaseInstances(): boolean {
  firebaseConfig = loadConfig()
  if (!isFirebaseConfigured()) {
    app = null
    db = null
    auth = null
    return false
  }

  try {
    const existing = getApps()
    app = existing.length === 0 ? initializeApp(firebaseConfig) : existing[0]
    db = getFirestore(app)
    auth = getAuth(app)
    return true
  } catch (err) {
    console.warn('Firebase initialization warning:', err)
    return false
  }
}

// Initial initialization attempt
initFirebaseInstances()

export function saveCustomFirebaseConfig(config: FirebaseConfig): boolean {
  if (typeof window === 'undefined') return false
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
    return initFirebaseInstances()
  } catch (err) {
    console.error('Failed to save Firebase config:', err)
    return false
  }
}

export function clearCustomFirebaseConfig(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(STORAGE_KEY)
  initFirebaseInstances()
}
