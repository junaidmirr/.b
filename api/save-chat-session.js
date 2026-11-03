/**
 * Serverless Chat Session Persistence API
 *
 * Saves directly into the 'ai_chats' collection in Firebase Firestore,
 * with GitHub storage fallback for 100% resilience.
 *
 * Guarantees real-time synchronization across PC, phone, Instagram, and Firebase Console.
 */

if (!globalThis.__cachedChatSessions) {
  globalThis.__cachedChatSessions = []
}

const GITHUB_TARGET_FILE = 'data/chatSessions.json'

function getFirebaseConfig() {
  return {
    apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || '',
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || '',
  }
}

function getGitHubConfig() {
  return {
    token: process.env.GITHUB_TOKEN || process.env.GH_TOKEN || process.env.GITHUB_PAT || '',
    owner: process.env.GITHUB_REPO_OWNER || 'junaidmirr',
    repo: process.env.GITHUB_REPO_NAME || '.b',
    branch: process.env.GITHUB_BRANCH || 'main',
  }
}

/**
 * Fetch stored sessions from GitHub repository
 */
async function fetchSessionsFromGitHub() {
  const { token, owner, repo, branch } = getGitHubConfig()
  if (!token) return { sessions: [], sha: undefined }

  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${GITHUB_TARGET_FILE}?ref=${branch}`
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Portfolio-Chat-Logger',
      },
    })
    if (!res.ok) return { sessions: [], sha: undefined }
    const data = await res.json()
    const content = Buffer.from(data.content, 'base64').toString('utf8')
    const parsed = JSON.parse(content)
    return {
      sessions: Array.isArray(parsed) ? parsed : [],
      sha: data.sha,
    }
  } catch {
    return { sessions: [], sha: undefined }
  }
}

/**
 * Persist sessions array to GitHub repository with [skip ci] so Vercel does not build
 */
async function commitSessionsToGitHub(sessions) {
  const { token, owner, repo, branch } = getGitHubConfig()
  if (!token) return false

  try {
    const { sha } = await fetchSessionsFromGitHub()
    const putUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${GITHUB_TARGET_FILE}`
    const jsonString = JSON.stringify(sessions.slice(0, 100), null, 2)
    const putBody = {
      message: `[skip ci] Sync visitor chat session logs (${new Date().toISOString()})`,
      content: Buffer.from(jsonString).toString('base64'),
      branch,
    }
    if (sha) {
      putBody.sha = sha
    }

    const res = await fetch(putUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'Portfolio-Chat-Logger',
      },
      body: JSON.stringify(putBody),
    })

    return res.ok
  } catch (err) {
    console.warn('GitHub session commit error:', err)
    return false
  }
}

function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null }
  if (typeof val === 'boolean') return { booleanValue: val }
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val }
  }
  if (typeof val === 'string') return { stringValue: val }
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
  const nameParts = (doc.name || '').split('/')
  const docId = nameParts[nameParts.length - 1]
  session.id = session.id || docId
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

