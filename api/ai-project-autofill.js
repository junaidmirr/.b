export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' })
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const { repoUrl, readmeContent, customInstructions } = body

    if (!repoUrl && !readmeContent) {
      return res.status(400).json({
        error: 'Please provide either a GitHub repository URL or README content.',
      })
    }

    let owner = ''
    let repo = ''
    let cleanRepoUrl = ''
    let repoMetadata = null
    let fetchedReadme = readmeContent || ''

    // Parse GitHub repository URL if provided
    if (repoUrl && typeof repoUrl === 'string') {
      const trimmed = repoUrl.trim().replace(/\/+$/, '')
      cleanRepoUrl = trimmed.startsWith('http') ? trimmed : `https://github.com/${trimmed}`

      const match = cleanRepoUrl.match(/github\.com\/([^/]+)\/([^/]+)/i) || trimmed.match(/^([^/]+)\/([^/]+)$/)
      if (match) {
        owner = match[1]
        repo = match[2].replace(/\.git$/i, '')
        cleanRepoUrl = `https://github.com/${owner}/${repo}`
      }
    }

    // Fetch README from GitHub if not directly provided
    if (!fetchedReadme && owner && repo) {
      const readmeBranches = ['HEAD', 'main', 'master']
      for (const branch of readmeBranches) {
        try {
          const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/README.md`
          const resp = await fetch(rawUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
              Accept: 'text/plain, text/markdown, */*',
            },
          })
          if (resp.ok) {
            fetchedReadme = await resp.text()
            if (fetchedReadme && fetchedReadme.trim().length > 20) {
              break
            }
          }
        } catch {}
      }

      if (!fetchedReadme) {
        try {
          const apiUrl = `https://api.github.com/repos/${owner}/${repo}/readme`
          const apiResp = await fetch(apiUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
              Accept: 'application/vnd.github.v3+json',
            },
          })
          if (apiResp.ok) {
            const apiData = await apiResp.json()
            if (apiData.content && apiData.encoding === 'base64') {
              fetchedReadme = Buffer.from(apiData.content, 'base64').toString('utf8')
            }
          }
        } catch {}
      }

      try {
        const repoApiUrl = `https://api.github.com/repos/${owner}/${repo}`
        const repoResp = await fetch(repoApiUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
            Accept: 'application/vnd.github.v3+json',
          },
        })
        if (repoResp.ok) {
          repoMetadata = await repoResp.json()
        }
      } catch {}
    }

    if (!fetchedReadme && !repoMetadata) {
      return res.status(404).json({
        error:
          'Could not find a README.md for this repository. Ensure the repository is public or paste the README text directly.',
      })
    }

    const truncatedReadme = (fetchedReadme || '').slice(0, 9500)
    const repoDesc = repoMetadata?.description || ''
    const repoTopics = Array.isArray(repoMetadata?.topics) ? repoMetadata.topics.join(', ') : ''
    const repoHomepage = repoMetadata?.homepage || ''

    const prompt = `You are a staff systems engineer writing authentic portfolio documentation for Junaid Mir.
Analyze the following GitHub repository details and README, and output a strictly valid JSON object representing this portfolio project entry.

CRITICAL VOICE & QUALITY RULES:
1. Write like an experienced senior staff software engineer talking directly to other senior engineers: grounded, punchy, technical, and concrete.
2. ABSOLUTELY DO NOT USE ROBOTIC ACADEMIC HEADINGS:
   - NEVER write "### Problem Statement", "### Why it was built", "### Core Architecture", or "Under the hood".
   - NEVER write "To bridge the gap between X and Y" or generic AI introductory filler.
3. ABSOLUTELY DO NOT USE MARKETING CLICHES:
   - Banned words: "revolutionize", "seamlessly", "cutting-edge", "game changer", "testament to", "delve into".
   - Do NOT use hyphens as dashes in prose.
4. HEADINGS TO USE IN "fullDescription" (use markdown ### headers with blank lines):
   - "### Why [ProjectName]": Real-world developer friction, bottlenecks, or failure modes of naive approaches.
   - "### Architecture & Implementation": Concrete mechanisms (AST traversal, protocol bridges, data structures, algorithm details).
   - "### Key Subsystems": Technical breakdown of 3 to 4 major pillars with library names and benchmark metrics.
   - "### Performance & Benchmarks": Latency numbers, memory limits, and benchmarks from the README.

FEW-SHOT REFERENCE EXAMPLE FOR fullDescription:
"### Why Layer
If you use coding agents like Claude Code, Cursor, Windsurf, Codex or OpenCode on real projects, agents fall back to naive grep and dump whole files into prompts, burning 100k+ tokens while losing thread. Fixes turn into guessing games. Layer sits between your agent and your code over the Model Context Protocol.

### Architecture & Implementation
Instead of raw file dumps, Layer indexes codebases using Tree-sitter for surgical symbol extraction. By mapping the abstract syntax tree, it serves exact function slices and symbol outlines in milliseconds.

### Key Subsystems
- **In-memory AST Indexer**: Instant syntax and import verification in under 15ms without slow compiler boot times.
- **Safe Multi-file Refactor Engine**: Separates edited file syntax errors from pending downstream updates.
- **Compiler Circuit Breaker**: Integrates with language toolchains to supply verified type signatures.

### Performance & Benchmarks
Token usage for deep codebase tasks drops from 5.9M to 0.7M per session, reducing token overhead by nearly 90 percent."

FOR "category":
Choose the single most accurate category based on the repository domain:
- "System Architecture" (compilers, AST engines, MCP servers, protocols, performance infrastructure)
- "Open Source Tooling" (developer tools, CLI utilities, linters, developer libraries)
- "Full Stack AI App" (AI platforms, agent workflows, LLM applications)
- "Featured Open Source" (flagship open source releases)
- "Mobile Engineering" (Android, iOS, React Native applications)
- "Web Media Tool" (media editors, canvas tools, streaming utilities)
- "Full Stack Web" (general full stack web applications)
- "AI Microclimate Navigation Engine" (ONLY for microclimate or geospatial routing systems like CoolPath)
Do NOT output pipe characters like "|".

PORTFOLIO PROJECT JSON SCHEMA:
{
  "title": "Clean concise project title (e.g. doc-engine, CoolPath, Layer)",
  "category": "Exactly one chosen category string",
  "description": "Punchy, compelling 1-2 sentence overview for the project card view. Highlights the core engineering value and problem solved.",
  "fullDescription": "Deep technical case study formatted in Markdown following the senior engineer voice and structure above.",
  "stack": ["Main Language", "Framework", "Library 1", "Library 2", "Tooling"],
  "features": [
    "Sub-15ms incremental syntax checks using in-memory Tree-sitter ASTs",
    "Concrete technical feature 2",
    "Concrete technical feature 3",
    "Concrete technical feature 4"
  ],
  "technologies": [
    {
      "name": "Subsystem or Component Name (e.g. AST Indexer, Vector Serializer, or Spatial Engine)",
      "details": "Technical breakdown of how this component operates, what algorithms it uses, and performance specs."
    },
    {
      "name": "Frontend or Core Pipeline",
      "details": "Explanation of the UI state flow, protocol bridge, or execution loop."
    }
  ],
  "icon": "One of: code | globe | rocket | spark | layout | shield | briefcase",
  "linkLabel": "View case study",
  "githubUrl": "${cleanRepoUrl || ''}",
  "liveUrl": "${repoHomepage || ''}"
}

${customInstructions ? `USER CUSTOM INSTRUCTIONS: ${customInstructions}\n` : ''}
REPOSITORY METADATA:
- Name: ${repo || 'Unknown'}
- Owner: ${owner || 'Unknown'}
- GitHub Description: ${repoDesc}
- Topics: ${repoTopics}
- Homepage: ${repoHomepage}

README CONTENT:
${truncatedReadme || 'No README text available; use repository metadata above.'}
`

    // Call Swirl AI upstream service
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
    let replyText = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue

        const raw = trimmed.slice(5).trim()
        if (raw === '[DONE]') break

        try {
          const parsed = JSON.parse(raw)
          if (parsed.swirl) continue
          const delta = parsed.choices?.[0]?.delta?.content
          if (delta) {
            replyText += delta
          }
        } catch {}
      }
    }

    let cleaned = replyText.trim()
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/, '').replace(/```\s*$/, '').trim()
    }

    const firstBrace = cleaned.indexOf('{')
    const lastBrace = cleaned.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.slice(firstBrace, lastBrace + 1)
    }

    let parsedProject
    try {
      parsedProject = JSON.parse(cleaned)
    } catch (parseError) {
      console.warn('JSON parse error from Swirl AI output:', cleaned)
      return res.status(502).json({
        error: 'AI generated response could not be parsed into valid project JSON.',
        raw: cleaned,
      })
    }

    // Clean and polish fullDescription to strip any robotic templates or clichés
    let polishedFullDesc = (parsedProject.fullDescription || parsedProject.description || '').trim()
    const projectTitle = parsedProject.title || repo || 'Project'

    polishedFullDesc = polishedFullDesc
      // Replace generic academic headings
      .replace(/###\s*Problem Statement[:\s]*/gi, `### Why ${projectTitle}\n\n`)
      .replace(/###\s*Why it was built[:\s]*/gi, '\n\n')
      .replace(/###\s*Core Architecture[:\s]*/gi, '\n\n### Architecture & Implementation\n\n')
      .replace(/###\s*(?:How it works|Under the hood)[:\s]*/gi, '\n\n### Architecture & Implementation\n\n')
      // Normalize inline section titles into markdown headers if LLM emitted them inline
      .replace(/(?:^|\n)(?:Why\s+[^:\n]+:)/gi, `\n\n### Why ${projectTitle}\n\n`)
      .replace(/(?:^|\n)(?:Architecture\s*&\s*Implementation:|How it works:)/gi, '\n\n### Architecture & Implementation\n\n')
      .replace(/(?:^|\n)(?:Key Subsystems:|Core Subsystems:)/gi, '\n\n### Key Subsystems\n\n')
      .replace(/(?:^|\n)(?:Performance\s*&\s*(?:Scaling|Benchmarks):)/gi, '\n\n### Performance & Benchmarks\n\n')
      // Remove AI clichés
      .replace(/To bridge the gap between [^.]+and [^.]+\.\s*/gi, '')
      .replace(/bridge the gap between/gi, 'connect')
      .replace(/under the hood,?\s*/gi, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    // Sanitize and ensure required defaults
    const finalProject = {
      title: projectTitle,
      category: (parsedProject.category || 'Full Stack Web').replace(/\|/g, ',').trim(),
      description: parsedProject.description || repoDesc || 'Software project developed by Junaid.',
      fullDescription: polishedFullDesc,
      stack: Array.isArray(parsedProject.stack) && parsedProject.stack.length > 0 ? parsedProject.stack : ['TypeScript'],
      features: Array.isArray(parsedProject.features) && parsedProject.features.length > 0 ? parsedProject.features : ['Core functionality'],
      technologies: Array.isArray(parsedProject.technologies) && parsedProject.technologies.length > 0
        ? parsedProject.technologies
        : [{ name: 'Architecture', details: 'Component implementation' }],
      icon: parsedProject.icon || 'code',
      linkLabel: parsedProject.linkLabel || 'View case study',
      githubUrl: cleanRepoUrl || parsedProject.githubUrl || '',
      liveUrl: parsedProject.liveUrl || repoHomepage || '',
    }

    return res.status(200).json({
      success: true,
      project: finalProject,
      metadata: {
        owner,
        repo,
        readmeLength: fetchedReadme.length,
      },
    })
  } catch (error) {
    console.error('Error in ai-project-autofill handler:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal Server Error during AI autofill',
    })
  }
}
