import { verifyPassword, createSessionToken } from './_auth.js'
import {
  getClientIp,
  checkAuthLockout,
  recordAuthFailure,
  clearAuthFailure,
  checkRateLimit,
} from './_security.js'

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

  const clientIp = getClientIp(req)

  // 1. IP Lockout Check: Block IPs with >= 5 failed attempts in last 15 mins
  const lockout = checkAuthLockout(clientIp, 5, 15 * 60 * 1000)
  if (lockout.locked) {
    return res.status(429).json({ error: lockout.message })
  }

  // 2. Global Rate Limit: Max 10 attempts per minute per IP
  const rate = checkRateLimit(clientIp, 'admin-auth', 10, 60 * 1000)
  if (!rate.allowed) {
    return res.status(429).json({ error: 'Too many requests. Please wait a minute before trying again.' })
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const { password } = body

    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Password is required.' })
    }

    if (!verifyPassword(password)) {
      // Artificial delay to prevent timing attacks & high-speed brute forcing
      await new Promise((resolve) => setTimeout(resolve, 400))
      const failure = recordAuthFailure(clientIp, 5, 15 * 60 * 1000)

      if (failure.isLocked) {
        return res.status(429).json({
          error: 'Maximum login attempts exceeded. Account locked for 15 minutes.',
        })
      }

      return res.status(401).json({
        error: `Invalid password. Access denied. (${failure.attemptsLeft} attempt${
          failure.attemptsLeft === 1 ? '' : 's'
        } remaining before lockout)`,
      })
    }

    // Success: Clear any past failures and issue signed HMAC session token
    clearAuthFailure(clientIp)
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
