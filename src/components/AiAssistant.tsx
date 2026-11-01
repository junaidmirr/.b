import { useState, useRef, useEffect, type FormEvent } from 'react'

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

    setMessages((prev) => [...prev, userMessage, initialAssistantMessage])
    setIsStreaming(true)

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
      let accumulatedReply = ''

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
              accumulatedReply += parsed.text
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId ? { ...msg, content: accumulatedReply } : msg
                )
              )
            } else if (parsed.error) {
              accumulatedReply += `\n[Error: ${parsed.error}]`
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId ? { ...msg, content: accumulatedReply } : msg
                )
              )
            }
          } catch {}
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to connect to AI Assistant'
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? { ...msg, content: `I'm currently unable to reply: ${errorMsg}` }
            : msg
        )
      )
    } finally {
      setIsStreaming(false)
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    handleSend()
  }

  const clearChat = () => {
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
            className="group flex items-center gap-2.5 rounded-full border border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-2.5 text-xs font-mono text-[var(--color-text)] shadow-sm hover:border-[var(--color-border-hover)] hover:bg-[var(--color-surface)] transition-all cursor-pointer"
          >
            <span className="flex h-2 w-2 items-center justify-center">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </span>
            <span className="font-medium">Ask Junaid AI</span>
          </button>
        )}
      </div>

      {/* Chat Window */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Junaid AI Assistant Chat"
          className="fixed bottom-5 right-5 z-50 flex h-[540px] max-h-[85vh] w-[390px] max-w-[calc(100vw-2.5rem)] flex-col rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] shadow-xl overflow-hidden font-sans"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <div>
                <span className="text-xs font-mono font-semibold text-[var(--color-text)]">
                  Junaid AI Assistant
                </span>
                <span className="ml-2 text-[10px] font-mono text-[var(--color-muted)]">
                  Instant
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={clearChat}
                title="Clear conversation"
                className="px-2 py-1 text-[11px] font-mono text-[var(--color-muted)] hover:text-[var(--color-text)] cursor-pointer"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Close [ESC]"
                className="px-2 py-1 text-xs font-mono text-[var(--color-muted)] hover:text-[var(--color-text)] cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Quick Suggestions (if no conversation yet) */}
          {!hasInteracted && (
            <div className="border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
              <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-muted)] mb-1.5">
                Quick questions:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => handleSend(prompt)}
                    className="rounded border border-[var(--color-border)] bg-[var(--color-panel)] px-2 py-1 text-[11px] font-mono text-[var(--color-muted)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-text)] transition-colors cursor-pointer text-left"
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
                <span className="mb-1 text-[10px] font-mono text-[var(--color-muted)]">
                  {msg.role === 'user' ? 'You' : 'Junaid AI'}
                </span>
                <div
                  className={`rounded-md px-3.5 py-2.5 max-w-[88%] leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-[var(--color-text)] text-[var(--color-bg)] font-medium'
                      : 'border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)]'
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
            className="flex items-center gap-2 border-t border-[var(--color-border)] bg-[var(--color-bg)] p-2.5"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              disabled={isStreaming}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isStreaming ? 'Thinking...' : 'Ask about Junaid, doc-engine, CoolPath...'}
              className="flex-1 border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 text-xs text-[var(--color-text)] placeholder-[var(--color-muted)] focus:border-[var(--color-border-hover)] focus:outline-none font-mono"
            />
            <button
              type="submit"
              disabled={!input.trim() || isStreaming}
              className="btn-primary px-3.5 py-2 text-xs font-mono disabled:opacity-40 cursor-pointer"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  )
}
