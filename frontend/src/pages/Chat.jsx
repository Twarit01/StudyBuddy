import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { askQuestion, getSessions, getSessionMessages, deleteSession } from '../api/chat'
import { listDocuments } from '../api/documents'
import SourceCitation from '../components/SourceCitation'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

const SUGGESTED_QUESTIONS = [
  "Explain Newton's second law with examples",
  "What is the difference between AC and DC circuits?",
  "Summarize the key thermodynamics laws",
  "What is Bernoulli's equation used for?",
]

export default function Chat() {
  const location = useLocation()
  const [sessions, setSessions]               = useState([])
  const [activeSession, setActiveSession]     = useState(null)
  const [messages, setMessages]               = useState([])
  const [documents, setDocuments]             = useState([])
  const [documentId, setDocumentId]           = useState('')
  const [input, setInput]                     = useState('')
  const [loading, setLoading]                 = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sessionError, setSessionError]       = useState(null)
  const [documentsError, setDocumentsError]   = useState(null)
  const messagesEndRef = useRef(null)
  const inputRef       = useRef(null)
  const textareaRef    = useRef(null)

  useEffect(() => {
    loadSessions()
    loadDocuments()
  }, [])

  useEffect(() => {
    if (!location.state?.initialQuestion) return
    setInput(location.state.initialQuestion)
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [location.state])

  useEffect(() => {
    if (location.state?.documentId) {
      setDocumentId(String(location.state.documentId))
    }
  }, [location.state])

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const loadSessions = async () => {
    setSessionError(null)
    try { const data = await getSessions(); setSessions(data) }
    catch (err) { console.error(err); setSessionError('Could not load recent chats') }
  }

  const loadDocuments = async () => {
    setDocumentsError(null)
    try { const data = await listDocuments(); setDocuments(data) }
    catch (err) { console.error(err); setDocumentsError('Could not load documents') }
  }

  const loadMessages = async (sessionId) => {
    setLoadingMessages(true)
    try {
      const data = await getSessionMessages(sessionId)
      setMessages(data); setActiveSession(sessionId)
    } catch (err) { console.error(err) }
    finally { setLoadingMessages(false) }
  }

  const handleNewChat = () => {
    setActiveSession(null); setMessages([])
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const handleSend = async () => {
    const question = input.trim()
    if (!question || loading) return
    setInput('')
    if (textareaRef.current) { textareaRef.current.style.height = 'auto' }
    setLoading(true)
    const tempMsg = { id: Date.now(), role: 'user', content: question, created_at: new Date().toISOString() }
    setMessages(prev => [...prev, tempMsg])
    try {
      const data = await askQuestion(question, activeSession, documentId || null)
      if (!activeSession) { setActiveSession(data.session_id); loadSessions() }
      setMessages(prev => [...prev, { ...data.message, sources: data.sources, confidence: data.confidence }])
    } catch (err) {
      setMessages(prev => [...prev, {
        id: Date.now() + 1, role: 'assistant',
        content: err.response?.data?.detail || 'Something went wrong. Please try again.',
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

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleInput = (e) => {
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px'
  }

  const parseSources = (sources) => {
    if (!sources) return []
    if (Array.isArray(sources)) return sources
    try {
      const parsed = JSON.parse(sources)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  return (
    <div className="flex h-full overflow-hidden bg-[#F8FAFC] dark:bg-[#0B0F1A] transition-colors duration-200">

      {/* Sessions panel */}
      <div className="w-56 flex-shrink-0 flex flex-col overflow-hidden bg-white dark:bg-[#0D1220] border-r border-[#F1F5F9] dark:border-[#1F2937]">

        <div className="p-3 border-b border-[#F1F5F9] dark:border-[#1F2937]">
          <button onClick={handleNewChat}
            className="btn-primary w-full justify-center text-sm py-2">
            <i className="ti ti-plus" style={{ fontSize: 15 }} aria-hidden="true"></i>
            New chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5">
          <p className="text-label px-3 py-2 text-[#CBD5E1] dark:text-slate-600">Recent</p>
          {sessionError && (
            <div className="mx-3 mb-2 px-3 py-2 rounded-lg text-xs bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-300">
              {sessionError}
            </div>
          )}
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center px-3">
              <i className="ti ti-message-circle" style={{ fontSize: 24, color: '#CBD5E1' }} aria-hidden="true"></i>
              <p className="text-caption mt-2 text-[#94A3B8]">No chats yet</p>
            </div>
          ) : sessions.map(s => (
            <div
              key={s.id}
              onClick={() => loadMessages(s.id)}
              className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-xs transition-colors
                ${activeSession === s.id
                  ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#141B2D] hover:text-slate-900 dark:hover:text-slate-200'}`}
            >
              <i className="ti ti-message-circle flex-shrink-0" style={{ fontSize: 13 }} aria-hidden="true"></i>
              <span className="flex-1 truncate font-medium">{s.title}</span>
              <button
                onClick={e => handleDeleteSession(e, s.id)}
                className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all flex-shrink-0"
              >
                <i className="ti ti-x" style={{ fontSize: 11 }} aria-hidden="true"></i>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Chat main */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6">

            <div className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-2xl border bg-white dark:bg-[#141B2D] border-[#E2E8F0] dark:border-[#1F2937] px-3 py-2 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">
                <i className="ti ti-file-text" style={{ fontSize: 14 }} aria-hidden="true"></i>
                Document scope
              </div>
              <select
                value={documentId}
                onChange={e => setDocumentId(e.target.value)}
                className="flex-1 rounded-lg px-2 py-1.5 text-xs outline-none border bg-[#F8FAFC] dark:bg-[#0B0F1A] border-[#E2E8F0] dark:border-[#1F2937] text-[#0F172A] dark:text-[#F1F5F9]"
              >
                <option value="">All documents</option>
                {documents.map(doc => (
                  <option key={doc.id} value={doc.id}>{doc.original_name}</option>
                ))}
              </select>
              {documentsError && <span className="text-xs text-red-500">{documentsError}</span>}
            </div>

            {messages.length === 0 && !loadingMessages && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 bg-[#EEF2FF] dark:bg-indigo-500/15">
                  <i className="ti ti-message-circle" style={{ fontSize: 26, color: '#6366F1' }} aria-hidden="true"></i>
                </div>
                <h2 className="text-lg font-semibold text-[#0F172A] dark:text-[#F1F5F9] mb-1" style={{ letterSpacing: '-0.3px' }}>
                  Ask anything
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
                  Questions are answered using your uploaded documents — responses include source citations.
                </p>

                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                  {SUGGESTED_QUESTIONS.map(q => (
                    <button
                      key={q}
                      onClick={() => { setInput(q); inputRef.current?.focus() }}
                      className="text-left text-xs px-4 py-3 rounded-xl transition-colors font-medium
                        bg-white dark:bg-[#141B2D] border border-[#E2E8F0] dark:border-[#1F2937]
                        text-slate-600 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-500/50
                        hover:text-indigo-600 dark:hover:text-indigo-300 shadow-sm"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {loadingMessages && (
              <div className="flex justify-center py-12">
                <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {messages.map(msg => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>

                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: 'linear-gradient(135deg, #6366F1, #4F46E5)' }}>
                    <i className="ti ti-sparkles text-white" style={{ fontSize: 15 }} aria-hidden="true"></i>
                  </div>
                )}

                <div className={`flex flex-col max-w-[88%] sm:max-w-[78%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`px-4 py-3 rounded-2xl text-sm leading-relaxed
                      ${msg.role === 'user'
                        ? 'text-white rounded-tr-sm'
                        : 'rounded-tl-sm bg-white dark:bg-[#141B2D] border border-[#F1F5F9] dark:border-[#1F2937] text-slate-700 dark:text-slate-200 shadow-sm'}`}
                    style={msg.role === 'user' ? { background: 'linear-gradient(135deg, #6366F1, #4F46E5)' } : undefined}
                  >
                    {msg.role === 'assistant' ? (
                      <div className="markdown">
                        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    ) : msg.content}
                  </div>

                  {msg.role === 'assistant' && parseSources(msg.sources).length > 0 && (
                    <div className="mt-2 w-full">
                      <SourceCitation
                        sources={parseSources(msg.sources)}
                        confidence={msg.confidence}
                      />
                    </div>
                  )}

                  <p className="text-[10px] mt-1.5 px-1 text-[#CBD5E1] dark:text-slate-600">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>

                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-[#EEF2FF] dark:bg-indigo-500/15">
                    U
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #6366F1, #4F46E5)' }}>
                  <i className="ti ti-sparkles text-white" style={{ fontSize: 15 }} aria-hidden="true"></i>
                </div>
                <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-white dark:bg-[#141B2D] border border-[#F1F5F9] dark:border-[#1F2937] shadow-sm">
                  <div className="flex gap-1.5 items-center h-4">
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input bar */}
        <div className="px-4 sm:px-6 py-4 bg-white dark:bg-[#0D1220] border-t border-[#F1F5F9] dark:border-[#1F2937]">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-end gap-3 p-3 rounded-2xl transition-all bg-[#F8FAFC] dark:bg-[#0B0F1A] border border-[#E2E8F0] dark:border-[#1F2937]">
              <textarea
                ref={el => { inputRef.current = el; textareaRef.current = el }}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onInput={handleInput}
                placeholder="Ask a question about your study material..."
                rows={1}
                className="flex-1 bg-transparent text-sm text-[#0F172A] dark:text-[#F1F5F9] placeholder-slate-400 dark:placeholder-slate-500 outline-none resize-none"
                style={{ maxHeight: '140px', lineHeight: '1.6' }}
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-40"
                style={{ background: input.trim() ? 'linear-gradient(135deg, #6366F1, #4F46E5)' : (isDarkBtn => '')(false) || 'var(--send-btn-bg)' }}
              >
                <style>{`:root{--send-btn-bg:#E2E8F0}.dark{--send-btn-bg:#1F2937}`}</style>
                <i className="ti ti-arrow-up" style={{ fontSize: 16, color: input.trim() ? '#ffffff' : '#94A3B8' }} aria-hidden="true"></i>
              </button>
            </div>
            <p className="text-[10px] text-center mt-2 text-[#CBD5E1] dark:text-slate-600">
              Enter to send · Shift+Enter for new line · Answers grounded in your documents
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
