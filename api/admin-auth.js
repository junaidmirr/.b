import { verifyPassword, createSessionToken } from './_auth.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' })
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const { password } = body

    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Password is required.' })
    }

    if (!verifyPassword(password)) {
      return res.status(401).json({ error: 'Invalid password. Access denied.' })
    }

    const session = createSessionToken()
    return res.status(200).json({
      ok: true,
      token: session.token,
      expiresAt: session.expiresAt,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Authentication failed.'
    return res.status(500).json({ error: message })
  }
}
