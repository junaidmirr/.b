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

// ==========================================
// TOOL CALLING SYSTEM DEFINITIONS
// ==========================================
const TOOLS = {
  get_profile: {
    name: 'get_profile',
    description: "Fetch Junaid Mir's profile, bio, role, location, focus area, current technical exploration, and verified contact channels.",
    execute: (portfolio) => {
      const p = portfolio?.profile || {}
      return {
        name: p.name || 'Junaid Mir',
        role: p.role || 'Computer Engineering Student & Software Developer',
        headline: p.headline || 'I build developer tools and mobile apps',
        heroSubtext: p.heroSubtext || 'Computer engineering student in Bangalore. Merged contributor to Tauri.',
        bio: p.bio || 'Computer engineering student and software developer building developer tools, mobile applications, and systems software.',
        location: p.location || 'Bangalore, India',
        focus: p.focus || 'Developer tooling, AST manipulation, mobile architecture',
        exploring: p.exploring || 'Rust internals, memory-efficient PDF processing',
        contactEmail: 'contact@junaidmir.me',
        github: p.github || 'https://github.com/junaidmirr',
        linkedin: p.linkedin || 'https://www.linkedin.com/in/junaid-mir-68b87b1b9/',
      }
    },
  },

  list_projects: {
    name: 'list_projects',
    description: 'List all software projects with title, category, summary, outcome, and primary tech stack.',
    execute: (portfolio) => {
      const projects = portfolio?.projects || []
      return projects.map((p) => ({
        title: p.title,
        category: p.category,
        outcome: p.outcome || p.features?.[0] || '',
        summary: p.description,
        stack: p.stack || [],
        githubUrl: p.githubUrl || '',
        liveUrl: p.liveUrl || '',
      }))
    },
  },

  get_project_details: {
    name: 'get_project_details',
    description: 'Fetch complete technical architecture, key features, subsystem details, outcomes, and code repositories for matching projects.',
    execute: (portfolio, query) => {
      const projects = portfolio?.projects || []
      const q = (query || '').toLowerCase().trim()
      const tokens = q.split(/[^a-zA-Z0-9]+/).filter((t) => t.length > 2)

      const scored = projects.map((p) => {
        let score = 0
        const title = (p.title || '').toLowerCase()
        const cat = (p.category || '').toLowerCase()
        const stackStr = (p.stack || []).map((s) => s.toLowerCase()).join(' ')
        const desc = (p.description || '').toLowerCase()

        if (title === q) score += 50
        if (q.includes(title) || (title.length > 2 && title.includes(q))) score += 30
        if (cat.includes(q)) score += 15

        for (const t of tokens) {
          if (title.includes(t)) score += 20
          if (stackStr.includes(t)) score += 10
          if (desc.includes(t)) score += 8
        }
        return { project: p, score }
      })

      scored.sort((a, b) => b.score - a.score)
      const topMatches = scored.filter((s) => s.score >= 15).map((s) => s.project)
      const selected = topMatches.length > 0 ? topMatches.slice(0, 2) : projects.slice(0, 2)

      return selected.map((p) => ({
        title: p.title,
        category: p.category,
        summary: p.description,
        outcome: p.outcome || '',
        fullArchitecture: p.fullDescription,
        techStack: p.stack || [],
        features: p.features || [],
        technologies: p.technologies || [],
        githubUrl: p.githubUrl || 'N/A',
        liveUrl: p.liveUrl || 'N/A',
      }))
    },
  },

  list_skills: {
    name: 'list_skills',
    description: 'Retrieve technical competencies categorized by Languages, Mobile, Web & Systems, Backend & AI, and Tooling.',
    execute: (portfolio) => {
      if (Array.isArray(portfolio?.skills) && portfolio.skills.length > 0) {
        return portfolio.skills
      }
      return [
        { category: 'Languages', items: 'Rust, Kotlin, TypeScript, Python, SQL, C/C++' },
        { category: 'Mobile', items: 'Android SDK, Jetpack Compose, Coroutines/Flow, Room DB, Material 3' },
        { category: 'Web & Systems', items: 'React 19, Next.js, Node.js, Tailwind CSS, Tauri 2.0' },
        { category: 'Backend & AI', items: 'FastAPI, PostgreSQL, Firebase/Firestore, Redis, Vector Embeddings' },
        { category: 'Tooling', items: 'Git, Docker, Linux, Tree-sitter, GitHub Actions, Vite' },
      ]
    },
  },

  list_essays: {
    name: 'list_essays',
    description: 'List all technical essays with title, slug, reading time, date, category, and abstract.',
    execute: (portfolio) => {
      const essays = portfolio?.essays || []
      return essays.map((e) => ({
        title: e.title,
        slug: e.slug,
        category: e.category,
        date: e.date,
        readingTime: e.readingTime,
        abstract: e.excerpt,
        link: `/essay/${e.slug}`,
      }))
    },
  },

  get_essay_content: {
    name: 'get_essay_content',
    description: 'Retrieve the complete markdown article content, formulas, benchmarks, and code snippets for a specific essay.',
    execute: (portfolio, query) => {
      const essays = portfolio?.essays || []
      const q = (query || '').toLowerCase().trim()
      const tokens = q.split(/[^a-zA-Z0-9]+/).filter((t) => t.length > 2)

      const scored = essays.map((e) => {
        let score = 0
        const title = (e.title || '').toLowerCase()
        const slug = (e.slug || '').toLowerCase()
        const cat = (e.category || '').toLowerCase()

        if (title.includes(q) || slug.includes(q)) score += 40
        for (const t of tokens) {
          if (title.includes(t)) score += 20
          if (slug.includes(t)) score += 20
          if (cat.includes(t)) score += 10
        }
        return { essay: e, score }
      })

      scored.sort((a, b) => b.score - a.score)
      const best = scored[0]?.score >= 10 ? scored[0].essay : essays[0]

      if (!best) return null
      return {
        title: best.title,
        slug: best.slug,
        category: best.category,
        date: best.date,
        readingTime: best.readingTime,
        abstract: best.excerpt,
        fullContent: best.content,
        externalLink: best.externalLink || '',
      }
    },
  },
}

