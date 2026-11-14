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

let cachedPortfolio = null
let cacheTimestamp = 0
const CACHE_TTL_MS = 45 * 1000 // 45-second cache to ensure ultra-fast responses while picking up Admin Panel updates rapidly

async function getPortfolioContext() {
  const now = Date.now()
  if (cachedPortfolio && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedPortfolio
  }

  // 1. Check live Firestore database (real-time updates from Admin Panel)
  const apiKey =
    process.env.FIREBASE_API_KEY ||
    process.env.VITE_FIREBASE_API_KEY ||
    'AIzaSyAG6aINdRC8bNhNwpF6lz6FQMjbOO0d-_Y'
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    'myportfolio-3e477'

  if (apiKey && projectId) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3500)
      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/portfolio/content?key=${apiKey}`
      const response = await fetch(url, { signal: controller.signal })
      clearTimeout(timeoutId)

      if (response.ok) {
        const firestoreDoc = await response.json()
        if (firestoreDoc?.fields) {
          const docData = unwrapFirestoreValue({ mapValue: { fields: firestoreDoc.fields } })
          if (docData && typeof docData === 'object' && (docData.profile || docData.projects)) {
            cachedPortfolio = docData
            cacheTimestamp = now
            return docData
          }
        }
      }
    } catch (err) {
      console.warn('Firestore fetch warning:', err)
    }
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
        const data = JSON.parse(content)
        cachedPortfolio = data
        cacheTimestamp = now
        return data
      }
    } catch {}
  }
  return cachedPortfolio || null
}

// ==========================================
// LIVE GITHUB README INGESTION & PARSING
// ==========================================
const readmeCache = new Map()

function parseGithubRepo(url) {
  if (!url || typeof url !== 'string') return null
  const match = url.trim().match(/github\.com\/([^/]+)\/([^/#?]+)/i)
  if (!match) return null
  const owner = match[1]
  const repo = match[2].replace(/\.git$/i, '')
  return { owner, repo }
}

function extractUsageSections(markdown) {
  if (!markdown) return ''
  const lines = markdown.split('\n')
  const extracted = []
  let capturing = false
  let sectionTitle = ''
  let linesCount = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const isHeading = /^#{1,3}\s+(.+)$/.exec(line)

    if (isHeading) {
      const headingText = isHeading[1].toLowerCase()
      if (
        /install|quick\s*start|usage|getting\s*started|react|example|basic\s*example|setup|shortcut|operating\s*mode|connect\s*to/i.test(
          headingText
        ) &&
        !/contribut|licen|author|benchmark/i.test(headingText)
      ) {
        capturing = true
        sectionTitle = isHeading[1]
        extracted.push(`\n### ${sectionTitle}`)
        linesCount = 0
        continue
      } else if (capturing && isHeading[0].startsWith('## ')) {
        capturing = false
      }
    }

    if (capturing) {
      extracted.push(line)
      linesCount++
      if (linesCount > 65) {
        capturing = false
      }
    }
  }

  return extracted.join('\n').trim()
}

async function fetchProjectReadme(githubUrl) {
  const parsed = parseGithubRepo(githubUrl)
  if (!parsed) return null

  const cacheKey = `${parsed.owner}/${parsed.repo}`.toLowerCase()
  const cached = readmeCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000) {
    return cached.content
  }

  const branches = ['main', 'master']
  for (const branch of branches) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3000)
      const rawUrl = `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/${branch}/README.md`
      const res = await fetch(rawUrl, { signal: controller.signal })
      clearTimeout(timeoutId)
      if (res.ok) {
        let text = await res.text()
        if (text.length > 5500) {
          text = text.slice(0, 5500) + '\n\n[...README truncated for brevity...]'
        }
        readmeCache.set(cacheKey, { timestamp: Date.now(), content: text })
        return text
      }
    } catch {}
  }
  return null
}

