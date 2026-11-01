import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnvFiles } from './loadEnv.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

loadEnvFiles(rootDir)

const port = Number(process.env.PORT || 8787)
const requiredEnvKeys = [
  'TURNSTILE_SECRET_KEY',
  'MAILJET_API_KEY',
  'MAILJET_SECRET_KEY',
  'CONTACT_TO_EMAIL',
  'CONTACT_FROM_EMAIL',
]
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function json(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  response.end(JSON.stringify(payload))
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let data = ''

    request.on('data', (chunk) => {
      data += chunk

      if (data.length > 1_000_000) {
        reject(new Error('Request body too large.'))
        request.destroy()
      }
    })

    request.on('end', () => {
      try {
        resolve(JSON.parse(data || '{}'))
      } catch {
        reject(new Error('Invalid JSON body.'))
      }
    })

    request.on('error', reject)
  })
}

async function verifyTurnstileToken(token, remoteIp) {
  const formData = new URLSearchParams({
    secret: process.env.TURNSTILE_SECRET_KEY || '',
    response: token,
  })

  if (remoteIp) {
    formData.set('remoteip', remoteIp)
  }

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData,
  })

  if (!response.ok) {
    throw new Error(`Turnstile verification failed with status ${response.status}.`)
  }

  return response.json()
}

async function sendMailjetEmail({ name, email, message }) {
  const encodedAuth = Buffer.from(
    `${process.env.MAILJET_API_KEY || ''}:${process.env.MAILJET_SECRET_KEY || ''}`,
  ).toString('base64')

  const response = await fetch('https://api.mailjet.com/v3.1/send', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${encodedAuth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      Messages: [
        {
          From: {
            Email: process.env.CONTACT_FROM_EMAIL,
            Name: process.env.CONTACT_FROM_NAME || 'Portfolio Contact Form',
          },
          To: [
            {
              Email: process.env.CONTACT_TO_EMAIL,
              Name: 'Junaid',
            },
          ],
          ReplyTo: {
            Email: email,
            Name: name,
          },
          Subject: `Portfolio contact from ${name}`,
          TextPart: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
          HTMLPart: `<h3>New portfolio contact</h3><p><strong>Name:</strong> ${escapeHtml(
            name,
          )}</p><p><strong>Email:</strong> ${escapeHtml(email)}</p><p><strong>Message:</strong></p><p>${escapeHtml(
            message,
          ).replace(/\n/g, '<br />')}</p>`,
        },
      ],
    }),
  })

  const payload = await response.json()

  if (!response.ok) {
    const messageLevelError = payload?.Messages?.[0]?.Errors?.[0]?.ErrorMessage
    const topLevelError = payload?.ErrorMessage
    const rawError = messageLevelError || topLevelError

    if (rawError === 'The string did not match the expected pattern.') {
      throw new Error(
        'Mailjet rejected one of the email fields. Check CONTACT_FROM_EMAIL, CONTACT_TO_EMAIL, and make sure CONTACT_FROM_EMAIL is a verified Mailjet sender.',
      )
    }

    throw new Error(rawError || 'Mailjet request failed.')
  }

  return payload
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function validateContactPayload(payload) {
  const name = typeof payload.name === 'string' ? payload.name.trim() : ''
  const email = typeof payload.email === 'string' ? payload.email.trim() : ''
  const message = typeof payload.message === 'string' ? payload.message.trim() : ''
  const captchaToken = typeof payload.captchaToken === 'string' ? payload.captchaToken.trim() : ''

  if (!name || !email || !message || !captchaToken) {
    return { error: 'Missing required fields.' }
  }

  if (!emailPattern.test(email)) {
    return { error: 'Invalid email address.' }
  }

  return { name, email, message, captchaToken }
}

const server = http.createServer(async (request, response) => {
  if (!request.url) {
    json(response, 404, { error: 'Not found.' })
    return
  }

  if (request.method === 'OPTIONS') {
    json(response, 204, {})
    return
  }

  if (request.method === 'GET' && request.url === '/api/health') {
    json(response, 200, { ok: true })
    return
  }

  if (request.method !== 'POST' || request.url !== '/api/contact') {
    json(response, 404, { error: 'Not found.' })
    return
  }

  const missingEnvKeys = requiredEnvKeys.filter((key) => !process.env[key])
  if (missingEnvKeys.length > 0) {
    json(response, 500, {
      error: `Server is missing required environment variables: ${missingEnvKeys.join(', ')}`,
    })
    return
  }

  if (!emailPattern.test(process.env.CONTACT_TO_EMAIL || '')) {
    json(response, 500, {
      error: 'CONTACT_TO_EMAIL is not a valid email address.',
    })
    return
  }

  if (!emailPattern.test(process.env.CONTACT_FROM_EMAIL || '')) {
    json(response, 500, {
      error: 'CONTACT_FROM_EMAIL is not a valid email address.',
    })
    return
  }

  try {
    const payload = await readJsonBody(request)
    const validated = validateContactPayload(payload)

    if ('error' in validated) {
      json(response, 400, { error: validated.error })
      return
    }

    const forwardedFor = request.headers['x-forwarded-for']
    const remoteIp =
      typeof forwardedFor === 'string'
        ? forwardedFor.split(',')[0]?.trim()
        : request.socket.remoteAddress || ''

    const turnstileResult = await verifyTurnstileToken(validated.captchaToken, remoteIp)
    if (!turnstileResult.success) {
      json(response, 400, {
        error: 'Captcha verification failed.',
        details: turnstileResult['error-codes'] || [],
      })
      return
    }

    await sendMailjetEmail(validated)
    json(response, 200, { ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.'
    json(response, 500, { error: message })
  }
})

server.listen(port, () => {
  console.log(`Contact API listening on http://localhost:${port}`)
})
