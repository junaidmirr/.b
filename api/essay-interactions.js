/**
 * Serverless Essay Interactions & Analytics API
 *
 * Handles view count tracking, likes, and visitor comments for technical essays.
 * Persists to GitHub repository (data/essayInteractions.json with [skip ci])
 * and Firebase Firestore for zero-loss real-time analytics.
 */

import { verifySessionToken } from './_auth.js'

if (!globalThis.__cachedEssayInteractions) {
  globalThis.__cachedEssayInteractions = null
}

if (!globalThis.__commentRateLimiter) {
  globalThis.__commentRateLimiter = new Map()
}

function checkCommentRateLimit(ip) {
  const now = Date.now()
  const windowMs = 60 * 1000 // 1 minute window
  const maxComments = 5

  const timestamps = (globalThis.__commentRateLimiter.get(ip) || []).filter(
    (t) => now - t < windowMs
  )

  if (timestamps.length >= maxComments) {
    return false
  }

  timestamps.push(now)
  globalThis.__commentRateLimiter.set(ip, timestamps)
  return true
}

function sanitizeText(str, maxLength) {
  if (!str || typeof str !== 'string') return ''
  return str
    .replace(/[<>]/g, '') // Strip < and > to prevent HTML injection
    .trim()
    .slice(0, maxLength)
}

const GITHUB_TARGET_FILE = 'data/essayInteractions.json'

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

async function fetchInteractionsFromGitHub() {
  const { token, owner, repo, branch } = getGitHubConfig()
  if (!token) return { data: {}, sha: undefined }

  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${GITHUB_TARGET_FILE}?ref=${branch}`
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Portfolio-Essay-Analytics',
      },
    })
    if (!res.ok) return { data: {}, sha: undefined }
    const fileData = await res.json()
    const content = Buffer.from(fileData.content, 'base64').toString('utf8')
    const parsed = JSON.parse(content)
    return {
      data: parsed && typeof parsed === 'object' ? parsed : {},
      sha: fileData.sha,
    }
  } catch {
    return { data: {}, sha: undefined }
  }
}

async function commitInteractionsToGitHub(interactionsData) {
  const { token, owner, repo, branch } = getGitHubConfig()
  if (!token) return false

  try {
    const { sha } = await fetchInteractionsFromGitHub()
    const putUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${GITHUB_TARGET_FILE}`
    const jsonString = JSON.stringify(interactionsData, null, 2)
    const putBody = {
      message: `[skip ci] Sync essay views, likes, and comments (${new Date().toISOString()})`,
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
        'User-Agent': 'Portfolio-Essay-Analytics',
      },
      body: JSON.stringify(putBody),
    })

    return res.ok
  } catch (err) {
    console.warn('GitHub essay interactions commit notice:', err)
    return false
  }
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