function findProjectInText(text, projectList) {
  if (!text || !Array.isArray(projectList)) return null
  const cleanText = (text || '').toLowerCase().replace(/[^a-z0-9]/g, '')

  // Explicit alias patterns first to ensure pinpoint accuracy
  if (/doc[\s_-]*engine/.test(text.toLowerCase())) {
    const match = projectList.find((p) => /doc[\s_-]*engine/i.test(p.title))
    if (match) return match
  }
  if (/open[\s_-]*clipper|clipboard/i.test(text.toLowerCase())) {
    const match = projectList.find((p) => /open[\s_-]*clipper/i.test(p.title))
    if (match) return match
  }
  if (/cool[\s_-]*path/i.test(text.toLowerCase())) {
    const match = projectList.find((p) => /cool[\s_-]*path/i.test(p.title))
    if (match) return match
  }
  if (/\blayer\b/i.test(text.toLowerCase())) {
    const match = projectList.find((p) => /^layer$/i.test(p.title.trim()))
    if (match) return match
  }
  if (/\btauri\b/i.test(text.toLowerCase())) {
    const match = projectList.find((p) => /tauri/i.test(p.title))
    if (match) return match
  }
  if (/resumagic/i.test(text.toLowerCase())) {
    const match = projectList.find((p) => /resumagic/i.test(p.title))
    if (match) return match
  }
  if (/edugate/i.test(text.toLowerCase())) {
    const match = projectList.find((p) => /edugate/i.test(p.title))
    if (match) return match
  }
  if (/fipper|on[\s_-]*screen[\s_-]*ai/i.test(text.toLowerCase())) {
    const match = projectList.find((p) => /ai\s*assistant|on-screen/i.test(p.title))
    if (match) return match
  }

  // Scan all projects by title
  for (const p of projectList) {
    const cleanTitle = (p.title || '').toLowerCase().replace(/[^a-z0-9]/g, '')
    if (cleanTitle.length > 2 && cleanText.includes(cleanTitle)) {
      return p
    }
  }
  return null
}

