import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

function getPortfolioContext() {
  const possiblePaths = [
    path.join(path.dirname(fileURLToPath(import.meta.url)), 'portfolioData.json'),
    path.join(process.cwd(), 'api', 'portfolioData.json'),
    path.join(process.cwd(), 'src', 'portfolioData.json'),
  ]

  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf8')
        return JSON.parse(content)
      }
    } catch {}
  }
  return null
}

function getMatchingProjects(projects, query) {
  if (!Array.isArray(projects) || projects.length === 0) return { matched: [], isExplicit: false }
  const q = (query || '').toLowerCase()

  const scored = projects.map((p) => {
    let score = 0
    const title = (p.title || '').toLowerCase()
    if (q.includes(title) || (title.length > 3 && title.includes(q))) score += 30

    const tokens = q.split(/[^a-zA-Z0-9]+/).filter((t) => t.length > 2)
    for (const t of tokens) {
      if (title.includes(t)) score += 15
      if ((p.description || '').toLowerCase().includes(t)) score += 5
      if (Array.isArray(p.stack) && p.stack.some((s) => s.toLowerCase().includes(t))) score += 5
    }
    return { project: p, score }
  })

  scored.sort((a, b) => b.score - a.score)

  if (scored[0] && scored[0].score >= 15) {
    return { matched: [scored[0].project], isExplicit: true }
  }

  return { matched: scored.slice(0, 5).map((s) => s.project), isExplicit: false }
}

function buildProjectReference(projects, isExplicit) {
  if (!Array.isArray(projects) || projects.length === 0) return ''

  if (!isExplicit) {
    return projects
      .map((p) => `- **${p.title}** (${p.category}): ${p.description}`)
      .join('\n')
  }

  return projects
    .map((p, index) => {
      const stack = Array.isArray(p.stack) ? p.stack.join(', ') : ''
      const features = Array.isArray(p.features) ? p.features.map((f) => `  * ${f}`).join('\n') : ''
      const tech = Array.isArray(p.technologies)
        ? p.technologies.map((t) => `  * ${t.name}: ${t.details}`).join('\n')
        : ''

      return `Project ${index + 1}: ${p.title}
- Category: ${p.category}
- Summary: ${p.description}
- Technical Overview: ${p.fullDescription}
- Tech Stack: ${stack}
- GitHub Link: ${p.githubUrl || 'N/A'}
- Live Demo: ${p.liveUrl || 'N/A'}
- Key Features:
${features}
- Architecture & Technologies:
${tech}`
    })
    .join('\n\n---\n\n')
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
      headline: 'Software Developer',
      bio: "Computer Engineering student and software engineer with expertise in native Android (Kotlin, Jetpack Compose), modern web engineering (React 19, TypeScript), systems tooling (Rust, Tauri upstream contributor), and AI architectures.",
      location: 'Bangalore, India',
      email: 'junaidmeer055@gmail.com',
      github: 'https://github.com/junaidmirr',
      linkedin: 'https://www.linkedin.com/in/junaid-mir-68b87b1b9/',
    }

    const { matched, isExplicit } = getMatchingProjects(portfolio?.projects || [], message)
    const projectsRef = buildProjectReference(matched, isExplicit)

    let conversationFormatted = ''
    if (Array.isArray(history) && history.length > 0) {
      const recent = history.slice(-4)
      conversationFormatted = recent
        .map((h) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`)
        .join('\n') + '\n'
    }

    const prompt = `You are Junaid Mir's portfolio AI assistant embedded on his personal engineering portfolio.

STRICT SCOPE RULE:
You answer questions ONLY about Junaid, his background, his engineering skills, contact details, or his software projects.
If the user asks an off-topic question (recipes, cooking, homework, general coding questions not about Junaid's work, games, math, trivia, weather, politics):
YOU MUST DECLINE POLITELY with:
"I am Junaid's portfolio assistant and can only answer questions about Junaid, his engineering projects (such as doc-engine or CoolPath), technical skills, and background. Feel free to ask about any of his projects!"
Do NOT answer off-topic questions.

CRITICAL INSTRUCTIONS:
1. When asked about a specific project, describe THAT project directly: architecture, problem it solves, tech stack, and links.
2. DO NOT start with Junaid's general bio unless the user explicitly asks "Who is Junaid?" or "Tell me about yourself".
3. Keep answers sharp, factual, and formatted cleanly with Markdown.

--- REFERENCE KNOWLEDGE BASE ---
Profile:
- Name: ${profile.name}
- Role: ${profile.role}
- Location: ${profile.location}
- Email: ${profile.email}
- GitHub: ${profile.github}
- LinkedIn: ${profile.linkedin}

Projects & Repositories:
${projectsRef}
--------------------------------

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
