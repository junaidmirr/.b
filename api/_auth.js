import crypto from 'node:crypto'

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'
const ADMIN_SECRET = process.env.ADMIN_SECRET || process.env.ADMIN_PASSWORD || 'junaid-portfolio-admin-secret-2026'

export function verifyPassword(password) {
  if (typeof password !== 'string') return false
  const p1 = crypto.createHash('sha256').update(password).digest()
  const p2 = crypto.createHash('sha256').update(ADMIN_PASSWORD).digest()
  return crypto.timingSafeEqual(p1, p2)
}

export function createSessionToken() {
  const payload = {
    role: 'admin',
    iat: Date.now(),
    exp: Date.now() + 1000 * 60 * 60 * 6, // 6 hours
    nonce: crypto.randomBytes(16).toString('hex'),
  }
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = crypto.createHmac('sha256', ADMIN_SECRET).update(data).digest('base64url')
  return {
    token: `${data}.${signature}`,
    expiresAt: payload.exp,
  }
}

export function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return false
  const parts = token.split('.')
  if (parts.length !== 2) return false
  const [data, signature] = parts
  const expectedSignature = crypto.createHmac('sha256', ADMIN_SECRET).update(data).digest('base64url')

  const sigBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expectedSignature)
  if (sigBuffer.length !== expectedBuffer.length) return false
  if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) return false

  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'))
    if (!payload || payload.exp < Date.now()) return false
    return payload
  } catch {
    return false
  }
}