function findEssayInText(text, essayList) {
  if (!text || !Array.isArray(essayList)) return null
  const cleanText = (text || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  for (const e of essayList) {
    const cleanTitle = (e.title || '').toLowerCase().replace(/[^a-z0-9]/g, '')
    const cleanSlug = (e.slug || '').toLowerCase().replace(/[^a-z0-9]/g, '')
    if (cleanTitle.length > 5 && cleanText.includes(cleanTitle)) return e
    if (cleanSlug.length > 5 && cleanText.includes(cleanSlug)) return e
  }
  return null
}

function resolveActiveEntity(message, history, portfolio) {
  const projects = portfolio?.projects || []
  const essays = portfolio?.essays || []

  // 1. Direct mention in current user prompt
  const directProject = findProjectInText(message, projects)
  if (directProject) return { type: 'project', entity: directProject }

  const directEssay = findEssayInText(message, essays)
  if (directEssay) return { type: 'essay', entity: directEssay }

  // 2. Check for follow-up pronouns or continuous context in message
  const isFollowUp =
    /^(how\s+to\s+use\s+it|how\s+to\s+install|how\s+do\s+i|how\s+to|what\s+about\s+it|where\s+is\s+it|can\s+i|show\s+me|is\s+it|does\s+it|explain\s+it|use\s+it|setup|run\s+it|install\s+it|give\s+an\s+example|code\s+example)/i.test(
      message.trim()
    ) ||
    /\b(it|this|that|project|library|tool|repo|code|cli)\b/i.test(message)

  if (isFollowUp && Array.isArray(history) && history.length > 0) {
    for (let i = history.length - 1; i >= 0; i--) {
      const pastContent = history[i].content || ''
      const pastProj = findProjectInText(pastContent, projects)
      if (pastProj) return { type: 'project', entity: pastProj }

      const pastEssay = findEssayInText(pastContent, essays)
      if (pastEssay) return { type: 'essay', entity: pastEssay }
    }
  }

  return null
}

function classifyUserIntent(message) {
  const clean = (message || '').toLowerCase()
  if (
    /architecture|how\s+does|how\s+it\s+works|how\s+does\s+it\s+work|under\s+the\s+hood|internals|mechanics|design|ast|rendering\s*pipeline|benchmark|why\s*(not|without|no)|without\s+(puppeteer|chrome|python)|algorithm|pipeline/.test(
      clean
    )
  ) {
    return 'ARCHITECTURE'
  }
  if (
    /how\s+to\s+(use|setup|set\s*up|install|run|import|integrate|get\s*started|add)|how\s+do\s+i\s+(use|setup|install|run|import)|usage|install|setup|set\s*up|quickstart|quick\s*start|example|tutorial|code\s*sample|npm\s*install|cargo\s*install|yarn\s*add|pnpm\s*add|docker\s*run/.test(
      clean
    )
  ) {
    return 'USAGE_SETUP'
  }
  if (/repo|github|source\s*code|where\s*(is|to\s*find)\s*(it|the\s*code)|link|url/.test(clean)) {
    return 'REPO_LINK'
  }
  return 'GENERAL'
}

function findMatchingProject(projects, query) {
  if (!Array.isArray(projects) || projects.length === 0) return null
  const direct = findProjectInText(query, projects)
  if (direct) return direct

  const q = (query || '').toLowerCase().trim()
  const cleanQ = q.replace(/[^a-z0-9]/g, '')
  const tokens = q.split(/[^a-zA-Z0-9]+/).filter((t) => t.length > 2)

  let best = null
  let maxScore = -1

  for (const p of projects) {
    let score = 0
    const title = (p.title || '').toLowerCase()
    const cleanTitle = title.replace(/[^a-z0-9]/g, '')
    const cat = (p.category || '').toLowerCase()
    const stackStr = (p.stack || []).map((s) => s.toLowerCase()).join(' ')
    const desc = (p.description || '').toLowerCase()

    if (cleanTitle && cleanQ.includes(cleanTitle)) score += 60
    if (title === q) score += 50
    if (title.length > 2 && (q.includes(title) || title.includes(q))) score += 30

    for (const t of tokens) {
      if (title.includes(t)) score += 20
      if (stackStr.includes(t)) score += 10
      if (cat.includes(t)) score += 8
      if (desc.includes(t)) score += 5
    }

    if (score > maxScore) {
      maxScore = score
      best = p
    }
  }

  return maxScore >= 10 ? best : null
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

  // 5. Contact & Reach Out Inquiries
  const isDirectContactInquiry =
    /^(how\s*(can|do)\s*i\s*(contact|reach|email|hire)|what\s*is\s*(his|junaid's|the)?\s*email|how\s*to\s*(contact|reach|email|hire)|contact\s*(info|details)?|get\s*in\s*touch)/.test(
      stripped
    ) && !/project|layer|doc|essay|article|code/.test(stripped)
  if (isDirectContactInquiry) {
    return {
      type: 'direct',
      response:
        "You can reach Junaid directly via his professional email at **contact@junaidmir.me**. You can also connect with him on [GitHub](https://github.com/junaidmirr) or [LinkedIn](https://www.linkedin.com/in/junaid-mir-68b87b1b9/).",
    }
  }

  // 6. Generic Coding & Off-Topic Task Blockers (Block if NO portfolio context is mentioned)
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
      const matched = findMatchingProject(projects, query)
      const q = (query || '').toLowerCase().trim()
      const tokens = q.split(/[^a-zA-Z0-9]+/).filter((t) => t.length > 2)

      const scored = projects.map((p) => {
        let score = 0
        const title = (p.title || '').toLowerCase()
        const cat = (p.category || '').toLowerCase()
        const stackStr = (p.stack || []).map((s) => s.toLowerCase()).join(' ')
        const desc = (p.description || '').toLowerCase()

        if (matched && p.id === matched.id) score += 100
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

  read_github_readme: {
    name: 'read_github_readme',
    description: 'Fetch and parse the live GitHub README.md repository file for a specific project via its githubUrl to inspect detailed architecture, codebase mechanics, setup, and features.',
    execute: async (portfolio, query) => {
      const projects = portfolio?.projects || []
      const matched = findProjectInText(query, projects) || findMatchingProject(projects, query)

      let targetUrl = ''
      let projectTitle = query

      if (query && query.includes('github.com')) {
        targetUrl = query
        projectTitle = matched?.title || 'Repository'
      } else if (matched) {
        targetUrl = matched.githubUrl || ''
        projectTitle = matched.title
      }

      if (!targetUrl) {
        return {
          projectTitle,
          status: 'no_github_url',
          readmeContent: null,
          message: 'No GitHub repository URL provided for this project in the portfolio database.',
        }
      }

      const readme = await fetchProjectReadme(targetUrl)
      const usage = extractUsageSections(readme)

      return {
        projectTitle,
        githubUrl: targetUrl,
        status: readme ? 'success' : 'not_found',
        quickstartAndUsage: usage || null,
        readmeContent: readme || 'README file could not be retrieved from the repository or repository is empty.',
      }
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
async function resolveTools(message, history, portfolio) {
  const toolInvocations = []
  const essays = portfolio?.essays || []
  const projects = portfolio?.projects || []

  const active = resolveActiveEntity(message, history, portfolio)
  const intent = classifyUserIntent(message)

  // SCENARIO 1: A specific project is actively targeted (directly or through pronoun context)
  if (active && active.type === 'project') {
    const project = active.entity
    toolInvocations.push({
      tool: TOOLS.get_project_details,
      query: project.title,
    })

    if (project.githubUrl) {
      toolInvocations.push({
        tool: TOOLS.read_github_readme,
        query: project.title,
      })
    }
    // STRICT MUTUAL EXCLUSION:
    // Do NOT run get_essay_content or list_essays or list_projects here!
    // This stops cross-contamination completely.
  }
  // SCENARIO 2: A specific essay is actively targeted
  else if (active && active.type === 'essay') {
    const essay = active.entity
    toolInvocations.push({
      tool: TOOLS.get_essay_content,
      query: essay.title,
    })
    toolInvocations.push({
      tool: TOOLS.list_essays,
      query: '',
    })
  }
  // SCENARIO 3: Broad or multi-entity queries
  else {
    const q = (message || '').toLowerCase()
    const historyText = Array.isArray(history)
      ? history.map((h) => (h.content || '').toLowerCase()).join(' ')
      : ''
    const combined = `${historyText} ${q}`

    const isEssayQuery = /essay|article|writing|read\s*about/.test(combined)
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

    const isProjectQuery = /project|portfolio|built|software|app|tool|work/.test(combined)
    if (isProjectQuery) {
      toolInvocations.push({
        tool: TOOLS.list_projects,
        query: '',
      })
    }

    const isSkillQuery = /skill|stack|technology|language|framework|rust|kotlin|typescript|python|android|compose/.test(
      combined
    )
    if (isSkillQuery) {
      toolInvocations.push({
        tool: TOOLS.list_skills,
        query: '',
      })
    }

    const isProfileQuery =
      /who|about|junaid|contact|email|reach|hire|bangalore|experience|education|student|github|linkedin/.test(
        combined
      )
    if (isProfileQuery || toolInvocations.length === 0) {
      toolInvocations.unshift({
        tool: TOOLS.get_profile,
        query: '',
      })
      if (!toolInvocations.some((t) => t.tool.name === 'list_projects')) {
        toolInvocations.push({
          tool: TOOLS.list_projects,
          query: '',
        })
      }
      if (!toolInvocations.some((t) => t.tool.name === 'list_essays')) {
        toolInvocations.push({
          tool: TOOLS.list_essays,
          query: '',
        })
      }
    }
  }

  // Execute each tool and collect results asynchronously
  const executedTools = []
  for (const { tool, query } of toolInvocations) {
    const result = await tool.execute(portfolio, query)
    executedTools.push({
      name: tool.name,
      description: tool.description,
      query,
      result,
    })
  }
  return { executedTools, intent, active }
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

    // 2. LOAD PORTFOLIO & RUN RELEVANT TOOLS (LIVE FIRESTORE + GITHUB README)
    const portfolio = await getPortfolioContext()
    const { executedTools, intent, active } = await resolveTools(message, history, portfolio)

    // Build tool context for the LLM
    let toolsContext = executedTools
      .map(
        (t) =>
          `[TOOL_CALL: ${t.name}${t.query ? `("${t.query}")` : '()'}]\nDATA:\n${JSON.stringify(
            t.result,
            null,
            2
          )}`
      )
      .join('\n\n')

    // If user asked for USAGE/SETUP, highlight the extracted Quickstart / Usage documentation at the top
    const readmeTool = executedTools.find((t) => t.name === 'read_github_readme')
    if (intent === 'USAGE_SETUP' && readmeTool?.result?.quickstartAndUsage) {
      toolsContext =
        `[PRIMARY_INSTALLATION_AND_USAGE_DOCUMENTATION for ${readmeTool.result.projectTitle}]\n${readmeTool.result.quickstartAndUsage}\n\n` +
        toolsContext
    }

    let conversationFormatted = ''
    if (Array.isArray(history) && history.length > 0) {
      const recent = history.slice(-6)
      conversationFormatted =
        recent.map((h) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`).join('\n') +
        '\n'
    }

    let intentDirective = ''
    if (intent === 'USAGE_SETUP') {
      intentDirective = `\n[CRITICAL INSTRUCTION FOR THIS QUERY: USAGE / INSTALLATION REQUEST]\nThe visitor is asking how to install, set up, or use this project.\nStart DIRECTLY with the concrete installation command, script, or setup instructions from the documentation (e.g. \`npm install...\`, \`curl ... | sh\`, or cargo).\nProvide working code snippets or configuration steps from the README.\nDo NOT give a high-level conceptual overview instead of answering the install/setup question!\n`
    } else if (intent === 'ARCHITECTURE') {
      intentDirective = `\n[CRITICAL INSTRUCTION FOR THIS QUERY: ARCHITECTURAL MECHANICS & HOW IT WORKS]\nThe visitor is asking how the project operates internally, its rendering engine, or why it avoids external dependencies like Puppeteer or Python.\nExplain the architectural mechanics clearly (e.g. vector coordinate transformation, HTML5 canvas preview, direct PDF 1.7 operator emission, AST parsing in Rust) and the performance advantages.\nDo NOT output installation scripts when the visitor is asking about architecture!\n`
    } else if (intent === 'REPO_LINK') {
      intentDirective = `\n[CRITICAL INSTRUCTION FOR THIS QUERY: REPOSITORY / LINK REQUEST]\nThe visitor is asking for the repository, GitHub URL, or source code.\nProvide the verified repository link and live URL directly from the project metadata.\n`
    }

    const prompt = `You are the personal AI Assistant for Junaid Mir's engineering portfolio (junaidmir.me).

[CORE DIRECTIVES]
1. PERSON & PRONOUNS (CRITICAL):
   - You are Junaid's assistant, NOT Junaid himself.
   - ALWAYS refer to Junaid in the THIRD PERSON ("Junaid", "he", "his").
   - NEVER say "I am a computer engineering student" or "my work" or "my projects".
   - Examples of correct phrasing:
     * "Junaid Mir is a computer engineering student and software developer based in Bangalore..."
     * "His primary projects include Layer and doc-engine..."
     * "In doc-engine, Junaid designed..."

2. ANSWER THE EXACT QUESTION ASKED (INTENT-AWARE ACCURACY):
   - When the visitor asks HOW TO USE, HOW TO SETUP, HOW TO INSTALL, or for a CODE EXAMPLE (e.g. "how to setup and use doc-engine", "how to use it?", "how to use doc engine in my project react"):
     * Deliver direct, practical, step-by-step instructions.
     * Always provide the exact package install command from the documentation (e.g. \`npm install @worklabs05/doc-engine pdf-lib react react-dom\` or the platform install script).
     * Always provide a clean, minimal code snippet (e.g. React \`<Document>\`, \`<Page>\`, \`<View>\`, \`<Text>\`, and \`usePDF\` hook) directly from the retrieved documentation.
     * DO NOT substitute an abstract architectural lecture when the visitor asked for setup instructions!
   - When the visitor asks about ARCHITECTURE, HOW IT WORKS, or UNDER THE HOOD:
     * Explain the architectural mechanics (e.g. Tree-sitter AST traversal in Rust, pure TypeScript PDF 1.7 vector operator serialization, STRtree spatial indexing).
   - When the visitor asks a GENERAL OVERVIEW ("what is X?"):
     * Summarize the problem, key insight, and capabilities.

3. CONVERSATION CONTEXT & PRONOUN RESOLUTION:
   - When the visitor asks follow-up questions like "how to use it?", "where is it hosted?", or "can I use it in react?", "it" refers to the project currently being discussed. Stay strictly focused on that entity!
   - NEVER jump to another project (like CoolPath or Layer) when the user is asking about the current project.

4. TECHNOLOGY FIDELITY & ZERO CROSS-CONTAMINATION (CRITICAL):
   - Strictly honor the true technologies of each project:
     * doc-engine: Pure TypeScript and React vector PDF engine. Zero Python, zero headless browsers (Puppeteer). Published as @worklabs05/doc-engine.
     * Layer: Model Context Protocol (MCP) server written in Rust with Tree-sitter AST parsing.
     * OpenClipper: Multi-entry clipboard manager in Rust and Tauri with system-wide keyboard shortcuts.
     * CoolPath: Climate-aware routing engine written with Python and spatial STRtree indexing.
   - NEVER attribute Python to doc-engine, and NEVER attribute Rust to CoolPath.

5. NO BOILERPLATE CONTACT ENDINGS:
   - DO NOT append unsolicited "For inquiries, you can reach out at contact@junaidmir.me" or "Feel free to contact him at..." at the end of answers!
   - ONLY provide contact info when the user explicitly asks how to contact, email, or hire Junaid.

6. SCOPE & IDENTITY INTEGRITY:
   - Your sole identity is Junaid Mir's portfolio AI assistant. NEVER identify as or mention "Swirl", "OpenAI", or any other third-party model.
   - NEVER write generic code templates (like arbitrary HTML/Python homework).
   - Only answer questions related to Junaid's portfolio, software projects, technical essays, skills, and background.

${intentDirective}
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
