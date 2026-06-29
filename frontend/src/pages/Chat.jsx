import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import { askQuestion, getSessions, getSessionMessages, deleteSession } from '../api/chat'
import { listDocuments } from '../api/documents'
import SourceCitation from '../components/SourceCitation'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

const TOPIC_CHIPS = ['Physics', 'Mathematics', 'Chemistry', 'History', 'Engineering']

const SUGGESTED_QUESTIONS = [
  "Explain Newton's second law with examples",
  "What is the difference between AC and DC circuits?",
  "Summarize the key thermodynamics laws",
  "What is Bernoulli's equation used for?",
]

const parseSources = (sources) => {
  if (!sources) return []
  if (Array.isArray(sources)) return sources
  try { const p = JSON.parse(sources); return Array.isArray(p) ? p : [] } catch { return [] }
}

export default function Chat() {
  const { isDark } = useTheme()
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
  const [activeTopics, setActiveTopics]       = useState([])

  const messagesEndRef = useRef(null)
  const inputRef       = useRef(null)
  const textareaRef    = useRef(null)

  useEffect(() => { loadSessions(); loadDocuments() }, [])

  useEffect(() => {
    if (!location.state?.initialQuestion) return
    setInput(location.state.initialQuestion)
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [location.state])

  useEffect(() => {
    if (location.state?.documentId) setDocumentId(String(location.state.documentId))
  }, [location.state])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior:'smooth' })
  }, [messages, loading])

  const loadSessions = async () => {
    setSessionError(null)
    try { setSessions(await getSessions()) }
    catch (err) { console.error(err); setSessionError('Could not load recent chats') }
  }

  const loadDocuments = async () => {
    setDocumentsError(null)
    try { setDocuments(await listDocuments()) }
    catch (err) { console.error(err); setDocumentsError('Could not load documents') }
  }

  const loadMessages = async (sessionId) => {
    setLoadingMessages(true)
    try { setMessages(await getSessionMessages(sessionId)); setActiveSession(sessionId) }
    catch (err) { console.error(err) }
    finally { setLoadingMessages(false) }
  }

  const handleNewChat = () => {
    setActiveSession(null); setMessages([])
    setActiveTopics([])
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const handleSend = async () => {
    const question = input.trim()
    if (!question || loading) return
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setLoading(true)
    setMessages(prev => [...prev, {
      id: Date.now(), role:'user', content:question, created_at:new Date().toISOString()
    }])
    try {
      const data = await askQuestion(question, activeSession, documentId || null)
      if (!activeSession) { setActiveSession(data.session_id); loadSessions() }
      setMessages(prev => [...prev, { ...data.message, sources:data.sources, confidence:data.confidence }])
    } catch (err) {
      setMessages(prev => [...prev, {
        id: Date.now()+1, role:'assistant',
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

  const handleTextareaInput = (e) => {
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px'
  }

  const toggleTopic = (t) => {
    setActiveTopics(prev => prev.includes(t) ? prev.filter(x=>x!==t) : [...prev, t])
    if (!input.includes(`[${t}]`)) setInput(prev => prev ? `${prev} [${t}]` : `[${t}] `)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  return (
    <div style={{
      display: 'flex',
      height: '100%',
      overflow: 'hidden',
      background: isDark ? '#0C0C14' : '#F8FAFC',
      color: isDark ? '#fff' : '#0F172A',
      fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      '--db-bg': isDark ? '#0C0C14' : '#F8FAFC',
      '--db-text': isDark ? '#fff' : '#0F172A',
      '--db-card-bg': isDark ? '#161625' : '#ffffff',
      '--db-card-border': isDark ? 'rgba(255,255,255,0.07)' : '#E2E8F0',
      '--db-border': isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0',
      '--db-border-light': isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0',
      '--db-text-muted': isDark ? 'rgba(255,255,255,0.38)' : '#64748B',
      '--db-text-sub': isDark ? 'rgba(255,255,255,0.42)' : '#475569',
      '--db-text-light': isDark ? 'rgba(255,255,255,0.75)' : '#334155',
      '--db-hover-bg': isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9',
      '--db-inner-bg': isDark ? '#1E1E30' : '#F1F5F9',
      '--db-sidebar-bg': isDark ? '#0E0E1A' : '#ffffff',
      '--db-msg-assistant-bg': isDark ? '#1A1A2D' : '#F1F5F9',
      '--db-msg-assistant-text': isDark ? 'rgba(255,255,255,0.85)' : '#1E293B',
      '--db-markdown-color': isDark ? '#fff' : '#0F172A',
    }}>
      <style>{`
        .cs-item { display:flex; align-items:center; gap:8px; padding:7px 10px; border-radius:9px;
                   cursor:pointer; font-size:12px; color: var(--db-text-muted); transition:all 0.15s; }
        .cs-item:hover { background: var(--db-hover-bg); color: var(--db-text-light); }
        .cs-item.active { background:rgba(124,58,237,0.2); color:#C4B5FD; }
        .chat-input-wrap { background: var(--db-card-bg); border:1px solid var(--db-border); border-radius:16px;
                           display:flex; align-items:flex-end; gap:10px; padding:11px 14px; transition:border-color 0.2s; }
        .chat-input-wrap:focus-within { border-color:rgba(124,58,237,0.5); }
        .chat-textarea { flex:1; background:transparent; border:none; outline:none; color: var(--db-text);
                         font-size:14px; resize:none; line-height:1.6; max-height:140px; font-family:inherit; }
        .chat-textarea::placeholder { color: var(--db-text-muted); }
        .send-btn { width:38px; height:38px; border-radius:11px; border:none; cursor:pointer;
                    display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:all 0.2s; }
        .send-btn:disabled { opacity:0.4; cursor:not-allowed; }
        .topic-chip { padding:4px 13px; border-radius:20px; font-size:11px; font-weight:600;
                      border:1px solid; cursor:pointer; transition:all 0.15s; white-space:nowrap; background:none; }
        .msg-assistant { background: var(--db-msg-assistant-bg); border:1px solid var(--db-card-border); border-radius:18px;
                         border-top-left-radius:4px; padding:14px 16px; font-size:14px; line-height:1.7;
                         color: var(--db-msg-assistant-text); }
        .msg-user { background:linear-gradient(135deg,#7C3AED,#6D28D9); border-radius:18px;
                    border-top-right-radius:4px; padding:12px 16px; font-size:14px; line-height:1.6;
                    color:#fff; max-width:80%; }
        .typing-dot { width:6px; height:6px; border-radius:50%; background: var(--db-text-muted);
                      animation:typingBounce 1.2s infinite; }
        .typing-dot:nth-child(2) { animation-delay:0.15s; }
        .typing-dot:nth-child(3) { animation-delay:0.3s; }
        @keyframes typingBounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }
        .markdown p { margin:0 0 8px; } .markdown p:last-child { margin:0; }
        .markdown h1,.markdown h2,.markdown h3 { margin:12px 0 6px; font-size:15px; color: var(--db-markdown-color); }
        .markdown strong { color: var(--db-markdown-color); }
        .markdown code { background:rgba(124,58,237,0.2); padding:2px 6px; border-radius:4px; font-size:13px; }
        .markdown pre { background: var(--db-hover-bg); border:1px solid var(--db-card-border);
                        border-radius:10px; padding:12px; overflow-x:auto; margin:8px 0; }
        .markdown ul,.markdown ol { padding-left:20px; margin:6px 0; }
        .markdown li { margin-bottom:3px; }
        .scroll-thin::-webkit-scrollbar { width:4px; }
        .scroll-thin::-webkit-scrollbar-thumb { background: var(--db-border-light); border-radius:4px; }
        .suggested-q { padding:10px 13px; background: var(--db-hover-bg);
                       border:1px solid var(--db-card-border); border-radius:11px;
                       color: var(--db-text-sub); font-size:12px; cursor:pointer;
                       text-align:left; transition:all 0.15s; font-family:inherit; }
        .suggested-q:hover { background:rgba(124,58,237,0.15); border-color:rgba(124,58,237,0.4); color:#C4B5FD; }
        @keyframes spin { to { transform:rotate(360deg) } }
      `}</style>

      {/* Sessions sidebar */}
      <div style={{ width:220, flexShrink:0, display:'flex', flexDirection:'column',
        background:'var(--db-sidebar-bg)', borderRight:'1px solid var(--db-border-light)', overflow:'hidden' }}>

        <div style={{ padding:'18px 14px 14px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
            <div style={{ width:36, height:36, borderRadius:10,
              background:'linear-gradient(135deg,#7C3AED,#4F46E5)',
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>🤖</div>
            <div>
              <div style={{ fontSize:12, fontWeight:700 }}>AI Study Companion</div>
              <div style={{ fontSize:10, color:'#10B981', display:'flex', alignItems:'center', gap:4 }}>
                <div style={{ width:5, height:5, borderRadius:'50%', background:'#10B981' }}/>
                Online · Personalised
              </div>
            </div>
          </div>
          <button onClick={handleNewChat}
            style={{ width:'100%', padding:'8px 0', background:'linear-gradient(135deg,#7C3AED,#6D28D9)',
              border:'none', borderRadius:9, color:'var(--db-text)', fontSize:12, fontWeight:700, cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
            + New chat
          </button>
        </div>

        {/* Document scope */}
        <div style={{ padding:'0 10px 10px' }}>
          <div style={{ fontSize:10, fontWeight:700, color: 'var(--db-text-muted)', marginBottom:5,
            display:'flex', alignItems:'center', gap:5 }}>📄 Document scope</div>
          <select value={documentId} onChange={e=>setDocumentId(e.target.value)}
            style={{ width:'100%', background: 'var(--db-hover-bg)',
              border:'1px solid var(--db-border-light)', borderRadius:8,
              padding:'6px 9px', color: 'var(--db-text-sub)', fontSize:11, outline:'none', cursor:'pointer' }}>
            <option value="" style={{ color: isDark ? "#fff" : "#0F172A", background: isDark ? "#161625" : "#fff" }}>All documents</option>
            {documents.map(d => <option key={d.id} value={d.id} style={{ color: isDark ? "#fff" : "#0F172A", background: isDark ? "#161625" : "#fff" }}>{d.original_name}</option>)}
          </select>
          {documentsError && <div style={{ marginTop:5, fontSize:10, color:'#FCA5A5' }}>{documentsError}</div>}
        </div>

        {/* Session list */}
        <div className="scroll-thin" style={{ flex:1, overflowY:'auto', padding:'0 6px 10px' }}>
          <div style={{ fontSize:9, fontWeight:700, color: 'var(--db-text-muted)',
            letterSpacing:1, padding:'0 6px 7px', textTransform:'uppercase' }}>Recent</div>
          {sessionError && (
            <div style={{ margin:'0 6px 8px', padding:'7px 10px', borderRadius:8, fontSize:10,
              background:'rgba(239,68,68,0.1)', color:'#FCA5A5' }}>{sessionError}</div>
          )}
          {sessions.length === 0 ? (
            <div style={{ textAlign:'center', padding:'20px 14px', color: 'var(--db-text-muted)', fontSize:11 }}>
              <div style={{ fontSize:22, marginBottom:5 }}>💬</div>No chats yet
            </div>
          ) : sessions.map(s => (
            <div key={s.id} onClick={()=>loadMessages(s.id)}
              className={`cs-item${activeSession===s.id?' active':''}`}
              style={{ justifyContent:'space-between' }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, flex:1, minWidth:0 }}>
                <span style={{ fontSize:11 }}>💬</span>
                <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.title}</span>
              </div>
              <button onClick={e=>handleDeleteSession(e,s.id)}
                style={{ background:'none', border:'none', color: 'var(--db-text-muted)',
                  cursor:'pointer', padding:'2px 4px', fontSize:11, opacity:0,
                  transition:'opacity 0.15s', flexShrink:0 }}
                onMouseEnter={e=>e.currentTarget.style.opacity=1}
                onMouseLeave={e=>e.currentTarget.style.opacity=0}>✕</button>
            </div>
          ))}
        </div>
      </div>

      {/* Main chat */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Top bar */}
        <div style={{ padding:'14px 22px', borderBottom:'1px solid var(--db-border-light)',
          display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div>
            <h1 style={{ margin:0, fontSize:16, fontWeight:700 }}>AI Chat</h1>
            <p style={{ margin:0, fontSize:10, color: 'var(--db-text-muted)' }}>
              Personalised to your weak areas · answers grounded in your documents
            </p>
          </div>
          <div style={{ display:'flex', gap:5, flexWrap:'wrap', justifyContent:'flex-end' }}>
            {TOPIC_CHIPS.map(t => (
              <button key={t} onClick={()=>toggleTopic(t)} className="topic-chip"
                style={{
                  background: activeTopics.includes(t) ? 'rgba(124,58,237,0.25)' :  'var(--db-hover-bg)',
                  borderColor: activeTopics.includes(t) ? '#7C3AED' :  'var(--db-border)',
                  color: activeTopics.includes(t) ? '#C4B5FD' :  'var(--db-text-muted)',
                }}>{t}</button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="scroll-thin" style={{ flex:1, overflowY:'auto', padding:'20px' }}>
          <div style={{ maxWidth:760, margin:'0 auto', display:'flex', flexDirection:'column', gap:18 }}>

            {loadingMessages && (
              <div style={{ display:'flex', justifyContent:'center', padding:40 }}>
                <div style={{ width:22, height:22, border:'3px solid #7C3AED',
                  borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
              </div>
            )}

            {messages.length === 0 && !loadingMessages && (
              <>
                <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                  <div style={{ width:36, height:36, borderRadius:10,
                    background:'linear-gradient(135deg,#7C3AED,#4F46E5)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:16, flexShrink:0 }}>🤖</div>
                  <div className="msg-assistant" style={{ maxWidth:'80%' }}>
                    Hey! 👋 Ready to crush today's session? I'm your AI study companion — ask me anything about your uploaded documents, topics, or concepts. Answers include source citations so you know exactly where information comes from.
                  </div>
                </div>
                <div style={{ paddingLeft:46 }}>
                  <div style={{ fontSize:11, color: 'var(--db-text-muted)', marginBottom:9 }}>Try asking:</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7 }}>
                    {SUGGESTED_QUESTIONS.map(q => (
                      <button key={q} className="suggested-q"
                        onClick={()=>{ setInput(q); inputRef.current?.focus() }}>{q}</button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {messages.map(msg => (
              <div key={msg.id} style={{ display:'flex', gap:10,
                justifyContent: msg.role==='user' ? 'flex-end' : 'flex-start',
                alignItems:'flex-start' }}>

                {msg.role==='assistant' && (
                  <div style={{ width:36, height:36, borderRadius:10,
                    background:'linear-gradient(135deg,#7C3AED,#4F46E5)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:16, flexShrink:0, marginTop:2 }}>🤖</div>
                )}

                <div style={{ display:'flex', flexDirection:'column', gap:6, maxWidth:'80%',
                  alignItems: msg.role==='user' ? 'flex-end' : 'flex-start' }}>
                  {msg.role==='assistant' ? (
                    <>
                      <div className="msg-assistant">
                        <div className="markdown">
                          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      </div>
                      {parseSources(msg.sources).length > 0 && (
                        <div style={{ width:'100%' }}>
                          <SourceCitation sources={parseSources(msg.sources)} confidence={msg.confidence}/>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="msg-user">{msg.content}</div>
                  )}
                  <div style={{ fontSize:10, color: 'var(--db-text-muted)', paddingLeft:2 }}>
                    {new Date(msg.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
                  </div>
                </div>

                {msg.role==='user' && (
                  <div style={{ width:36, height:36, borderRadius:10, background:'rgba(124,58,237,0.2)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:12, fontWeight:700, color:'#C4B5FD', flexShrink:0, marginTop:2 }}>U</div>
                )}
              </div>
            ))}

            {loading && (
              <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                <div style={{ width:36, height:36, borderRadius:10,
                  background:'linear-gradient(135deg,#7C3AED,#4F46E5)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:16, flexShrink:0 }}>🤖</div>
                <div className="msg-assistant" style={{ padding:'14px 16px' }}>
                  <div style={{ display:'flex', gap:5, alignItems:'center' }}>
                    <div className="typing-dot"/><div className="typing-dot"/><div className="typing-dot"/>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef}/>
          </div>
        </div>

        {/* Input bar */}
        <div style={{ padding:'14px 22px 18px', background:'var(--db-sidebar-bg)',
          borderTop:'1px solid var(--db-border-light)', flexShrink:0 }}>
          <div style={{ maxWidth:760, margin:'0 auto' }}>
            <div className="chat-input-wrap">
              <textarea
                ref={el=>{ inputRef.current=el; textareaRef.current=el }}
                value={input} onChange={e=>setInput(e.target.value)}
                onKeyDown={handleKeyDown} onInput={handleTextareaInput}
                placeholder="Ask a question about your study material..."
                rows={1} className="chat-textarea"
              />
              <button onClick={handleSend} disabled={loading || !input.trim()} className="send-btn"
                style={{ background: input.trim() ? 'linear-gradient(135deg,#7C3AED,#6D28D9)' :  'var(--db-border-light)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke={input.trim() ? '#fff' :  'var(--db-text-muted)'}
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </div>
            <p style={{ textAlign:'center', fontSize:10, color: 'var(--db-text-muted)', margin:'7px 0 0' }}>
              Enter to send · Shift+Enter for new line · Answers grounded in your documents
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}