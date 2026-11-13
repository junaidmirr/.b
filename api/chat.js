import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

function unwrapFirestoreValue(val) {
  if (!val || typeof val !== 'object') return val
  if ('stringValue' in val) return val.stringValue
  if ('booleanValue' in val) return val.booleanValue
  if ('integerValue' in val) return parseInt(val.integerValue, 10)
  if ('doubleValue' in val) return parseFloat(val.doubleValue)
  if ('arrayValue' in val) {
    return (val.arrayValue.values || []).map(unwrapFirestoreValue)
  }
  if ('mapValue' in val) {
    const res = {}
    const fields = val.mapValue.fields || {}
    for (const [k, v] of Object.entries(fields)) {
      res[k] = unwrapFirestoreValue(v)
    }
    return res
  }
  return val
}

async function getPortfolioContext() {
  // 1. Check live Firestore database (real-time updates from Admin Panel)
  const apiKey = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || ''
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || ''

  if (apiKey && projectId) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 1600)
      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/portfolio/content?key=${apiKey}`
      const response = await fetch(url, { signal: controller.signal })
      clearTimeout(timeoutId)

      if (response.ok) {
        const firestoreDoc = await response.json()
        if (firestoreDoc?.fields) {
          const docData = unwrapFirestoreValue({ mapValue: { fields: firestoreDoc.fields } })
          if (docData && typeof docData === 'object' && docData.profile) {
            return docData
          }
        }
      }
    } catch {}
  }

  // 2. Fallback to latest local data files
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
// DETERMINISTIC GUARDRAIL & SCOPE CLASSIFIER
// ==========================================
function classifyGuardrailIntent(message) {
  const clean = (message || '').trim().toLowerCase()
  const stripped = clean.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()

  // 1. Pure Greetings (do NOT dump projects or Layer)
  const pureGreetings = [
    'hi',
    'hello',
    'hey',
    'hiya',
    'hola',
    'greetings',
    'good morning',
    'good afternoon',
    'good evening',
    'yo',
    'sup',
    'hello there',
    'hi there',
  ]
  if (
    pureGreetings.includes(stripped) ||
    /^(hi|hello|hey|greetings)\s+(there|assistant|junaid)?$/.test(stripped)
  ) {
    return {
      type: 'direct',
      response:
        "Hello! I am Junaid Mir's portfolio AI assistant. How can I help you explore his software projects, technical essays, or engineering background?",
    }
  }

  // 2. Disinterest / Stop / Polite Closures (do NOT dump unprompted bio/projects)
  const disinterestPatterns = [
    /^(no|nope|nah)$/,
    /^no\s+(i\s*a?m\s*not|not)\s*(interested|looking)/,
    /^(not\s*interested|stop|nevermind|never\s*mind|cancel)/,
    /^(i\s*didnt\s*ask|didnt\s*ask|why\s*you\s*giving|dont\s*give\s*me)/,
    /^(bye|goodbye|see\s*ya|cya)$/,
    /^(thanks|thank\s*you|thx)$/,
    /^(ok|okay|got\s*it|cool)$/,
  ]
  if (disinterestPatterns.some((p) => p.test(stripped))) {
    return {
      type: 'direct',
      response:
        "Understood. If you have any specific questions about Junaid's engineering projects, essays, skills, or would like to get in touch, feel free to ask whenever you're ready.",
    }
  }

  // 3. Model Identity / Engine Inquiries (NEVER leak Swirl or third-party identities)
  const identityPatterns = [
    /which\s*(ai)?\s*(model|modal|llm|engine|system)\s*are\s*you/,
    /what\s*(ai)?\s*(model|modal|llm|engine)\s*are\s*you/,
    /who\s*(created|made|built|trained)\s*you/,
    /are\s*you\s*(swirl|gpt|chatgpt|claude|gemini|openai|anthropic|deepseek|llama|meta)/,
    /what\s*is\s*your\s*(model|name|architecture)/,
    /who\s*are\s*you/,
  ]
  if (identityPatterns.some((p) => p.test(stripped))) {
    return {
      type: 'direct',
      response:
        "I am Junaid Mir's personal portfolio AI assistant. I am built exclusively to help visitors explore Junaid's software engineering projects, technical essays, skills, and background.",
    }
  }

  // 4. Scope & Restriction Inquiries
  const restrictionPatterns = [
    /aren\s*t\s*you\s*restricted/,
    /are\s*you\s*restricted/,
    /what\s*are\s*your\s*restrictions/,
    /what\s*(can|cant)\s*you\s*answer/,
  ]
  if (restrictionPatterns.some((p) => p.test(stripped))) {
    return {
      type: 'direct',
      response:
        "Yes, I am strictly restricted to answering questions directly related to Junaid Mir's engineering portfolio: his projects (like Layer, doc-engine, CoolPath), technical essays, skill competencies, and background. I cannot assist with general programming requests, homework, or unrelated topics.",
    }
  }

  // 5. Generic Coding & Off-Topic Task Blockers (Block if NO portfolio context is mentioned)
  const portfolioKeywords = [
    'junaid',
    'mir',
    'layer',
    'doc-engine',
    'doc engine',
    'coolpath',
    'tauri',
    'resumagic',
    'edugate',
    'openclipper',
    'clipper',
    'tree-sitter',
    'ast',
    'postscript',
    'pdf 1.7',
    'thermal friction',
    'portfolio',
    'essay',
    'essays',
    'resume',
    'contact',
    'email',
    'hire',
    'bangalore',
    'github',
    'linkedin',
  ]
  const mentionsPortfolio = portfolioKeywords.some((kw) => clean.includes(kw))

  const genericTaskPatterns = [
    /(can\s*you\s*)?(write|create|generate|give\s*me)\s*(a|an|some|basic)?\s*(html|css|javascript|js|python|java|cpp|c\+\+|rust|bash|sql|php|ruby)\s*(code|script|template|page|program|snippet)/,
    /write\s*(a|an)?\s*(script|program|function|algorithm)\s*to/,
    /how\s*to\s*(cook|bake|make)\s*(pasta|cake|pizza|bread|food|dinner)/,
    /(write|tell)\s*(me)?\s*(a)?\s*(joke|poem|story|song|essay\s*about)/,
    /solve\s*(this)?\s*(math|equation|physics|problem|homework)/,
    /who\s*(is|was)\s*(the\s*president|the\s*prime\s*minister|the\s*king|albert\s*einstein|elon\s*musk|trump|biden)/,
    /what\s*is\s*the\s*capital\s*of/,
    /weather\s*in/,
  ]

  if (!mentionsPortfolio && genericTaskPatterns.some((p) => p.test(stripped))) {
    return {
      type: 'direct',
      response:
        "I am Junaid Mir's portfolio assistant and can only answer questions directly related to Junaid, his engineering projects, technical essays, and background. I cannot write general code templates or answer unrelated questions, but feel free to ask about any of Junaid's work!",
    }
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

  // Check for specific project queries
  const isProjectQuery =
    /layer|doc-engine|doc engine|tauri|coolpath|resumagic|edugate|credit|inventory|mcp|parser|android app|what projects|your projects|list projects/.test(
      combined
    )
  if (isProjectQuery) {
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

  // Check for profile / contact queries
  const isProfileQuery =
    /who|about|junaid|contact|email|reach|hire|location|bangalore|experience|background|education|college|student|social|linkedin|github/.test(
      combined
    )
  if (isProfileQuery) {
    toolInvocations.unshift({
      tool: TOOLS.get_profile,
      query: '',
    })
  }

  // Default fallback if no specific tool matched yet
  if (toolInvocations.length === 0) {
    toolInvocations.push({
      tool: TOOLS.get_profile,
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

    // 1. FAST-PATH DETERMINISTIC GUARDRAIL
    // Catches greetings, disinterest, identity leaks, and out-of-scope tasks with zero upstream latency
    const guard = classifyGuardrailIntent(message)
    if (guard && guard.response) {
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache, no-transform')
      res.setHeader('Connection', 'keep-alive')

      res.write(`data: ${JSON.stringify({ text: guard.response })}\n\n`)
      res.write('data: [DONE]\n\n')
      return res.end()
    }

    // 2. LOAD PORTFOLIO & RUN RELEVANT TOOLS
    const portfolio = await getPortfolioContext()
    const executedTools = resolveTools(message, history, portfolio)

    // Build tool context for the LLM
    const toolsContext = executedTools
      .map(
        (t) =>
          `[TOOL_CALL: ${t.name}${t.query ? `("${t.query}")` : '()'}]\nDATA:\n${JSON.stringify(
            t.result,
            null,
            2
          )}`
      )
      .join('\n\n')

    let conversationFormatted = ''
    if (Array.isArray(history) && history.length > 0) {
      const recent = history.slice(-5)
      conversationFormatted =
        recent.map((h) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`).join('\n') +
        '\n'
    }

    const prompt = `You are Junaid Mir's personal portfolio AI assistant on junaidmir.me.

[STRICT IDENTITY & SCOPE DIRECTIVES]
1. YOU ARE ONLY JUNAID MIR'S PORTFOLIO ASSISTANT. NEVER mention, identify as, or claim to be "Swirl", "OpenAI", "ChatGPT", "Claude", "Gemini", or any other product or company. If asked about your identity, state ONLY: "I am Junaid Mir's portfolio AI assistant."
2. ABSOLUTE DOMAIN RESTRICTION: You ONLY answer questions directly related to Junaid Mir, his software projects, his technical essays, his skills, and his background.
3. NEVER WRITE GENERAL CODE: DO NOT write generic HTML templates, sample scripts, or code solutions for unrelated programming questions. If the user asks for generic coding assistance, decline:
   "I am Junaid Mir's portfolio assistant and can only answer questions directly related to Junaid, his engineering projects, technical essays, and background. I cannot write general code templates, but feel free to ask about any of his work!"
4. CONTACT EMAIL: Only ever provide contact@junaidmir.me. Never reveal, guess, or mention any other email address.
5. BE CONCISE & ON-TOPIC: Do NOT dump large unprompted project breakdowns unless the user specifically asks for them. Answer the user's specific question factually using the tool data below.

[SYSTEM TOOLS EXECUTED & DATA RETRIEVED]
${toolsContext}

[CONVERSATION]
${conversationFormatted}User: ${message.trim()}
Assistant:`

    // Setup Server-Sent Events stream
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')

    // Immediately stream tool invocation events one by one with a brief cadence
    for (const t of executedTools) {
      res.write(
        `data: ${JSON.stringify({
          tool_call: {
            name: t.name,
            query: t.query || undefined,
          },
        })}\n\n`
      )
      await new Promise((resolve) => setTimeout(resolve, 140))
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
            let delta = parsed.choices?.[0]?.delta?.content
            if (delta) {
              // Sanitize any upstream model brand leaks
              delta = delta.replace(/\bSwirl\b/gi, "Junaid's AI assistant")
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
