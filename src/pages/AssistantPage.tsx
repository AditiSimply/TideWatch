import React, { useState, useRef, useEffect } from 'react'
import { api } from '@/lib/api'
import type { ChatMessage } from '@/types'
import { MarkdownView } from '@/components/common/MarkdownView'
import {
  Bot,
  User,
  Send,
  Sparkles,
  RotateCcw,
} from 'lucide-react'

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-1',
    sender: 'assistant',
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    content: `### Welcome to Tidewatch Copilot

I can analyze tree-split decisions, explain SHAP feature attributions on live or uploaded network flows, and generate copy-pasteable firewall rules.

**Frequently queried investigations:**
- *"Why was flow #89421 flagged as DDoS-LOIC?"*
- *"Summarize network anomalies from the last hour"*
- *"Generate iptables rule for 205.174.165.73"*
- *"What distinguishes Slowloris from GoldenEye DoS attacks?"*`,
  },
]

const STORAGE_SESSION_KEY = 'tidewatch_chat_session_id'

export const AssistantPage: React.FC = () => {
  const [sessionId, setSessionId] = useState<string>(() => {
    let id = localStorage.getItem(STORAGE_SESSION_KEY)
    if (!id) {
      id = `tw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      localStorage.setItem(STORAGE_SESSION_KEY, id)
    }
    return id
  })

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem(`tw_msgs_${sessionId}`)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      } catch {
        // fallback
      }
    }
    return INITIAL_MESSAGES
  })

  const [input, setInput] = useState<string>('')
  const [isStreaming, setIsStreaming] = useState<boolean>(false)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
    // Save messages for this session
    if (messages.length > 0) {
      localStorage.setItem(`tw_msgs_${sessionId}`, JSON.stringify(messages))
    }
  }, [messages, sessionId])

  const handleResetSession = () => {
    const newId = `tw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    localStorage.setItem(STORAGE_SESSION_KEY, newId)
    setSessionId(newId)
    setMessages(INITIAL_MESSAGES)
  }

  const handleSendMessage = async (textToSend?: string) => {
    const prompt = (textToSend || input).trim()
    if (!prompt || isStreaming) return

    setInput('')

    // Append user message
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      timestamp: new Date().toISOString(),
      content: prompt,
    }

    const assistantMsgId = `assistant-${Date.now()}`
    const placeholderMsg: ChatMessage = {
      id: assistantMsgId,
      sender: 'assistant',
      timestamp: new Date().toISOString(),
      content: '',
      isStreaming: true,
    }

    setMessages((prev) => [...prev, userMsg, placeholderMsg])
    setIsStreaming(true)

    try {
      await api.askAssistant(
        prompt,
        (chunk) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId ? { ...msg, content: chunk } : msg
            )
          )
        },
        sessionId
      )
    } catch (err) {
      console.error('Failed to get assistant response:', err)
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                content:
                  'An error occurred communicating with the inference engine. Please retry.',
              }
            : msg
        )
      )
    } finally {
      setIsStreaming(false)
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId ? { ...msg, isStreaming: false } : msg
        )
      )
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const samplePrompts = [
    'Why was flow #89421 flagged as DDoS-LOIC?',
    'Summarize network anomalies from the last hour',
    'Generate iptables rules for top adversaries',
    'Explain the difference between Slowloris and GoldenEye',
  ]

  return (
    <div className="space-y-6">
      {/* Editorial Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-[#E2EBE5] pb-5">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#0F3D2E] tracking-tight">
            SecOps Reasoning Assistant
          </h1>
          <p className="text-sm text-[#526D61] mt-1">
            Natural language interface for ML decision paths, SHAP feature attributions, and rule generation.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Session ID pill */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#FAFBF8] border border-[#E2EBE5] text-[11px] font-mono text-[#526D61]"
            title={`Persistent Session ID: ${sessionId}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
            <span>ID: {sessionId.slice(0, 14)}...</span>
          </div>

          <button
            onClick={handleResetSession}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#526D61] hover:text-[#0F3D2E] hover:bg-[#EBF3EF] transition-colors border border-[#E2EBE5]"
            title="Start a new session and clear conversation memory"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>New Session</span>
          </button>
        </div>
      </div>

      {/* Suggested Prompts Pills */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-[#637D72] font-semibold flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-[#10B981]" />
          Suggested:
        </span>
        {samplePrompts.map((p, idx) => (
          <button
            key={idx}
            disabled={isStreaming}
            onClick={() => handleSendMessage(p)}
            className="text-xs px-3 py-1 rounded-full bg-white border border-[#E2EBE5] text-[#0F3D2E] hover:border-[#10B981] hover:bg-[#FAFBF8] transition-colors disabled:opacity-50"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Chat Messages Container */}
      <div className="editorial-card h-[540px] flex flex-col justify-between overflow-hidden">
        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {messages.map((msg) => {
            const isUser = msg.sender === 'user'
            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-3xl ${
                  isUser ? 'ml-auto flex-row-reverse' : ''
                }`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                    isUser
                      ? 'bg-[#0F3D2E] text-white border-[#0F3D2E]'
                      : 'bg-[#EBF4F0] text-[#0F3D2E] border-[#D5E3DC]'
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4 text-[#10B981]" />}
                </div>

                {/* Content bubble */}
                <div
                  className={`rounded-xl p-4 text-xs leading-relaxed ${
                    isUser
                      ? 'bg-[#0F3D2E] text-white shadow-2xs max-w-lg'
                      : 'bg-[#FAFBF8] border border-[#E2EBE5] text-[#385145] w-full'
                  }`}
                >
                  {isUser ? (
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  ) : msg.content ? (
                    <MarkdownView content={msg.content} />
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-[#526D61]">
                      <span className="w-2 h-2 rounded-full bg-[#10B981] animate-ping" />
                      <span>Evaluating tree-split heuristics...</span>
                    </div>
                  )}

                  <div className="mt-2 text-[10px] opacity-60 text-right">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>
            )
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 sm:p-4 bg-[#FAFBF8] border-t border-[#E2EBE5]">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSendMessage()
            }}
            className="flex items-end gap-2"
          >
            <textarea
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Tidewatch: 'Why was flow #89421 flagged?' or 'Summarize recent alerts'..."
              disabled={isStreaming}
              className="flex-1 resize-none rounded-xl border border-[#D5E3DC] bg-white p-3 text-xs text-[#0F3D2E] placeholder-[#637D72] focus:outline-none focus:ring-1 focus:ring-[#10B981] disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || isStreaming}
              className="px-4 py-3 rounded-xl bg-[#0F3D2E] text-white hover:bg-[#16533F] disabled:opacity-40 transition-colors shadow-2xs shrink-0 flex items-center justify-center"
              aria-label="Send query"
            >
              <Send className="w-4 h-4 text-[#10B981]" />
            </button>
          </form>
          <div className="flex items-center justify-between text-[11px] text-[#637D72] mt-2 px-1">
            <span>Press Enter to send, Shift+Enter for newline</span>
            <span className="font-mono">Tidewatch v2.4 Knowledge Engine</span>
          </div>
        </div>
      </div>
    </div>
  )
}
