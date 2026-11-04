import { useState, useRef, useEffect, type FormEvent } from 'react'
import { saveChatSession } from '../services/chatLogService'
import type { ChatSession } from '../types'

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTED_PROMPTS = [
  'Tell me about doc-engine',
  'CoolPath heat navigation',
  'Tauri CLI contribution',
  'What is your Android stack?',
  'How can I contact Junaid?',
]

const SESSION_STORAGE_KEY = 'junaid_chat_session_id'
const SESSION_START_KEY = 'junaid_chat_session_start'

let memorySessionId = ''
let memoryCreatedAt = ''

function detectInAppBrowser(): string {
  if (typeof navigator === 'undefined') return 'Web Browser'
  const ua = navigator.userAgent || ''
  if (/Instagram/i.test(ua)) return 'Instagram In-App'
  if (/FBAN|FBAV/i.test(ua)) return 'Facebook In-App'
  if (/TikTok/i.test(ua)) return 'TikTok In-App'
  if (/Twitter|X-App/i.test(ua)) return 'Twitter/X In-App'
  if (/LinkedIn/i.test(ua)) return 'LinkedIn In-App'
  if (/MicroMessenger/i.test(ua)) return 'WeChat In-App'
  if (/CriOS/i.test(ua)) return 'Chrome iOS'
  if (/Chrome/i.test(ua) && /Mobile/i.test(ua)) return 'Chrome Mobile'
  if (/Mobile.*Safari/i.test(ua) && !/Chrome|CriOS/i.test(ua)) return 'Mobile Safari'
  if (/Chrome/i.test(ua)) return 'Desktop Chrome'
  if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) return 'Desktop Safari'
  if (/Firefox/i.test(ua)) return 'Firefox'
  return 'Web Browser'
}

function getOrCreateSessionId(): { id: string; createdAt: string } {
  if (typeof window === 'undefined') {
    const now = new Date().toISOString()
    return { id: `sess_${Date.now()}`, createdAt: now }
  }
  try {
    let id = window.sessionStorage?.getItem(SESSION_STORAGE_KEY)
    let createdAt = window.sessionStorage?.getItem(SESSION_START_KEY)
    if (!id || !createdAt) {
      id = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
      createdAt = new Date().toISOString()
      window.sessionStorage?.setItem(SESSION_STORAGE_KEY, id)
      window.sessionStorage?.setItem(SESSION_START_KEY, createdAt)
    }
    return { id, createdAt }
  } catch {
    // In-app browsers (Instagram, etc.) or Private Browsing mode can block sessionStorage
    if (!memorySessionId) {
      memorySessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
      memoryCreatedAt = new Date().toISOString()
    }
    return { id: memorySessionId, createdAt: memoryCreatedAt }
  }
}

