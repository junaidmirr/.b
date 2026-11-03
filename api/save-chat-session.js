/**
 * Serverless Chat Session Persistence API
 *
 * Handles saving, retrieving, and syncing visitor AI chat sessions.
 * Acts as a resilient bridge for in-app browsers (Instagram, Facebook, TikTok, Safari Private)
 * where direct client-side WebSockets and Firestore WebChannel connections are blocked or killed.
 */

// In-memory cache across serverless invocations for resilience
if (!globalThis.__cachedChatSessions) {
  globalThis.__cachedChatSessions = []
}

function getFirebaseConfig() {
  return {
    apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || '',
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || '',
  }
}

/**
 * Converts standard JavaScript objects to Firestore REST API value representations
 */
function toFirestoreValue(val) {
  if (val === null || val === undefined) {
    return { nullValue: null }
  }
  if (typeof val === 'boolean') {
    return { booleanValue: val }
  }
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val }
  }
  if (typeof val === 'string') {
    return { stringValue: val }
  }
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } }
  }
  if (typeof val === 'object') {
    const fields = {}
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) {
        fields[k] = toFirestoreValue(v)
      }
    }
    return { mapValue: { fields } }
  }
  return { stringValue: String(val) }
}

/**
 * Converts Firestore REST API document format back to a clean JavaScript object
 */
function fromFirestoreValue(val) {
  if (!val || typeof val !== 'object') return val
  if ('stringValue' in val) return val.stringValue
  if ('integerValue' in val) return parseInt(val.integerValue, 10)
  if ('doubleValue' in val) return val.doubleValue
  if ('booleanValue' in val) return val.booleanValue
  if ('nullValue' in val) return null
  if ('arrayValue' in val) {
    return (val.arrayValue.values || []).map(fromFirestoreValue)
  }
  if ('mapValue' in val) {
    const res = {}
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
      res[k] = fromFirestoreValue(v)
    }
    return res
  }
  return val
}

function parseFirestoreDocument(doc) {
  if (!doc || !doc.fields) return null
  const session = {}
  for (const [key, val] of Object.entries(doc.fields)) {
    session[key] = fromFirestoreValue(val)
  }
  return session
}