// Router to decide which tools to execute based on user message and history
function resolveTools(message, history, portfolio) {
  const q = (message || '').toLowerCase()
  const historyText = Array.isArray(history)
    ? history.map((h) => (h.content || '').toLowerCase()).join(' ')
    : ''
  const combined = `${historyText} ${q}`

  const toolInvocations = []

  // Check for essay queries
  const isEssayQuery =
    /essay|article|post|write|writing|read|openclipper|grep|thermal|coolpath|pdf|postscript|ast slicing|landsat|shapely/.test(
      combined
    )
  if (isEssayQuery) {
    toolInvocations.push({
      tool: TOOLS.get_essay_content,
      query: message,
    })
    toolInvocations.push({
      tool: TOOLS.list_essays,
      query: '',
    })
  }

  // Check for project queries
  const isProjectQuery =
    /project|work|app|built|repo|github|demo|code|layer|doc-engine|doc engine|tauri|coolpath|resumagic|edugate|credit|inventory|mcp|parser|android app/.test(
      combined
    )
  if (isProjectQuery || !isEssayQuery) {
    toolInvocations.push({
      tool: TOOLS.get_project_details,
      query: message,
    })
  }

  // Check for skill / stack queries
  const isSkillQuery =
    /skill|stack|technology|technologies|language|framework|rust|kotlin|typescript|python|android|compose|backend|tooling|database/.test(
      combined
    )
  if (isSkillQuery) {
    toolInvocations.push({
      tool: TOOLS.list_skills,
      query: '',
    })
  }

  // Check for profile / contact queries or default foundational context
  const isProfileQuery =
    /who|about|junaid|contact|email|reach|hire|location|bangalore|experience|background|education|college|student|social|linkedin|github/.test(
      combined
    )
  if (isProfileQuery || toolInvocations.length === 0) {
    toolInvocations.unshift({
      tool: TOOLS.get_profile,
      query: '',
    })
  }

  // Always ensure at least profile and projects list are available for broad context
  if (!toolInvocations.some((t) => t.tool.name === 'get_profile')) {
    toolInvocations.unshift({
      tool: TOOLS.get_profile,
      query: '',
    })
  }
  if (!toolInvocations.some((t) => t.tool.name === 'list_projects') && !toolInvocations.some((t) => t.tool.name === 'get_project_details')) {
    toolInvocations.push({
      tool: TOOLS.list_projects,
      query: '',
    })
  }

  // Execute each tool and collect results
  return toolInvocations.map(({ tool, query }) => {
    const result = tool.execute(portfolio, query)
    return {
      name: tool.name,
      description: tool.description,
      query,
      result,
    }
  })
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
    const executedTools = resolveTools(message, history, portfolio)

    // Build tool context for the LLM
    const toolsContext = executedTools
      .map((t) => `[TOOL_CALL: ${t.name}${t.query ? `("${t.query}")` : '()'}]\nDATA:\n${JSON.stringify(t.result, null, 2)}`)
      .join('\n\n')

    let conversationFormatted = ''
    if (Array.isArray(history) && history.length > 0) {
      const recent = history.slice(-5)
      conversationFormatted = recent
        .map((h) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`)
        .join('\n') + '\n'
    }

    const prompt = `You are the official AI Assistant for Junaid Mir's personal engineering portfolio (junaidmir.me).
You are equipped with a live tool-calling system that retrieves verified real-time data from Junaid's portfolio database.

[SYSTEM TOOLS EXECUTED & DATA RETRIEVED]
${toolsContext}

[CORE DIRECTIVES]
1. Answer factually, authoritatively, and concisely using the tool data provided above.
2. When asked about projects (Layer, doc-engine, Tauri CLI contribution, CoolPath, ResuMagic, etc.), delve into their technical architecture, problem statement, key features, and outcomes retrieved from the tool data.
3. When asked about essays or technical writing (OpenClipper, AST slicing vs grep, CoolPath thermal friction, or PostScript parsing), quote and reference the exact details, formulas, and code from get_essay_content.
4. When asked for contact information, ONLY provide the professional email: contact@junaidmir.me. Never reveal, guess, or mention any other email.
5. If the user asks general, off-topic questions (e.g. general cooking recipes, homework unrelated to Junaid, politics, games), politely decline:
   "I am Junaid's portfolio assistant and can only answer questions about Junaid, his engineering projects, technical essays, and background. Feel free to ask about any of his work!"
6. If the user asks what tools you have or how you access data, explain that you have live access to tools: get_profile, list_projects, get_project_details, list_skills, list_essays, and get_essay_content.
7. Format your response cleanly using GitHub-flavored Markdown (bolding, inline code, code blocks, bullet points).

[CONVERSATION]
${conversationFormatted}User: ${message.trim()}
Assistant:`

    // Setup Server-Sent Events stream
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')

    // Immediately send tool invocation events so the client can display tool badges
    for (const t of executedTools) {
      res.write(
        `data: ${JSON.stringify({
          tool_call: {
            name: t.name,
            query: t.query || undefined,
          },
        })}\n\n`
      )
    }

    // Call upstream AI service securely
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
    const errMsg = error instanceof Error ? error.message : 'Internal AI Assistant Error'
    if (!res.headersSent) {
      return res.status(500).json({ error: errMsg })
    }
    res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`)
    res.write('data: [DONE]\n\n')
    return res.end()
  }
}
