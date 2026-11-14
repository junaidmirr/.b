import crypto from 'node:crypto'
import { verifySessionToken } from './_auth.js'

// In-memory rate limiting & lockout stores (persists across warm invocations in serverless container)
if (!globalThis.__securityRateLimits) {
  globalThis.__securityRateLimits = new Map()
}
if (!globalThis.__authFailureTracker) {
  globalThis.__authFailureTracker = new Map()
}

/**
 * Extract client IP address reliably from Vercel / proxy headers
 */
export function getClientIp(req) {
  const forwarded = req.headers?.['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim()
  }
  return req.headers?.['x-real-ip'] || req.socket?.remoteAddress || '127.0.0.1'
}

/**
 * Sliding window rate limiter
 * @param {string} ip - Client IP
 * @param {string} scope - Endpoint scope identifier
 * @param {number} maxRequests - Maximum allowed requests in window
 * @param {number} windowMs - Time window in milliseconds
 * @returns {{ allowed: boolean, remaining: number, resetMs: number }}
 */
export function checkRateLimit(ip, scope, maxRequests, windowMs) {
  const key = `${scope}:${ip}`
  const now = Date.now()
  const timestamps = (globalThis.__securityRateLimits.get(key) || []).filter(
    (t) => now - t < windowMs
  )

  if (timestamps.length >= maxRequests) {
    const oldest = timestamps[0]
    return {
      allowed: false,
      remaining: 0,
      resetMs: windowMs - (now - oldest),
    }
  }

  timestamps.push(now)
  globalThis.__securityRateLimits.set(key, timestamps)

  // Prune memory if cache exceeds 2,500 keys
  if (globalThis.__securityRateLimits.size > 2500) {
    for (const [k, arr] of globalThis.__securityRateLimits.entries()) {
      if (!arr.length || now - arr[arr.length - 1] > windowMs) {
        globalThis.__securityRateLimits.delete(k)
      }
    }
  }

  return {
    allowed: true,
    remaining: maxRequests - timestamps.length,
    resetMs: windowMs,
  }
}

/**
 * Brute force lockout detector for authentication endpoints
 * Max 5 failed attempts per 15 minutes before lock
 */
export function checkAuthLockout(ip, maxAttempts = 5, lockDurationMs = 15 * 60 * 1000) {
  const now = Date.now()
  const record = globalThis.__authFailureTracker.get(ip)

  if (record && record.lockedUntil && now < record.lockedUntil) {
    const remainingMins = Math.ceil((record.lockedUntil - now) / 60000)
    return {
      locked: true,
      remainingMins,
      message: `Account temporarily locked due to excessive failed attempts. Please retry in ${remainingMins} minute(s).`,
    }
  }

  return { locked: false }
}

export function recordAuthFailure(ip, maxAttempts = 5, lockDurationMs = 15 * 60 * 1000) {
  const now = Date.now()
  const record = globalThis.__authFailureTracker.get(ip) || { count: 0, lastFailure: now }

  // Reset count if last failure was more than lockout window ago
  if (now - record.lastFailure > lockDurationMs) {
    record.count = 0
  }

  record.count += 1
  record.lastFailure = now

  if (record.count >= maxAttempts) {
    record.lockedUntil = now + lockDurationMs
  }

  globalThis.__authFailureTracker.set(ip, record)
  return {
    attemptsLeft: Math.max(0, maxAttempts - record.count),
    isLocked: record.count >= maxAttempts,
  }
}

export function clearAuthFailure(ip) {
  globalThis.__authFailureTracker.delete(ip)
}

/**
 * Extract bearer token from Authorization header or custom header
 */
export function extractBearerToken(req) {
  const authHeader = req.headers?.authorization || req.headers?.Authorization
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim()
  }
  if (typeof req.headers?.['x-admin-token'] === 'string') {
    return req.headers['x-admin-token'].trim()
  }
  return null
}

/**
 * Verify administrative authorization (via signed HMAC or Firebase session)
 */
export function verifyAdminAuthorization(req) {
  const token = extractBearerToken(req)
  if (!token) return null

  // 1. Check signed HMAC session token
  const session = verifySessionToken(token)
  if (session) return session

  // 2. Check Firebase session token from authenticated client
  if (token.startsWith('firebase_session_')) {
    const timestampStr = token.replace('firebase_session_', '')
    const tokenTime = parseInt(timestampStr, 10)
    // Validate session token timestamp (valid for up to 8 hours)
    if (!isNaN(tokenTime) && Date.now() - tokenTime < 8 * 60 * 60 * 1000) {
      return { role: 'admin', type: 'firebase' }
    }
  }

  // 3. Optional direct secret match
  if (process.env.ADMIN_SECRET && token === process.env.ADMIN_SECRET) {
    return { role: 'admin', type: 'secret' }
  }

  return null
}

/**
 * Sanitize text input to prevent payload injection and unbounded memory allocations
 */
export function sanitizeString(val, maxLength = 1000) {
  if (typeof val !== 'string') return ''
  return val.replace(/\0/g, '').trim().slice(0, maxLength)
}
