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

function buildProjectReference(projects) {
  if (!Array.isArray(projects) || projects.length === 0) return ''

  return projects
    .map((p, index) => {
      const stack = Array.isArray(p.stack) ? p.stack.join(', ') : ''
      const features = Array.isArray(p.features) ? p.features.map((f) => `  * ${f}`).join('\n') : ''
      const tech = Array.isArray(p.technologies)
        ? p.technologies.map((t) => `  * ${t.name}: ${t.details}`).join('\n')
        : ''

      return `${index + 1}. ${p.title}
- Category: ${p.category}
- Summary: ${p.description}
- Technical Overview: ${p.fullDescription}
- Tech Stack: ${stack}
- GitHub Link: ${p.githubUrl || 'N/A'}
- Live Link: ${p.liveUrl || 'N/A'}
- Key Features:
${features}
- Architecture & Technologies:
${tech}`
    })
    .join('\n\n')
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

    const projectsRef = buildProjectReference(portfolio?.projects || [])

    let conversationFormatted = ''
    if (Array.isArray(history) && history.length > 0) {
      const recent = history.slice(-4)
      conversationFormatted = recent
        .map((h) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`)
        .join('\n') + '\n'
    }

    const prompt = `You are Junaid Mir's portfolio AI assistant embedded on his personal engineering portfolio.

STRICT SCOPE BOUNDARY RULE:
You MUST ONLY answer questions directly related to Junaid, his background, his engineering skills, contact details, or his specific projects (doc-engine, CoolPath, Layer, Tauri CLI contribution, Edugate, ResuMagic, AI Credit & Inventory App, Fapper AI, JR Player).
If the user asks an off-topic question (recipes, unrelated code, generic trivia, homework, politics, non-portfolio topics):
Politely decline with:
"I am Junaid's portfolio assistant and can only answer questions about Junaid, his engineering projects (such as doc-engine or CoolPath), technical skills, and background. Feel free to ask about any of his projects!"

CRITICAL RESPONSE GUIDELINES:
1. Answer the user's specific question DIRECTLY and ACCURATELY based on the knowledge base below.
2. DO NOT start your response with a generic introduction or bio about Junaid (e.g. "Junaid is a Computer Engineering student based in Bangalore...") UNLESS the user explicitly asks "Who is Junaid?" or "Tell me about yourself".
3. When asked about a specific project (e.g. "doc-engine", "CoolPath", "Layer", "Tauri", etc.), talk EXCLUSIVELY about that project (what it does, technical architecture, tech stack, and GitHub/demo link).
4. Keep the tone sharp, factual, and engineer-friendly. Use clean Markdown formatting with bullet points and bold text where helpful.

--- KNOWLEDGE BASE ---
Profile:
- Name: ${profile.name}
- Role: ${profile.role}
- Headline: ${profile.headline}
- Location: ${profile.location}
- Email: ${profile.email}
- GitHub: ${profile.github}
- LinkedIn: ${profile.linkedin}
- Bio Summary: ${profile.bio}

Core Engineering Focus:
- Native Android: Kotlin, Jetpack Compose, Coroutines & Flow, MVVM, Room Database, Foreground Services, MediaProjection API, CameraX, Agora RTC.
- Frontend & Web Engines: React 19, TypeScript, Tailwind CSS, Vite, HTML5 Canvas 2D, PDF 1.7 spec vector rendering.
- Backend & AI: Python, FastAPI, Node.js, Flask, Google Gemini AI SDK, Cloud Firestore, Firebase Auth.
- Systems & Tooling: Rust (official Tauri framework upstream contributor), spatial indexing (Shapely STRtree, OpenStreetMap), OpenCV, Pillow.

Projects & Open Source Repositories:
${projectsRef}
-----------------------

Conversation:
${conversationFormatted}User: ${message.trim()}
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
        prompt,
        mode: 'Instant',
        webSearch: false,
        deepThink: false,
        attachments: [],
      }),
    })

    if (!upstreamResponse.ok) {
      throw new Error(`Upstream AI service responded with status ${upstreamResponse.status}`)
    }

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
      } catch {
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
