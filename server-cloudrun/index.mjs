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
      conversationContext = history
        .slice(-6)
        .map((h) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`)
        .join('\n')
      conversationContext = `\nRecent Conversation:\n${conversationContext}\n`
    }

    const systemPrompt = `You are Junaid's AI Assistant embedded in his personal portfolio.
Junaid is a Software Developer based in Bangalore, India.
He specializes in:
1. Native Android development (Kotlin, Jetpack Compose, MVVM, Room DB, Foreground Services, Agora RTC).
2. Frontend & document rendering engines (React 19, TypeScript, PDF 1.7 spec, HTML5 Canvas 2D).
3. AI & Backend architectures (Python, FastAPI, Node.js, Flask, Google Gemini AI SDK, Cloud Firestore).
4. Systems & Tooling: Rust (official Tauri upstream contributor).

Key Projects:
- doc-engine (@worklabs05/doc-engine): Headless document layout and vector PDF engine for React and TypeScript.
- Tauri Core CLI: Upstream PR #15634 in Tauri 2 release enabling CI prompt skipping.
- CoolPath: Urban microclimate navigation using FortyGuard thermal rasters, OpenStreetMap topology, and Gemini 2.0.
- Edugate: Virtual classroom app with Agora RTC video and Firebase.
- ResuMagic: AI resume builder and editor with Gemini and Flask.
- AI Credit & Inventory: Small business finance assistant with Gemini 2.0 vision.

Contact: junaidmeer055@gmail.com
GitHub: https://github.com/junaidmirr
LinkedIn: https://www.linkedin.com/in/junaid-mir-68b87b1b9/

Guidelines: Be concise, technically precise, polite, and helpful.`

    const fullPrompt = `${systemPrompt}\n${conversationContext}\nUser: ${message.trim()}\nAssistant:`

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
        prompt: fullPrompt,
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
      } catch (streamErr) {
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