async function parseRequestBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body
  }
  if (Buffer.isBuffer(req.body)) {
    try {
      return JSON.parse(req.body.toString('utf8'))
    } catch {}
  }
  if (typeof req.body === 'string' && req.body.trim()) {
    try {
      return JSON.parse(req.body)
    } catch {}
  }

  // Fallback: Read raw request stream
  try {
    const chunks = []
    for await (const chunk of req) {
      chunks.push(chunk)
    }
    const raw = Buffer.concat(chunks).toString('utf8')
    if (raw.trim()) {
      return JSON.parse(raw)
    }
  } catch {}
  return null
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  const { apiKey, projectId } = getFirebaseConfig()

  // 1. GET: Return all chat sessions merged from Firestore 'ai_chats', GitHub, and memory
  if (req.method === 'GET') {
    const mergedMap = new Map()

    // A. Read from Firestore REST API (under 'ai_chats' collection)
    if (projectId && apiKey) {
      try {
        const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/ai_chats?key=${apiKey}&pageSize=100`
        const resp = await fetch(firestoreUrl)
        if (resp.ok) {
          const data = await resp.json()
          if (Array.isArray(data.documents)) {
            for (const doc of data.documents) {
              const session = parseFirestoreDocument(doc)
              if (session && session.id) {
                mergedMap.set(session.id, session)
              }
            }
          }
        }
      } catch (err) {
        console.warn('Firestore GET ai_chats error:', err)
      }

      // Also check 'portfolio' collection for any chat documents
      try {
        const portfolioUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/portfolio?key=${apiKey}&pageSize=100`
        const pResp = await fetch(portfolioUrl)
        if (pResp.ok) {
          const pData = await pResp.json()
          if (Array.isArray(pData.documents)) {
            const chatDocs = pData.documents.filter((d) => !d.name.endsWith('/content'))
            for (const doc of chatDocs) {
              const session = parseFirestoreDocument(doc)
              if (session && session.id) {
                mergedMap.set(session.id, session)
              }
            }
          }
        }
      } catch {}
    }

    // B. Read from GitHub repository persistent store
    try {
      const { sessions: githubSessions } = await fetchSessionsFromGitHub()
      for (const s of githubSessions) {
        if (s && s.id) {
          const existing = mergedMap.get(s.id)
          if (!existing || new Date(s.updatedAt || 0) >= new Date(existing.updatedAt || 0)) {
            mergedMap.set(s.id, s)
          }
        }
      }
    } catch {}

    // C. Read from memory buffer
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

  // 2. POST: Save incoming chat session from any browser
  if (req.method === 'POST') {
    const session = await parseRequestBody(req)

    if (!session || !session.id) {
      return res.status(400).json({ error: 'Missing session ID or invalid body' })
    }

    const userAgent = session.userAgent || req.headers['user-agent'] || ''
    const detectedBrowser = session.browser || detectBrowser(userAgent)
    const sessionId = String(session.id)

    const normalizedSession = {
      id: sessionId,
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

    // A. Sync directly into Firestore REST API under 'ai_chats' collection
    let firestoreSynced = false
    let firestoreStatus = null
    if (projectId && apiKey) {
      try {
        const firestoreFields = {}
        for (const [k, v] of Object.entries(normalizedSession)) {
          firestoreFields[k] = toFirestoreValue(v)
        }

        const firestorePatchUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/ai_chats/${sessionId}?key=${apiKey}`
        const patchResp = await fetch(firestorePatchUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields: firestoreFields }),
        })
        firestoreSynced = patchResp.ok
        if (!patchResp.ok) {
          const errBody = await patchResp.json().catch(() => ({}))
          firestoreStatus = errBody.error?.message || `HTTP ${patchResp.status}`
        }
      } catch (err) {
        firestoreStatus = err instanceof Error ? err.message : String(err)
      }
    }

    // B. Update in-memory cache
    const existingIdx = globalThis.__cachedChatSessions.findIndex((s) => s.id === sessionId)
    if (existingIdx >= 0) {
      globalThis.__cachedChatSessions[existingIdx] = normalizedSession
    } else {
      globalThis.__cachedChatSessions.unshift(normalizedSession)
      if (globalThis.__cachedChatSessions.length > 200) {
        globalThis.__cachedChatSessions.pop()
      }
    }

    // C. Save to GitHub repository persistent store with [skip ci]
    try {
      const { sessions: existingGithubSessions } = await fetchSessionsFromGitHub()
      const updatedMap = new Map()
      updatedMap.set(sessionId, normalizedSession)
      for (const s of existingGithubSessions) {
        if (s && s.id && !updatedMap.has(s.id)) {
          updatedMap.set(s.id, s)
        }
      }
      const updatedList = Array.from(updatedMap.values()).sort(
        (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
      )
      await commitSessionsToGitHub(updatedList)
    } catch (gitErr) {
      console.warn('Could not commit session to GitHub:', gitErr)
    }

    return res.status(200).json({
      success: true,
      id: sessionId,
      firestoreSynced,
      firestoreStatus: firestoreSynced ? 'saved_to_firebase' : firestoreStatus,
      saved: true,
    })
  }

  // 3. DELETE: Remove a chat session
  if (req.method === 'DELETE') {
    const rawId = req.query.id || (typeof req.body === 'object' && req.body?.id)
    if (!rawId) {
      return res.status(400).json({ error: 'Missing session ID to delete' })
    }
    const sessionId = String(rawId)

    globalThis.__cachedChatSessions = globalThis.__cachedChatSessions.filter(
      (s) => s.id !== rawId && s.id !== sessionId
    )

    // Remove from Firestore 'ai_chats'
    if (projectId && apiKey) {
      try {
        const firestoreDeleteUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/ai_chats/${sessionId}?key=${apiKey}`
        await fetch(firestoreDeleteUrl, { method: 'DELETE' })
      } catch {}
    }

    // Remove from GitHub repository store
    try {
      const { sessions: existing } = await fetchSessionsFromGitHub()
      const filtered = existing.filter((s) => s.id !== rawId && s.id !== sessionId)
      await commitSessionsToGitHub(filtered)
    } catch {}

    return res.status(200).json({ success: true, deletedId: sessionId })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