function detectBrowser(userAgent = '') {
  if (/Instagram/i.test(userAgent)) return 'Instagram In-App'
  if (/FBAN|FBAV/i.test(userAgent)) return 'Facebook In-App'
  if (/TikTok/i.test(userAgent)) return 'TikTok In-App'
  if (/Twitter|X-App/i.test(userAgent)) return 'Twitter/X In-App'
  if (/LinkedIn/i.test(userAgent)) return 'LinkedIn In-App'
  if (/MicroMessenger/i.test(userAgent)) return 'WeChat In-App'
  if (/CriOS/i.test(userAgent)) return 'Chrome iOS'
  if (/Chrome/i.test(userAgent) && /Mobile/i.test(userAgent)) return 'Chrome Mobile'
  if (/Mobile.*Safari/i.test(userAgent) && !/Chrome|CriOS/i.test(userAgent)) return 'Mobile Safari'
  if (/Chrome/i.test(userAgent)) return 'Desktop Chrome'
  if (/Safari/i.test(userAgent) && !/Chrome/i.test(userAgent)) return 'Desktop Safari'
  if (/Firefox/i.test(userAgent)) return 'Firefox'
  return 'Web Browser'
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  const { apiKey, projectId } = getFirebaseConfig()

  // 1. GET: Fetch chat sessions (merging Firestore REST API with memory buffer)
  if (req.method === 'GET') {
    let firestoreSessions = []

    if (projectId && apiKey) {
      try {
        const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/ai_chats?key=${apiKey}&pageSize=100`
        const resp = await fetch(firestoreUrl)
        if (resp.ok) {
          const data = await resp.json()
          if (Array.isArray(data.documents)) {
            firestoreSessions = data.documents
              .map(parseFirestoreDocument)
              .filter(Boolean)
          }
        }
      } catch (err) {
        console.warn('Could not fetch from Firestore REST API:', err)
      }
    }

    // Merge Firestore documents with serverless cached sessions
    const mergedMap = new Map()
    for (const s of firestoreSessions) {
      if (s && s.id) mergedMap.set(s.id, s)
    }
    for (const s of globalThis.__cachedChatSessions) {
      if (s && s.id) {
        const existing = mergedMap.get(s.id)
        if (!existing || new Date(s.updatedAt || 0) >= new Date(existing.updatedAt || 0)) {
          mergedMap.set(s.id, s)
        }
      }
    }

    const sessions = Array.from(mergedMap.values()).sort((a, b) => {
      const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime()
      const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime()
      return timeB - timeA
    })

    return res.status(200).json({
      success: true,
      sessions,
      count: sessions.length,
    })
  }

  // 2. POST: Save or update a chat session
  if (req.method === 'POST') {
    let session = req.body
    if (typeof session === 'string') {
      try {
        session = JSON.parse(session)
      } catch {
        return res.status(400).json({ error: 'Invalid JSON payload' })
      }
    }

    if (!session || !session.id) {
      return res.status(400).json({ error: 'Missing session ID or invalid body' })
    }

    const userAgent = session.userAgent || req.headers['user-agent'] || ''
    const detectedBrowser = session.browser || detectBrowser(userAgent)

    const normalizedSession = {
      id: String(session.id),
      createdAt: session.createdAt || new Date().toISOString(),
      updatedAt: session.updatedAt || new Date().toISOString(),
      summary: String(session.summary || 'Visitor conversation').slice(0, 150),
      messageCount: Number(session.messageCount) || (Array.isArray(session.messages) ? session.messages.length : 0),
      browser: detectedBrowser,
      userAgent: userAgent.slice(0, 200),
      messages: Array.isArray(session.messages)
        ? session.messages.map((m) => ({
            id: String(m.id || Date.now()),
            role: m.role === 'user' ? 'user' : 'assistant',
            content: String(m.content || ''),
            timestamp: m.timestamp || new Date().toISOString(),
          }))
        : [],
    }

    // Always update serverless cache immediately
    const existingIdx = globalThis.__cachedChatSessions.findIndex((s) => s.id === normalizedSession.id)
    if (existingIdx >= 0) {
      globalThis.__cachedChatSessions[existingIdx] = normalizedSession
    } else {
      globalThis.__cachedChatSessions.unshift(normalizedSession)
      if (globalThis.__cachedChatSessions.length > 200) {
        globalThis.__cachedChatSessions.pop()
      }
    }

    // Sync to Firestore REST API
    let firestoreSynced = false
    let firestoreError = null

    if (projectId && apiKey) {
      try {
        const firestoreFields = {}
        for (const [k, v] of Object.entries(normalizedSession)) {
          firestoreFields[k] = toFirestoreValue(v)
        }

        const firestorePatchUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/ai_chats/${normalizedSession.id}?key=${apiKey}`
        const patchResp = await fetch(firestorePatchUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields: firestoreFields }),
        })

        if (patchResp.ok) {
          firestoreSynced = true
        } else {
          const errBody = await patchResp.json().catch(() => ({}))
          firestoreError = errBody.error?.message || `HTTP ${patchResp.status}`
        }
      } catch (err) {
        firestoreError = err instanceof Error ? err.message : String(err)
      }
    }

    return res.status(200).json({
      success: true,
      id: normalizedSession.id,
      firestoreSynced,
      firestoreError: firestoreSynced ? undefined : firestoreError,
    })
  }

  // 3. DELETE: Remove a chat session
  if (req.method === 'DELETE') {
    const id = req.query.id || (typeof req.body === 'object' && req.body?.id)
    if (!id) {
      return res.status(400).json({ error: 'Missing session ID to delete' })
    }

    globalThis.__cachedChatSessions = globalThis.__cachedChatSessions.filter((s) => s.id !== id)

    if (projectId && apiKey) {
      try {
        const firestoreDeleteUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/ai_chats/${id}?key=${apiKey}`
        await fetch(firestoreDeleteUrl, { method: 'DELETE' })
      } catch {}
    }

    return res.status(200).json({ success: true, deletedId: id })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
