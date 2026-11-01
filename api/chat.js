import fs from 'node:fs'
import path from 'node:path'

function getPortfolioContext() {
  try {
    const dataPath = path.join(process.cwd(), 'src', 'portfolioData.json')
    if (fs.existsSync(dataPath)) {
      const content = fs.readFileSync(dataPath, 'utf8')
      const data = JSON.parse(content)
      return data
    }
  } catch (err) {
    console.warn('Could not read portfolioData.json for AI context:', err)
  }
  return null
}

function buildSystemPrompt(portfolio) {
  const profile = portfolio?.profile || {
    name: 'Junaid',
    role: 'Software Developer',
    headline: 'Native Android and full stack web developer.',
    bio: "I'm Junaid, a software engineer with 3+ years of experience building applications. Creator of doc-engine, an open source vector PDF engine, contributor to Tauri, and developer of production Android apps with Kotlin and Jetpack Compose.",
    location: 'Bangalore, India (UTC+5:30)',
    email: 'junaidmeer055@gmail.com',
    github: 'https://github.com/junaidmirr',
    linkedin: 'https://www.linkedin.com/in/junaid-mir-68b87b1b9/',
  }

  const projects = portfolio?.projects || []

  let projectSummaries = projects
    .map((p) => {
      const stack = Array.isArray(p.stack) ? p.stack.join(', ') : ''
      const features = Array.isArray(p.features) ? p.features.map((f) => `  - ${f}`).join('\n') : ''
      const tech = Array.isArray(p.technologies)
        ? p.technologies.map((t) => `  - ${t.name}: ${t.details}`).join('\n')
        : ''
      return `Project: ${p.title}
Category: ${p.category}
Short Description: ${p.description}
Full Details: ${p.fullDescription}
Tech Stack: ${stack}
GitHub: ${p.githubUrl || 'N/A'}
Live Link: ${p.liveUrl || 'N/A'}
Key Features:
${features}
Architecture Breakdown:
${tech}`
    })
    .join('\n\n---\n\n')

  return `You are Junaid's personal AI Assistant embedded in his portfolio website.
Your objective is to provide viewers, recruiters, founders, and fellow engineers with accurate, articulate, concise, and helpful information about Junaid's background, engineering skills, open source work, and projects.

=== ABOUT JUNAID ===
- Name: ${profile.name}
- Role: ${profile.role}
- Headline: ${profile.headline}
- Location: ${profile.location}
- Email: ${profile.email}
- GitHub: ${profile.github}
- LinkedIn: ${profile.linkedin}
- Bio Summary: ${profile.bio}

=== CORE ENGINEERING FOCUS ===
- Native Android Development: Kotlin, Jetpack Compose, Coroutines & Flow, MVVM architecture, Room Database, Foreground Services, MediaProjection API, CameraX, Agora RTC.
- Frontend & Web Engines: React 19, TypeScript, Tailwind CSS, Vite, HTML5 Canvas 2D context, PDF 1.7 vector rendering specification.
- AI & Backend Systems: Python, FastAPI, Flask, Node.js, Google Gemini AI SDK (Gemini 2.0 Flash / 1.5), Cloud Firestore, Firebase Auth, Cloudflare Turnstile.
- Systems & Tooling: Rust (Tauri CLI crate), spatial indexing (Shapely STRtree, OpenStreetMap), OpenCV, Pillow.

=== FLAGSHIP OPEN SOURCE & PROJECTS ===
${projectSummaries}

=== COMMUNICATION GUIDELINES ===
1. Speak knowledgeably, warmly, and concisely on Junaid's behalf.
2. If asked about a specific project (such as doc-engine, CoolPath, or his Tauri upstream contribution), explain the core technical challenge, how it solves it without bloat, and provide the relevant link (GitHub or live demo).
3. If asked about work opportunities, contract roles, or hiring, confirm that Junaid is open to exciting engineering roles and encourage them to email him directly at ${profile.email} or use the contact modal on the site.
4. Keep formatting clean with standard markdown (short paragraphs, bullet points when listing specs, bold keywords). Avoid fluff, generic AI buzzwords, or unnecessary greetings.`
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

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const { message, history } = body

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message is required.' })
    }

    const portfolio = getPortfolioContext()
    const systemPrompt = buildSystemPrompt(portfolio)

    // Build dialogue context from recent conversation turns
    let conversationContext = ''
    if (Array.isArray(history) && history.length > 0) {
      const recent = history.slice(-6)
      conversationContext = recent
        .map((h) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`)
        .join('\n')
      conversationContext = `\nRecent Conversation:\n${conversationContext}\n`
    }

    const fullPrompt = `${systemPrompt}
${conversationContext}
User: ${message.trim()}
Assistant:`

    // Call the upstream API securely without exposing the endpoint or headers to the client
    const upstreamUrl = process.env.SWIRL_API_URL || 'https://swirls.chat/api/ask'
    const upstreamResponse = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream, application/json, */*',
        Origin: 'https://swirls.chat',
        Referer: 'https://swirls.chat/chat',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({
        prompt: fullPrompt,
        mode: 'Instant',
        webSearch: false,
        deepThink: false,
        attachments: [],
      }),
    })

    if (!upstreamResponse.ok) {
      throw new Error(`Upstream AI service responded with status ${upstreamResponse.status}`)
    }

    // Set SSE headers for real-time streaming back to the user's browser
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')

    const reader = upstreamResponse.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let isDone = false

    while (!isDone) {
      try {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue

          const raw = trimmed.slice(5).trim()
          if (raw === '[DONE]') {
            isDone = true
            try {
              await reader.cancel()
            } catch {}
            break
          }

          try {
            const parsed = JSON.parse(raw)
            if (parsed.swirl) continue
            const delta = parsed.choices?.[0]?.delta?.content
            if (delta) {
              res.write(`data: ${JSON.stringify({ text: delta })}\n\n`)
            }
          } catch {}
        }
      } catch (streamErr) {
        // Stream ended by remote server
        break
      }
    }

    res.write('data: [DONE]\n\n')
    return res.end()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal AI Assistant Error'
    if (!res.headersSent) {
      return res.status(500).json({ error: message })
    }
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`)
    res.write('data: [DONE]\n\n')
    return res.end()
  }
}