export function AiAssistant() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "Hi! I'm Junaid's AI assistant. Ask me anything about his projects (like doc-engine, CoolPath, or his Tauri contribution), technical skills, or engineering background.",
    },
  ])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [hasInteracted, setHasInteracted] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (isOpen) {
      scrollToBottom()
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen, messages])

  // Custom event trigger to open from error pages or navigation
  useEffect(() => {
    const handleOpenAI = () => {
      setIsOpen(true)
    }
    window.addEventListener('open-junaid-ai', handleOpenAI)
    return () => window.removeEventListener('open-junaid-ai', handleOpenAI)
  }, [])

  // ESC to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  const persistSession = async (allMessages: Message[]) => {
    const chatTurns = allMessages.filter((m) => m.id !== 'welcome')
    if (chatTurns.length === 0) return

    const { id: sessionId, createdAt } = getOrCreateSessionId()
    const firstUserMsg = chatTurns.find((m) => m.role === 'user')
    const summary = firstUserMsg
      ? firstUserMsg.content.slice(0, 100)
      : 'Visitor conversation'

    const sessionData: ChatSession = {
      id: sessionId,
      createdAt,
      updatedAt: new Date().toISOString(),
      summary,
      messageCount: chatTurns.length,
      browser: detectInAppBrowser(),
      messages: chatTurns.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: new Date().toISOString(),
      })),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    }

    try {
      await saveChatSession(sessionData)
    } catch (err) {
      console.warn('Could not persist chat session:', err)
    }
  }

  const handleSend = async (userPrompt?: string) => {
    const text = (userPrompt || input).trim()
    if (!text || isStreaming) return

    setHasInteracted(true)
    setInput('')

    const userMessage: Message = {
      id: 'u_' + Date.now(),
      role: 'user',
      content: text,
    }

    const assistantMsgId = 'a_' + Date.now()
    const initialAssistantMessage: Message = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
    }

    const updatedWithUser = [...messages, userMessage, initialAssistantMessage]
    setMessages(updatedWithUser)
    setIsStreaming(true)

    // Immediately persist user prompt so session is saved even if user switches apps mid-reply
    persistSession([...messages, userMessage])

    let finalReply = ''

    try {
      // Build conversation history (excluding welcome message)
      const history = messages
        .filter((m) => m.id !== 'welcome')
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content }))

      // Call hidden serverless proxy endpoint
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Server responded with status ${response.status}`)
      }

      if (!response.body) {
        throw new Error('No response stream available')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

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
            if (parsed.text) {
              finalReply += parsed.text
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId ? { ...msg, content: finalReply } : msg
                )
              )
            } else if (parsed.error) {
              finalReply += `\n[Error: ${parsed.error}]`
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId ? { ...msg, content: finalReply } : msg
                )
              )
            }
          } catch {}
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to connect to AI Assistant'
      finalReply = `I'm currently unable to reply: ${errorMsg}`
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId ? { ...msg, content: finalReply } : msg
        )
      )
    } finally {
      setIsStreaming(false)
      // Save completed conversation to Firestore / local storage
      const finalTurnMessages = [
        ...messages,
        userMessage,
        { id: assistantMsgId, role: 'assistant' as const, content: finalReply },
      ]
      persistSession(finalTurnMessages)
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    handleSend()
  }

  const clearChat = () => {
    try {
      window.sessionStorage?.removeItem(SESSION_STORAGE_KEY)
      window.sessionStorage?.removeItem(SESSION_START_KEY)
    } catch {}
    memorySessionId = ''
    memoryCreatedAt = ''
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content:
          "Conversation cleared. How can I help you explore Junaid's projects or skills?",
      },
    ])
    setHasInteracted(false)
  }

  return (
    <>
      {/* Floating Trigger Button */}
      <div className="fixed bottom-5 right-5 z-40">
        {!isOpen && (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            aria-label="Open AI Assistant"
            className="group flex items-center gap-2.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-xs font-medium text-[var(--color-text)] shadow-lg hover:border-[var(--color-border-hover)] transition-all tap-spring cursor-pointer"
          >
            <span className="flex h-2 w-2 items-center justify-center">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </span>
            <span>Ask Junaid AI</span>
          </button>
        )}
      </div>

      {/* Chat Window */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Junaid AI Assistant Chat"
          className="fixed bottom-5 right-5 z-50 flex h-[540px] max-h-[85vh] w-[390px] max-w-[calc(100vw-2.5rem)] flex-col rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl overflow-hidden font-sans animate-in zoom-in-95 duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)]/80 px-4 py-3 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <div>
                <span className="text-xs font-semibold text-[var(--color-text)]">
                  Junaid AI Assistant
                </span>
                <span className="ml-2 text-[10px] text-[var(--color-muted)]">
                  Instant
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={clearChat}
                title="Clear conversation"
                className="px-2 py-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] cursor-pointer tap-spring font-medium"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Close [ESC]"
                className="flex h-7 w-7 items-center justify-center rounded-full text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] cursor-pointer tap-spring"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Quick Suggestions (if no conversation yet) */}
          {!hasInteracted && (
            <div className="border-b border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2.5">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-muted)] mb-1.5">
                Quick questions:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => handleSend(prompt)}
                    className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-muted)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-text)] transition-colors cursor-pointer text-left tap-spring"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <span className="mb-1 text-[10px] text-[var(--color-muted)] font-medium">
                  {msg.role === 'user' ? 'You' : 'Junaid AI'}
                </span>
                <div
                  className={`px-4 py-2.5 max-w-[88%] leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'rounded-2xl rounded-br-xs bg-[#111317] text-white dark:bg-white dark:text-neutral-900 font-medium'
                      : 'rounded-2xl rounded-bl-xs border border-[var(--color-border)] bg-[var(--color-panel)] text-[var(--color-text)]'
                  }`}
                >
                  {msg.content}
                  {msg.role === 'assistant' && isStreaming && msg.content.length === 0 && (
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface)] p-3"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              disabled={isStreaming}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isStreaming ? 'Thinking...' : 'Ask about Junaid, doc-engine, CoolPath...'}
              className="flex-1 rounded-full border border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-2 text-xs text-[var(--color-text)] placeholder-[var(--color-muted)] focus:border-[var(--color-accent)] focus:outline-none transition-all"
            />
            <button
              type="submit"
              disabled={!input.trim() || isStreaming}
              className="btn-primary px-4 py-2 text-xs disabled:opacity-40 cursor-pointer tap-spring"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  )
}
