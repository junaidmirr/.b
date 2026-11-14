import { useState, useRef, useEffect, type FormEvent } from 'react'
import { saveChatSession } from '../services/chatLogService'
import type { ChatSession } from '../types'

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

type AiAssistantProps = {
  showFloatingButton?: boolean
}

const SUGGESTED_PROMPTS = [
  'Tell me about doc-engine',
  'How does Layer AST parsing work?',
  'What did Junaid contribute to Tauri?',
  'What is the OpenClipper essay about?',
  'How can I get in touch?',
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
    if (!memorySessionId) {
      memorySessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
      memoryCreatedAt = new Date().toISOString()
    }
    return { id: memorySessionId, createdAt: memoryCreatedAt }
  }
}

export function AiAssistant({ showFloatingButton = false }: AiAssistantProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "Hello. I am Junaid's AI assistant. Ask me anything about his projects (Layer, doc-engine, Tauri CLI contribution, CoolPath), technical stack, or background.",
    },
  ])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [activeToolStatus, setActiveToolStatus] = useState<string | null>(null)
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

  // Custom event trigger to open from footer link or elsewhere
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
    const sessionData: ChatSession = {
      id: sessionId,
      createdAt,
      updatedAt: new Date().toISOString(),
      summary: chatTurns[0]?.content.slice(0, 80) || 'Visitor chat session',
      messageCount: chatTurns.length,
      browser: detectInAppBrowser(),
      messages: chatTurns.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: new Date().toISOString(),
      })),
    }

    try {
      await saveChatSession(sessionData)
    } catch {}
  }

  const handleSend = async (messageText?: string) => {
    const textToSend = (messageText ?? input).trim()
    if (!textToSend || isStreaming) return

    setInput('')
    setHasInteracted(true)

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
    }

    const assistantMsgId = `assistant-${Date.now()}`
    const placeholderMessage: Message = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
    }

    setMessages((prev) => [...prev, userMessage, placeholderMessage])
    setIsStreaming(true)
    setActiveToolStatus('connecting...')

    let finalReply = ''

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          history: messages
            .filter((m) => m.id !== 'welcome')
            .slice(-6)
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Server returned status ${response.status}`)
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
            if (parsed.tool_call) {
              const name = parsed.tool_call.name || ''
              const actionText = name.startsWith('get_')
                ? name.replace(/^get_/, 'getting_') + '...'
                : name.startsWith('list_')
                ? name.replace(/^list_/, 'listing_') + '...'
                : name.startsWith('read_')
                ? name.replace(/^read_/, 'reading_') + '...'
                : name + '...'
              setActiveToolStatus(actionText)
            } else if (parsed.text) {
              // Answer text started generating, clear tool call status immediately
              setActiveToolStatus(null)
              finalReply += parsed.text
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId ? { ...msg, content: finalReply } : msg
                )
              )
            } else if (parsed.error) {
              setActiveToolStatus(null)
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
      setActiveToolStatus(null)
      const errorMsg = err instanceof Error ? err.message : 'Failed to connect to AI Assistant'
      finalReply = `I'm currently unable to reply: ${errorMsg}`
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId ? { ...msg, content: finalReply } : msg
        )
      )
    } finally {
      setIsStreaming(false)
      setActiveToolStatus(null)
      const finalTurnMessages = [
        ...messages,
        userMessage,
        {
          id: assistantMsgId,
          role: 'assistant' as const,
          content: finalReply,
        },
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
          "Conversation reset. What would you like to know about Junaid's work or systems?",
      },
    ])
    setHasInteracted(false)
  }

  return (
    <>
      {/* Optional Floating Trigger Button */}
      {showFloatingButton && !isOpen && (
        <div className="fixed bottom-5 right-5 z-40">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            aria-label="Open AI Assistant"
            className="border border-[var(--color-border)] bg-[var(--color-bg)] px-3.5 py-2 text-xs font-mono text-[var(--color-text)] shadow-sm hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors cursor-pointer"
          >
            [Ask AI]
          </button>
        </div>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Junaid AI Assistant Chat"
          className="fixed bottom-0 right-0 sm:bottom-6 sm:right-6 z-50 flex h-[540px] max-h-[90vh] w-full sm:w-[420px] max-w-full flex-col border border-[var(--color-border)] bg-[var(--color-bg)] shadow-2xl overflow-hidden font-sans"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3">
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="text-[var(--color-accent)] font-semibold">[AI]</span>
              <span className="font-medium text-[var(--color-text)]">
                Assistant
              </span>
              <span className="text-[11px] text-[var(--color-text-subtle)]">
                · online
              </span>
            </div>

            <div className="flex items-center gap-3 font-mono text-xs">
              <button
                type="button"
                onClick={clearChat}
                title="Clear conversation"
                className="text-[var(--color-text-subtle)] hover:text-[var(--color-text)] cursor-pointer"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Close [ESC]"
                className="text-[var(--color-text-subtle)] hover:text-[var(--color-accent)] cursor-pointer"
              >
                [Close]
              </button>
            </div>
          </div>

          {/* Quick Suggestions (if no interaction yet) */}
          {!hasInteracted && (
            <div className="border-b border-[var(--color-border)] bg-[var(--color-code-bg)] px-4 py-2.5 space-y-1.5">
              <span className="block font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-subtle)]">
                Suggested questions
              </span>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => handleSend(prompt)}
                    className="border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-xs font-mono text-[var(--color-text-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors cursor-pointer text-left"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm leading-relaxed">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-[11px] font-mono text-[var(--color-text-subtle)]">
                    {msg.role === 'user' ? 'You' : 'Assistant'}
                  </span>
                </div>

                <div
                  className={`p-3 max-w-[90%] whitespace-pre-wrap text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'border border-[var(--color-accent)] bg-[var(--color-code-bg)] text-[var(--color-text)]'
                      : 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)]'
                  }`}
                >
                  {msg.content}
                  {msg.role === 'assistant' && isStreaming && msg.content.length === 0 && (
                    <div className="flex items-center gap-2 font-mono text-xs text-[var(--color-accent)]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)] animate-ping" />
                      <span className="animate-pulse">
                        {activeToolStatus || 'thinking...'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 border-t border-[var(--color-border)] bg-[var(--color-bg)] p-3"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              disabled={isStreaming}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isStreaming ? 'Thinking...' : 'Ask a question about Junaid\'s work...'}
              className="flex-1 border border-[var(--color-border)] bg-[var(--color-code-bg)] px-3 py-1.5 text-xs font-mono text-[var(--color-text)] placeholder-[var(--color-text-subtle)] focus:outline-none focus:border-[var(--color-accent)]"
            />
            <button
              type="submit"
              disabled={!input.trim() || isStreaming}
              className="border border-[var(--color-border)] px-3 py-1.5 font-mono text-xs text-[var(--color-text)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors disabled:opacity-40 cursor-pointer"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  )
}
