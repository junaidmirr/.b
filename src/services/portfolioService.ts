import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'
import { db, auth, isFirebaseConfigured } from '../firebase'
import { getPortfolioData, savePortfolioDataLocal } from '../portfolioDataManager'
import type { PortfolioData } from '../types'

const COLLECTION_NAME = 'portfolio'
const DOCUMENT_ID = 'content'

function sanitizePortfolioData(data: unknown, fallback: PortfolioData): PortfolioData {
  if (!data || typeof data !== 'object') return fallback
  const d = data as Partial<PortfolioData>
  return {
    profile: {
      ...fallback.profile,
      ...(d.profile || {}),
    },
    categories: Array.isArray(d.categories) && d.categories.length > 0 ? d.categories : fallback.categories,
    projects: Array.isArray(d.projects) ? d.projects : fallback.projects,
  }
}

/**
 * Subscribes to real-time updates from Firebase Firestore.
 * Automatically updates whenever changes are made in the admin panel.
 */
export function subscribeToPortfolio(onData: (data: PortfolioData) => void): Unsubscribe {
  const fallback = getPortfolioData()

  if (!isFirebaseConfigured() || !db) {
    onData(fallback)
    return () => {}
  }

  try {
    const docRef = doc(db, COLLECTION_NAME, DOCUMENT_ID)
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const raw = snapshot.data()
          const sanitized = sanitizePortfolioData(raw, fallback)
          savePortfolioDataLocal(sanitized)
          onData(sanitized)
        } else {
          // Document does not exist in Firestore yet, provide local data
          onData(fallback)
        }
      },
      (error) => {
        console.warn('Firestore subscription notice (using local cache):', error.message)
        onData(fallback)
      }
    )

    return unsubscribe
  } catch (err) {
    console.warn('Could not establish Firestore subscription:', err)
    onData(fallback)
    return () => {}
  }
}

/**
 * Saves entire portfolio data (profile, projects, categories) to Firestore.
 */
export async function savePortfolioToFirebase(data: PortfolioData): Promise<{ success: boolean; message: string }> {
  // Always update local cache for instant UI responsiveness
  savePortfolioDataLocal(data)

  if (!isFirebaseConfigured() || !db) {
    return {
      success: true,
      message: 'Saved to local browser storage. (Set Firebase environment variables to sync to cloud)',
    }
  }

  try {
    const docRef = doc(db, COLLECTION_NAME, DOCUMENT_ID)
    await setDoc(docRef, data, { merge: true })
    return {
      success: true,
      message: 'Successfully saved to Firebase Firestore. Changes are live for all visitors with zero redeploy!',
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown Firestore error'
    throw new Error(`Failed to save to Firebase: ${msg}`)
  }
}

/**
 * Checks if the Firestore portfolio document exists, and seeds it with default data if empty.
 */
export async function seedFirestoreIfEmpty(): Promise<boolean> {
  if (!isFirebaseConfigured() || !db) return false

  try {
    const docRef = doc(db, COLLECTION_NAME, DOCUMENT_ID)
    const snapshot = await getDoc(docRef)
    if (!snapshot.exists()) {
      const defaultData = getPortfolioData()
      await setDoc(docRef, defaultData)
      return true
    }
    return false
  } catch (err) {
    console.warn('Error checking/seeding Firestore:', err)
    return false
  }
}

/**
 * Firebase Authentication functions for Admin
 */
export async function loginWithFirebase(email: string, pass: string): Promise<User> {
  if (!isFirebaseConfigured() || !auth) {
    throw new Error('Firebase Authentication is not configured yet. Please check your environment variables.')
  }
  const credential = await signInWithEmailAndPassword(auth, email, pass)
  return credential.user
}

export async function logoutFirebase(): Promise<void> {
  if (auth) {
    await signOut(auth)
  }
}

export function subscribeToAuth(onUserChange: (user: User | null) => void): Unsubscribe {
  if (!isFirebaseConfigured() || !auth) {
    onUserChange(null)
    return () => {}
  }
  return onAuthStateChanged(auth, onUserChange)
}
