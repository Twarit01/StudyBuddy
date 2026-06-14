import { useState, useEffect, useRef } from 'react'
import { askQuestion, getSessions, getSessionMessages, deleteSession } from '../api/chat'
import SourceCitation from '../components/SourceCitation'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

export default function Chat() {
  const [sessions, setSessions]             = useState([])
  const [activeSession, setActiveSession]   = useState(null)
  const [messages, setMessages]             = useState([])
  const [input, setInput]                   = useState('')
  const [loading, setLoading]               = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef       = useRef(null)

  useEffect(() => { loadSessions() }, [])
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const loadSessions = async () => {
    try { const data = await getSessions(); setSessions(data) }
    catch (err) { console.error(err) }
  }

  const loadMessages = async (sessionId) => {
    setLoadingMessages(true)
    try {
      const data = await getSessionMessages(sessionId)
      setMessages(data)
      setActiveSession(sessionId)
    } catch (err) { console.error(err) }
    finally { setLoadingMessages(false) }
  }

  const handleNewChat = () => { setActiveSession(null); setMessages([]); inputRef.current?.focus() }

  const handleSend = async () => {
    const question = input.trim()
    if (!question || loading) return
    setInput('')
    setLoading(true)
    const tempUserMsg = { id: Date.now(), role: 'user', content: question, created_at: new Date().toISOString() }
    setMessages(prev => [...prev, tempUserMsg])
    try {
      const data = await askQuestion(question, activeSession)
      if (!activeSession) { setActiveSession(data.session_id); loadSessions() }
      setMessages(prev => [...prev, { ...data.message, sources: data.sources, confidence: data.confidence }])
    } catch (err) {
      setMessages(prev => [...prev, {
        id: Date.now() + 1, role: 'assistant',
        content: err.response?.data?.detail || 'Sorry, something went wrong.',
        created_at: new Date().toISOString(),
      }])
    } finally { setLoading(false) }
  }

  const handleDeleteSession = async (e, sessionId) => {
    e.stopPropagation()
    try {
      await deleteSession(sessionId)
      setSessions(prev => prev.filter(s => s.id !== sessionId))
      if (activeSession === sessionId) { setActiveSession(null); setMessages([]) }
    } catch (err) { console.error(err) }
  }

  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }

  return (
    <div className="flex h-full overflow-hidden bg-surface-muted dark:bg-[#0F172A] transition-colors duration-200">

      {/* Sessions sidebar */}
      <div className="w-56 flex-shrink-0 bg-white dark:bg-[#1E293B] border-r border-surface-border dark:border-[#334155] flex flex-col">
        <div className="p-3 border-b border-surface-border dark:border-[#334155]">
          <button onClick={handleNewChat} className="w-full bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium rounded-xl py-2.5 transition-colors flex items-center justify-center gap-1.5">
            <i className="ti ti-plus" style={{ fontSize: 14 }} aria-hidden="true"></i>
            New chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
          {sessions.length === 0 ? (
            <p className="text-xs text-ink-400 text-center py-4">No chats yet</p>
          ) : sessions.map(s => (
            <div
              key={s.id}
              onClick={() => loadMessages(s.id)}
              className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer text-xs transition-colors
                ${activeSession === s.id
                  ? 'bg-primary-50 dark:bg-primary-600/15 text-primary-700 dark:text-primary-300'
                  : 'text-ink-500 dark:text-gray-400 hover:bg-surface-muted dark:hover:bg-[#1E293B]'
                }`}
            >
              <i className="ti ti-message-circle" style={{ fontSize: 14 }} aria-hidden="true"></i>
              <span className="flex-1 truncate">{s.title}</span>
              <button onClick={e => handleDeleteSession(e, s.id)} className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all">
                <i className="ti ti-x" style={{ fontSize: 12 }} aria-hidden="true"></i>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 max-w-3xl mx-auto w-full">

          {messages.length === 0 && !loadingMessages && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-14 h-14 rounded-2xl bg-primary-50 dark:bg-primary-600/15 text-primary-600 dark:text-primary-300 flex items-center justify-center mb-3">
                <i className="ti ti-message-circle" style={{ fontSize: 26 }} aria-hidden="true"></i>
              </div>
              <h2 className="text-base font-semibold text-ink-900 dark:text-white mb-1">Ask anything</h2>
              <p className="text-sm text-ink-500 max-w-xs">Upload study materials and ask questions grounded in your notes.</p>
              <div className="mt-4 flex flex-col gap-2 w-full max-w-sm">
                {[
                  "Explain Newton's second law with examples",
                  "What is the difference between AC and DC circuits?",
                  "Summarize the key thermodynamics laws",
                ].map(q => (
                  <button
                    key={q}
                    onClick={() => setInput(q)}
                    className="text-xs text-left bg-white dark:bg-[#1E293B] border border-surface-border dark:border-[#334155] hover:border-primary-300 rounded-xl px-4 py-2.5 text-ink-500 hover:text-ink-900 dark:hover:text-gray-200 transition-colors shadow-soft"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {loadingMessages && (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-xl bg-primary-600 flex items-center justify-center text-white flex-shrink-0 mt-0.5">
                  <i className="ti ti-sparkles" style={{ fontSize: 16 }} aria-hidden="true"></i>
                </div>
              )}
              <div className={`max-w-[75%] flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed
                  ${msg.role === 'user'
                    ? 'bg-primary-600 text-white rounded-tr-sm'
                    : 'bg-white dark:bg-[#1E293B] border border-surface-border dark:border-[#334155] text-ink-700 dark:text-gray-200 rounded-tl-sm shadow-soft'
                  }`}>
                  {msg.role === 'assistant' ? (
                    <div className="markdown">
                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  ) : msg.content}
                </div>
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
                <div className="w-8 h-8 rounded-xl bg-surface-muted dark:bg-[#334155] flex items-center justify-center text-xs flex-shrink-0 mt-0.5 font-medium text-ink-700 dark:text-gray-300">U</div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-xl bg-primary-600 flex items-center justify-center text-white flex-shrink-0">
                <i className="ti ti-sparkles" style={{ fontSize: 16 }} aria-hidden="true"></i>
              </div>
              <div className="bg-white dark:bg-[#1E293B] border border-surface-border dark:border-[#334155] rounded-2xl rounded-tl-sm px-4 py-3 shadow-soft">
                <div className="flex gap-1.5 items-center">
                  <div className="typing-dot" /><div className="typing-dot" /><div className="typing-dot" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-surface-border dark:border-[#334155] bg-white dark:bg-[#1E293B] transition-colors">
          <div className="max-w-3xl mx-auto flex gap-2 items-end">
            <textarea
              ref={inputRef} value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your study material..."
              rows={1}
              className="flex-1 bg-surface-muted dark:bg-[#1E293B] border border-surface-border dark:border-[#334155] focus:border-primary-400 rounded-xl px-4 py-2.5 text-sm text-ink-900 dark:text-white placeholder-ink-400 outline-none resize-none transition-colors"
              style={{ maxHeight: '120px', overflowY: 'auto' }}
              onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px' }}
            />
            <button
              onClick={handleSend} disabled={loading || !input.trim()}
              className="bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white rounded-xl w-10 h-10 flex items-center justify-center flex-shrink-0 transition-colors"
            >
              <i className="ti ti-arrow-up" style={{ fontSize: 16 }} aria-hidden="true"></i>
            </button>
          </div>
          <p className="text-xs text-ink-400 mt-2 text-center">Enter to send · Shift+Enter for new line</p>
        </div>
      </div>
    </div>
  )
}