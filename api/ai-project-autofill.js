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

      // Match github.com/owner/repo or owner/repo
      const match = cleanRepoUrl.match(/github\.com\/([^/]+)\/([^/]+)/i) || trimmed.match(/^([^/]+)\/([^/]+)$/)
      if (match) {
        owner = match[1]
        repo = match[2].replace(/\.git$/i, '')
        cleanRepoUrl = `https://github.com/${owner}/${repo}`
      }
    }

    // If no direct README was provided and we have owner/repo, fetch from GitHub
    if (!fetchedReadme && owner && repo) {
      const readmeBranches = ['HEAD', 'main', 'master']
      for (const branch of readmeBranches) {
        try {
          const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/README.md`
          const resp = await fetch(rawUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)',
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

      // If raw file fetch failed, attempt public GitHub API
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

      // Optionally fetch basic repo metadata (homepage, topics, description)
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

    // Limit README to 10,000 characters to keep prompt tightly focused
    const truncatedReadme = (fetchedReadme || '').slice(0, 10000)
    const repoDesc = repoMetadata?.description || ''
    const repoTopics = Array.isArray(repoMetadata?.topics) ? repoMetadata.topics.join(', ') : ''
    const repoHomepage = repoMetadata?.homepage || ''

    const prompt = `You are an elite software engineering portfolio curator writing directly for Junaid Mir's portfolio.
Analyze the following GitHub repository details and README, and output a strictly valid JSON object representing a featured portfolio project entry.

CRITICAL VOICE & EDITORIAL RULES:
1. Write like an authentic senior staff software engineer talking to other engineers: grounded, punchy, technical, and concrete.
2. STRICTLY FORBIDDEN ROBOTIC HEADINGS:
   - DO NOT write "### Problem Statement", "### Why it was built", "### Core Architecture", or "### How it works".
   - DO NOT use the cliché phrase "Under the hood".
   - DO NOT write robotic textbook introductions like "In today's fast-paced world" or "To bridge the gap between AI and reality".
3. STRICTLY FORBIDDEN AI BUZZWORDS:
   - DO NOT use: "bridge the gap", "revolutionize", "seamlessly", "cutting-edge", "game changer", "testament to", "delve into".
   - DO NOT use hyphens as dashes in sentences.
4. HOW JUNAID'S PORTFOLIO PROSE SOUNDS (Style Reference):
   "If you use coding agents like Claude Code, Cursor, Windsurf, Codex or OpenCode on real projects, you have probably seen these problems: agents fall back to grep, dump whole files into prompts, burn 100k+ tokens, and lose thread. Fixes turn into guessing games. Layer sits between your agent and your code and talks over the standard Model Context Protocol. Instead of raw file dumps, the agent gets symbol outlines, exact function slices, impact graphs and compile checks in milliseconds."
5. REQUIRED STRUCTURE FOR "fullDescription":
   - "Why [ProjectName]": Real-world developer friction, bottlenecks, or what breaks when using naive tools.
   - "How it works": Concrete mechanisms (AST traversal, protocol bridges, data structures, algorithm details).
   - "Core Subsystems": Technical breakdown of 3 to 4 major pillars with library names and benchmark metrics.
   - "Performance & Scaling": Latency numbers, memory limits, and benchmarks from the README.
6. FOR "category":
   - Pick EXACTLY ONE clean string from: "Featured Open Source", "System Architecture", "Open Source Tooling", "AI Microclimate Navigation Engine", "Full Stack AI App", "Mobile Engineering", "Web Media Tool", "Full Stack Web".
   - Do NOT output pipe characters like "|".

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

    // Clean and extract JSON from AI response
    let cleaned = replyText.trim()
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/, '').replace(/```\s*$/, '').trim()
    }

    // Try finding JSON object bounds if wrapped in extra text
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

    // Sanitize and ensure required defaults
    const finalProject = {
      title: parsedProject.title || repo || 'Untitled Project',
      category: (parsedProject.category || 'Full Stack Web').replace(/\|/g, ',').trim(),
      description: parsedProject.description || repoDesc || 'Software project developed by Junaid.',
      fullDescription: parsedProject.fullDescription || parsedProject.description || '',
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
