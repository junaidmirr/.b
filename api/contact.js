const REQUIRED_ENV_KEYS = [
  'TURNSTILE_SECRET_KEY',
  'MAILJET_API_KEY',
  'MAILJET_SECRET_KEY',
  'CONTACT_TO_EMAIL',
  'CONTACT_FROM_EMAIL',
]

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function validateContactPayload(payload) {
  const name = typeof payload?.name === 'string' ? payload.name.trim() : ''
  const email = typeof payload?.email === 'string' ? payload.email.trim() : ''
  const message = typeof payload?.message === 'string' ? payload.message.trim() : ''
  const captchaToken = typeof payload?.captchaToken === 'string' ? payload.captchaToken.trim() : ''

  if (!name || !email || !message || !captchaToken) {
    return { error: 'Missing required fields.' }
  }

  if (!EMAIL_PATTERN.test(email)) {
    return { error: 'Invalid email address.' }
  }

  return { name, email, message, captchaToken }
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

function getRemoteIp(req) {
  const forwarded = req.headers['x-forwarded-for']

  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim() || ''
  }

  if (Array.isArray(forwarded)) {
    return forwarded[0]?.split(',')[0]?.trim() || ''
  }

  return ''
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' })
  }

  const missingEnvKeys = REQUIRED_ENV_KEYS.filter((key) => !process.env[key])
  if (missingEnvKeys.length > 0) {
    return res.status(500).json({
      error: `Server is missing required environment variables: ${missingEnvKeys.join(', ')}`,
    })
  }

  if (!EMAIL_PATTERN.test(process.env.CONTACT_TO_EMAIL || '')) {
    return res.status(500).json({ error: 'CONTACT_TO_EMAIL is not a valid email address.' })
  }

  if (!EMAIL_PATTERN.test(process.env.CONTACT_FROM_EMAIL || '')) {
    return res.status(500).json({ error: 'CONTACT_FROM_EMAIL is not a valid email address.' })
  }

  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const validated = validateContactPayload(payload)

    if ('error' in validated) {
      return res.status(400).json({ error: validated.error })
    }

    const turnstileResult = await verifyTurnstileToken(validated.captchaToken, getRemoteIp(req))
    if (!turnstileResult.success) {
      return res.status(400).json({
        error: 'Captcha verification failed.',
        details: turnstileResult['error-codes'] || [],
      })
    }

    await sendMailjetEmail(validated)
    return res.status(200).json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.'
    return res.status(500).json({ error: message })
  }
}
