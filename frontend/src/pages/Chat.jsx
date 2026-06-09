import { useState, useEffect, useRef } from 'react'
import { askQuestion, getSessions, getSessionMessages, deleteSession } from '../api/chat'
import SourceCitation from '../components/SourceCitation'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

export default function Chat() {
  const [sessions, setSessions] = useState([])
  const [activeSession, setActiveSession] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  // Load sessions on mount
  useEffect(() => {
    loadSessions()
  }, [])

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadSessions = async () => {
    try {
      const data = await getSessions()
      setSessions(data)
    } catch (err) {
      console.error('Failed to load sessions', err)
    }
  }

  const loadMessages = async (sessionId) => {
    setLoadingMessages(true)
    try {
      const data = await getSessionMessages(sessionId)
      setMessages(data)
      setActiveSession(sessionId)
    } catch (err) {
      console.error('Failed to load messages', err)
    } finally {
      setLoadingMessages(false)
    }
  }

  const handleNewChat = () => {
    setActiveSession(null)
    setMessages([])
    inputRef.current?.focus()
  }

  const handleSend = async () => {
    const question = input.trim()
    if (!question || loading) return

    setInput('')
    setLoading(true)

    // Optimistically add user message
    const tempUserMsg = {
      id: Date.now(),
      role: 'user',
      content: question,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, tempUserMsg])

    try {
      const data = await askQuestion(question, activeSession)

      // Update session ID if new
      if (!activeSession) {
        setActiveSession(data.session_id)
        loadSessions()
      }

      // Add AI response
      setMessages((prev) => [...prev, {
        ...data.message,
        sources: data.sources,
        confidence: data.confidence,
      }])
    } catch (err) {
      setMessages((prev) => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
        created_at: new Date().toISOString(),
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSession = async (e, sessionId) => {
    e.stopPropagation()
    try {
      await deleteSession(sessionId)
      setSessions((prev) => prev.filter((s) => s.id !== sessionId))
      if (activeSession === sessionId) {
        setActiveSession(null)
        setMessages([])
      }
    } catch (err) {
      console.error('Failed to delete session', err)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex h-full overflow-hidden">

      {/* Sessions sidebar */}
      <div className="w-48 flex-shrink-0 bg-[#18181f] border-r border-[#222230] flex flex-col">
        <div className="p-3 border-b border-[#222230]">
          <button
            onClick={handleNewChat}
            className="w-full bg-[#7c6af7] hover:bg-[#6b5ce7] text-white text-xs font-medium rounded-lg py-2 transition-colors"
          >
            + New chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
          {sessions.length === 0 ? (
            <p className="text-xs text-gray-600 text-center py-4">No chats yet</p>
          ) : (
            sessions.map((s) => (
              <div
                key={s.id}
                onClick={() => loadMessages(s.id)}
                className={`
                  group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer
                  text-xs transition-colors
                  ${activeSession === s.id
                    ? 'bg-[#7c6af7]/15 text-[#7c6af7]'
                    : 'text-gray-400 hover:bg-[#222230] hover:text-gray-200'
                  }
                `}
              >
                <span className="flex-1 truncate">{s.title}</span>
                <button
                  onClick={(e) => handleDeleteSession(e, s.id)}
                  className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">

          {/* Empty state */}
          {messages.length === 0 && !loadingMessages && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-4xl mb-3">🧠</div>
              <h2 className="text-base font-semibold mb-1">Ask anything</h2>
              <p className="text-sm text-gray-500 max-w-xs">
                Upload study materials in the sidebar and ask questions grounded in your notes.
              </p>
              <div className="mt-4 flex flex-col gap-2 w-full max-w-sm">
                {[
                  'Explain Newton\'s second law with examples',
                  'What is the difference between AC and DC circuits?',
                  'Summarize the key thermodynamics laws',
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => setInput(q)}
                    className="text-xs text-left bg-[#18181f] border border-[#222230] hover:border-[#7c6af7] rounded-xl px-4 py-2.5 text-gray-400 hover:text-gray-200 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {loadingMessages && (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-[#7c6af7] border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Message bubbles */}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#7c6af7] to-[#5de0b0] flex items-center justify-center text-sm flex-shrink-0 mt-0.5">
                  🧠
                </div>
              )}

              <div className={`max-w-[75%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                <div
                  className={`
                    px-4 py-3 rounded-2xl text-sm leading-relaxed
                    ${msg.role === 'user'
                      ? 'bg-[#7c6af7] text-white rounded-tr-sm'
                      : 'bg-[#18181f] border border-[#222230] text-gray-200 rounded-tl-sm'
                    }
                  `}
                >
                  {msg.role === 'assistant' ? (
                    <div className="markdown">
                      <ReactMarkdown
                        remarkPlugins={[remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>

                {/* Sources */}
                {msg.role === 'assistant' && msg.sources && (
                  <div className="mt-1 w-full">
                    <SourceCitation
                      sources={typeof msg.sources === 'string' ? JSON.parse(msg.sources) : msg.sources}
                      confidence={msg.confidence}
                    />
                  </div>
                )}
              </div>

              {msg.role === 'user' && (
                <div className="w-7 h-7 rounded-full bg-[#222230] flex items-center justify-center text-xs flex-shrink-0 mt-0.5 font-medium text-gray-300">
                  U
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#7c6af7] to-[#5de0b0] flex items-center justify-center text-sm flex-shrink-0">
                🧠
              </div>
              <div className="bg-[#18181f] border border-[#222230] rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1.5 items-center">
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="p-4 border-t border-[#222230] bg-[#18181f]">
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your study material..."
              rows={1}
              className="flex-1 bg-[#222230] border border-[#333344] focus:border-[#7c6af7] rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none resize-none transition-colors"
              style={{ maxHeight: '120px', overflowY: 'auto' }}
              onInput={(e) => {
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
              }}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="bg-[#7c6af7] hover:bg-[#6b5ce7] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl px-4 py-2.5 text-sm font-medium transition-colors flex-shrink-0"
            >
              Send
            </button>
          </div>
          <p className="text-xs text-gray-600 mt-2">
            Enter to send · Shift+Enter for new line
          </p>
        </div>

      </div>
    </div>
  )
}