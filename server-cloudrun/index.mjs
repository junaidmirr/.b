import express from 'express'
import cors from 'cors'

const app = express()
const PORT = process.env.PORT || 8080

app.use(cors())
app.use(express.json())

const SWIRL_API_URL = process.env.SWIRL_API_URL || 'https://swirls.chat/api/ask'

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'junaid-ai-cloudrun' })
})

app.post('/api/chat', async (req, res) => {
  try {
    const { message, history } = req.body

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' })
    }

    let conversationContext = ''
    if (Array.isArray(history) && history.length > 0) {
      const recent = history.slice(-4)
      conversationContext = `\nRecent Conversation:\n${recent
        .map((h) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`)
        .join('\n')}\n`
    }

    const prompt = `You are Junaid's personal AI Assistant embedded on his portfolio website.

CRITICAL INSTRUCTIONS:
1. Answer the user's question DIRECTLY, CONCISELY, and SPECIFICALLY based on the reference data below.
2. DO NOT output a generic introduction or bio about Junaid unless the user specifically asks "Who is Junaid?" or "Tell me about yourself".
3. When asked about a specific project (e.g. "doc-engine", "CoolPath", "Tauri contribution", etc.), answer directly about THAT project: its architecture, problem it solves, tech stack, and links.
4. Keep the tone sharp, professional, and engineer-friendly. Use clean Markdown formatting.

${conversationContext}
User Question: "${message.trim()}"

--- REFERENCE INFORMATION ABOUT JUNAID & HIS WORK ---
Profile:
- Name: Junaid
- Role: Software Developer
- Location: Bangalore, India (UTC+5:30)
- Email: junaidmeer055@gmail.com
- GitHub: https://github.com/junaidmirr
- LinkedIn: https://www.linkedin.com/in/junaid-mir-68b87b1b9/

Key Projects:
- doc-engine (@worklabs05/doc-engine): Headless document layout and vector PDF engine for React and TypeScript. Emits native vector PDF 1.7 paths and 60 FPS Canvas previews with zero headless browser / Puppeteer overhead. (Demo: https://docengine.worklabs.studio, GitHub: https://github.com/junaidmirr/doc-engine.git)
- Tauri Core CLI: Upstream PR #15634 in Tauri 2 release enabling CI prompt skipping when stdin is not a terminal. (https://github.com/tauri-apps/tauri/pull/15634)
- CoolPath: Urban microclimate navigation using FortyGuard thermal rasters, OpenStreetMap topology, Shapely STRtree, and Gemini 2.0. (GitHub: https://github.com/junaidmirr/coolpath_main)
- Edugate: Virtual classroom app with Agora RTC video conferencing, screen sharing, and Firebase.
- ResuMagic: AI resume builder and editor with Gemini, Flask, and OpenCV background remover.
- AI Credit & Inventory Manager: Small business finance assistant with Gemini 2.0 vision.
- JR Player: Custom web video player with HTML5 Video API.
---

Direct Answer to User Question:`

    const upstreamResponse = await fetch(SWIRL_API_URL, {
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
      throw new Error(`Upstream AI service error: ${upstreamResponse.status}`)
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
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Internal Server Error'
    if (!res.headersSent) {
      return res.status(500).json({ error: errorMsg })
    }
    res.write(`data: ${JSON.stringify({ error: errorMsg })}\n\n`)
    res.write('data: [DONE]\n\n')
    return res.end()
  }
})

app.listen(PORT, () => {
  console.log(`Junaid AI Cloud Run server listening on port ${PORT}`)
})