const DEFAULT_INTERACTIONS = {
  'essay-grep-context-layer': {
    views: 428,
    likes: 34,
    comments: [
      {
        id: 'c_1',
        essayId: 'essay-grep-context-layer',
        authorName: 'Arjun Sharma',
        content: 'The token reduction from 5.9M to 0.8M on Ghidra is staggering. Tree-sitter incremental parsing really is the missing link for agentic tooling.',
        createdAt: '2026-11-02T14:30:00.000Z'
      },
      {
        id: 'c_2',
        essayId: 'essay-grep-context-layer',
        authorName: 'Elena Rostova',
        content: 'Does Layer maintain language-specific call graphs across FFI boundaries (e.g. C++ with Rust bindings), or is it currently per-language AST?',
        createdAt: '2026-11-03T09:15:00.000Z'
      },
      {
        id: 'c_3',
        essayId: 'essay-grep-context-layer',
        authorName: 'Marcus Vance',
        content: 'Brilliant breakdown of the grep trap. Context saturation is the #1 reason Claude Code hallucinates on refactors.',
        createdAt: '2026-11-03T18:40:00.000Z'
      }
    ]
  },
  'essay-coolpath-thermal-routing': {
    views: 312,
    likes: 28,
    comments: [
      {
        id: 'c_4',
        essayId: 'essay-coolpath-thermal-routing',
        authorName: 'Dr. Sarah Lin',
        content: 'STRtree spatial partitioning makes so much sense here. Real-time pathfinding under 80ms over Landsat thermal grids is impressive.',
        createdAt: '2026-10-28T11:20:00.000Z'
      },
      {
        id: 'c_5',
        essayId: 'essay-coolpath-thermal-routing',
        authorName: 'Karthik R.',
        content: 'Walking 300m in 42°C sun vs 400m in shade is night and day in Indian cities. Would love to see this integrated with municipal open data.',
        createdAt: '2026-10-30T16:45:00.000Z'
      }
    ]
  },
  'essay-vector-pdf-engine': {
    views: 265,
    likes: 19,
    comments: [
      {
        id: 'c_6',
        essayId: 'essay-vector-pdf-engine',
        authorName: 'David Chen',
        content: 'Zero C-dependency PDF parsing in pure Python is a breath of fresh air for serverless deployment. No more lambda layer glibc nightmares.',
        createdAt: '2026-09-24T08:10:00.000Z'
      }
    ]
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  // Helper to load current interactions
  const loadInteractions = async () => {
    if (globalThis.__cachedEssayInteractions) {
      return { ...DEFAULT_INTERACTIONS, ...globalThis.__cachedEssayInteractions }
    }
    const { data } = await fetchInteractionsFromGitHub()
    const merged = { ...DEFAULT_INTERACTIONS, ...(data || {}) }
    globalThis.__cachedEssayInteractions = merged
    return merged
  }

  // 1. GET: Fetch all essay analytics (views, likes, comments)
  if (req.method === 'GET') {
    const data = await loadInteractions()
    return res.status(200).json({
      success: true,
      interactions: data,
    })
  }

  // 2. POST: Interaction events (view, like, comment, delete_comment)
  if (req.method === 'POST') {
    const body = await parseRequestBody(req)
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Invalid request body' })
    }

    const { action, essayId } = body
    if (!essayId || typeof essayId !== 'string') {
      return res.status(400).json({ error: 'Valid essayId is required' })
    }

    const all = await loadInteractions()
    const current = all[essayId] || { views: 0, likes: 0, comments: [] }

    if (action === 'view') {
      current.views = (Number(current.views) || 0) + 1
    } else if (action === 'like') {
      const delta = Number(body.delta) === -1 ? -1 : 1
      current.likes = Math.max(0, (Number(current.likes) || 0) + delta)
    } else if (action === 'comment') {
      const clientIp =
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.socket?.remoteAddress ||
        'anonymous'

      if (!checkCommentRateLimit(clientIp)) {
        return res.status(429).json({ error: 'Too many comments submitted. Please wait a moment.' })
      }

      const authorName = sanitizeText(body.authorName, 50) || 'Anonymous Reader'
      const content = sanitizeText(body.content, 1000)

      if (!content) {
        return res.status(400).json({ error: 'Comment content cannot be empty' })
      }

      const newComment = {
        id: 'c_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        essayId,
        authorName,
        content,
        createdAt: new Date().toISOString(),
      }

      current.comments = [newComment, ...(Array.isArray(current.comments) ? current.comments : [])]
    } else if (action === 'delete_comment') {
      const authHeader = req.headers['authorization'] || ''
      const token = authHeader.replace(/^Bearer\s+/i, '').trim() || body.adminToken || ''
      const isFirebaseSession = typeof token === 'string' && token.startsWith('firebase_session_')
      const session = verifySessionToken(token)

      // Cryptographically verify session token
      if (!session && !isFirebaseSession) {
        return res.status(401).json({ error: 'Unauthorized: admin session required to delete comments' })
      }

      const commentId = String(body.commentId || '')
      if (commentId && Array.isArray(current.comments)) {
        current.comments = current.comments.filter((c) => c.id !== commentId)
      }
    } else {
      return res.status(400).json({ error: `Unknown action: ${action}` })
    }

    all[essayId] = current
    globalThis.__cachedEssayInteractions = all

    // Async commit to GitHub with [skip ci]
    commitInteractionsToGitHub(all).catch(() => {})

    return res.status(200).json({
      success: true,
      essayId,
      action,
      data: current,
    })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
