import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Document, Page, pdfjs } from 'react-pdf'
import ReactMarkdown from 'react-markdown'
import { getDocument } from '../api/documents'
import {
  getDocumentFileBlob,
  getDocumentPages,
  getPageContent,
  getReadingProgress,
  updateReadingProgress,
  getDocumentNotes,
  createDocumentNote,
  deleteDocumentNote,
  selectionAI,
} from '../api/reader'

import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'react-pdf/node_modules/pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

const TOOLBAR_ACTIONS = [
  { id: 'ask',       label: 'Ask AI',           icon: '💬' },
  { id: 'explain',   label: 'Explain Simply',   icon: '💡' },
  { id: 'summarize', label: 'Summarize',        icon: '📝' },
  { id: 'quiz',      label: 'Generate Quiz',    icon: '🎯' },
  { id: 'flashcards',label: 'Flashcards',       icon: '🃏' },
  { id: 'note',      label: 'Save as Note',     icon: '📌' },
]

function highlightText(text, query) {
  if (!query?.trim()) return text
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} style={{ background:'rgba(124,58,237,0.45)', color:'#fff', borderRadius:2 }}>{part}</mark>
      : part
  )
}

export default function DocumentReader() {
  const { documentId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const initialPage = location.state?.page || 1

  const viewerRef = useRef(null)
  const progressTimer = useRef(null)

  const [doc, setDoc]               = useState(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [fileUrl, setFileUrl]       = useState(null)
  const [fileData, setFileData]     = useState(null)
  const [numPdfPages, setNumPdfPages] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [currentPage, setCurrentPage] = useState(initialPage)
  const [pageText, setPageText]     = useState('')
  const [zoom, setZoom]             = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchMatches, setSearchMatches] = useState([])
  const [matchIndex, setMatchIndex] = useState(0)
  const [progress, setProgress]     = useState({ percent: 0, last_page: 1 })
  const [notes, setNotes]           = useState([])
  const [sideTab, setSideTab]       = useState('ai')
  const [panelOpen, setPanelOpen]   = useState(true)

  const [selection, setSelection]   = useState(null)
  const [toolbarPos, setToolbarPos] = useState(null)
  const [aiMessages, setAiMessages] = useState([])
  const [aiLoading, setAiLoading]   = useState(false)
  const [followUp, setFollowUp]     = useState('')
  const [lastAiExplanation, setLastAiExplanation] = useState(null)
  // Stores the full original selected text so follow-ups have proper context
  const aiContextText = useRef('')

  const isPdf = doc?.file_type === 'pdf'
  const isTextMode = doc && !isPdf

  const persistProgress = useCallback((page, total) => {
    clearTimeout(progressTimer.current)
    progressTimer.current = setTimeout(async () => {
      try {
        const updated = await updateReadingProgress(documentId, page, total)
        setProgress(updated)
      } catch { /* silent */ }
    }, 800)
  }, [documentId])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [docData, pagesData, prog, notesData] = await Promise.all([
          getDocument(documentId),
          getDocumentPages(documentId),
          getReadingProgress(documentId),
          getDocumentNotes(documentId),
        ])
        setDoc(docData)
        setTotalPages(pagesData.total_pages || 1)
        setNotes(notesData)
        const startPage = location.state?.page || prog.last_page || 1
        setCurrentPage(startPage)
        setProgress(prog)

        if (docData.file_type === 'pdf') {
          const blob = await getDocumentFileBlob(documentId)
          try {
            const ab = await blob.arrayBuffer()
            setFileData(ab)
          } catch (e) {
            // fallback to blob URL if arrayBuffer fails
            setFileUrl(URL.createObjectURL(blob))
          }
        }
      } catch (err) {
        setError(err.response?.data?.detail || 'Could not load document.')
      } finally {
        setLoading(false)
      }
    }
    load()
    return () => { if (fileUrl) URL.revokeObjectURL(fileUrl) }
  }, [documentId])

  useEffect(() => {
    if (!doc || isPdf) return
    const loadPage = async () => {
      try {
        const data = await getPageContent(documentId, currentPage)
        setPageText(data.text || '')
      } catch {
        setPageText('')
      }
    }
    loadPage()
  }, [doc, currentPage, documentId, isPdf])

  useEffect(() => {
    if (totalPages > 0) persistProgress(currentPage, totalPages)
  }, [currentPage, totalPages, persistProgress])

  const handlePageChange = (page) => {
    const p = Math.max(1, Math.min(page, isPdf ? (numPdfPages || totalPages) : totalPages))
    setCurrentPage(p)
    setSelection(null)
    setToolbarPos(null)
  }

  const handleTextSelection = () => {
    const sel = window.getSelection()
    const text = sel?.toString().trim()
    if (!text || text.length < 2) {
      setSelection(null)
      setToolbarPos(null)
      return
    }
    const range = sel.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    setSelection(text)
    setToolbarPos({ top: rect.top + window.scrollY - 48, left: rect.left + rect.width / 2 })
  }

  const runAIAction = async (action) => {
    if (!selection && action !== 'note') return
    setPanelOpen(true)
    setSideTab('ai')

    if (action === 'note') {
      try {
        const note = await createDocumentNote(documentId, {
          page_num: currentPage,
          highlighted_text: selection,
          ai_explanation: lastAiExplanation,
        })
        setNotes(prev => [note, ...prev])
        setSideTab('notes')
        setSelection(null)
        setToolbarPos(null)
      } catch (err) {
        setError(err.response?.data?.detail || 'Could not save note.')
      }
      return
    }

    setAiLoading(true)
    // Store the full original text so follow-ups can reference it
    aiContextText.current = selection
    setAiMessages(prev => [...prev, {
      role: 'user',
      content: `[${action}] ${selection.slice(0, 120)}${selection.length > 120 ? '…' : ''}`,
    }])

    try {
      const result = await selectionAI(documentId, {
        action,
        selected_text: selection,
        page_num: currentPage,
        save_flashcards: action === 'flashcards',
      })

      let content = result.response
      if (result.questions?.length) {
        content += '\n\n' + result.questions.map((q, i) =>
          `**Q${i + 1}.** ${q.question}\n${q.options?.join('\n') || ''}`
        ).join('\n\n')
      }
      if (result.flashcards?.length) {
        content += '\n\n' + result.flashcards.map(c => `**${c.front}** → ${c.back}`).join('\n\n')
        if (result.saved_flashcard_ids?.length) {
          content += `\n\n✅ Saved ${result.saved_flashcard_ids.length} flashcard(s) to your deck.`
        }
      }

      if (action === 'explain') setLastAiExplanation(content)
      setAiMessages(prev => [...prev, { role: 'assistant', content }])
    } catch (err) {
      setAiMessages(prev => [...prev, {
        role: 'assistant',
        content: err.response?.data?.detail || 'AI request failed. Please try again.',
      }])
    } finally {
      setAiLoading(false)
      setSelection(null)
      setToolbarPos(null)
      window.getSelection()?.removeAllRanges()
    }
  }

  const handleFollowUp = async (e) => {
    e.preventDefault()
    if (!followUp.trim() || aiMessages.length === 0) return
    const question = followUp.trim()
    setFollowUp('')
    setAiLoading(true)

    // Capture current history BEFORE adding the new user message
    // (backend appends the question itself, so we must NOT include it here)
    const historySnapshot = aiMessages.map(m => ({ role: m.role, content: m.content }))

    // Add the user message to the UI
    setAiMessages(prev => [...prev, { role: 'user', content: question }])

    // Use the stored full context text, not the truncated display string
    const contextText = aiContextText.current

    try {
      const result = await selectionAI(documentId, {
        action: 'ask',
        selected_text: contextText,
        page_num: currentPage,
        question,
        follow_up_history: historySnapshot,
      })
      setAiMessages(prev => [...prev, { role: 'assistant', content: result.response }])
    } catch (err) {
      setAiMessages(prev => [...prev, {
        role: 'assistant',
        content: err.response?.data?.detail || 'Follow-up failed. Please try again.',
      }])
    } finally {
      setAiLoading(false)
    }
  }

  const runSearch = async () => {
    if (!searchQuery.trim()) return
    const matches = []
    const total = isPdf ? (numPdfPages || totalPages) : totalPages
    for (let p = 1; p <= total; p++) {
      let text = ''
      if (isPdf) {
        try {
          const data = await getPageContent(documentId, p)
          text = data.text || ''
        } catch { continue }
      } else if (p === currentPage) {
        text = pageText
      } else {
        try {
          const data = await getPageContent(documentId, p)
          text = data.text || ''
        } catch { continue }
      }
      if (text.toLowerCase().includes(searchQuery.toLowerCase())) {
        matches.push(p)
      }
    }
    setSearchMatches(matches)
    setMatchIndex(0)
    if (matches.length) handlePageChange(matches[0])
  }

  const effectiveTotal = isPdf ? (numPdfPages || totalPages) : totalPages
  const readPct = progress.percent ?? Math.round((currentPage / effectiveTotal) * 100)

  if (loading) {
    return (
      <div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center',
        background:'#0C0C14', color:'#fff' }}>
        <div style={{ width:30, height:30, border:'3px solid #7C3AED', borderTopColor:'transparent',
          borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  if (error && !doc) {
    return (
      <div style={{ height:'100%', display:'flex', flexDirection:'column', alignItems:'center',
        justifyContent:'center', background:'#0C0C14', color:'#FCA5A5', gap:16 }}>
        <p>{error}</p>
        <button onClick={() => navigate('/documents')}
          style={{ padding:'10px 20px', borderRadius:10, border:'none',
            background:'linear-gradient(135deg,#7C3AED,#6D28D9)', color:'#fff',
            cursor:'pointer', fontWeight:600 }}>
          ← Back to Documents
        </button>
      </div>
    )
  }

  return (
    <div className="reader-page-wrapper" style={{ height:'100%', display:'flex', flexDirection:'column', overflow:'hidden',
      background:'#0C0C14', color:'#fff',
      fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <style>{`
        @keyframes spin { to { transform:rotate(360deg) } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:none } }
        .rd-toolbar-btn { background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1);
          border-radius:8px; padding:6px 12px; color:rgba(255,255,255,0.75); font-size:12px;
          cursor:pointer; font-family:inherit; transition:all 0.15s; }
        .rd-toolbar-btn:hover { background:rgba(255,255,255,0.1); color:#fff; }
        .rd-toolbar-btn:disabled { opacity:0.4; cursor:not-allowed; }
        .rd-action-btn { display:flex; align-items:center; gap:5px; padding:6px 10px; border-radius:8px;
          border:1px solid rgba(124,58,237,0.35); background:rgba(124,58,237,0.2); color:#C4B5FD;
          font-size:11px; font-weight:600; cursor:pointer; white-space:nowrap; font-family:inherit; }
        .rd-action-btn:hover { background:rgba(124,58,237,0.35); }
        .rd-side-tab { flex:1; padding:8px; border:none; background:transparent; color:rgba(255,255,255,0.4);
          font-size:12px; font-weight:600; cursor:pointer; border-bottom:2px solid transparent; font-family:inherit; }
        .rd-side-tab.active { color:#C4B5FD; border-bottom-color:#7C3AED; }
        .scroll-thin::-webkit-scrollbar { width:4px; }
        .scroll-thin::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.12); border-radius:4px; }
        .react-pdf__Page { margin:0 auto; }
        .react-pdf__Page__textContent { user-select:text !important; }
      `}</style>

      {/* Header toolbar */}
      <div style={{ padding:'12px 20px', borderBottom:'1px solid rgba(255,255,255,0.06)',
        display:'flex', alignItems:'center', gap:12, flexShrink:0, flexWrap:'wrap' }}>
        <button className="rd-toolbar-btn" onClick={() => navigate('/documents')}>← Documents</button>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14, fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {doc?.original_name}
          </div>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.35)' }}>
            Page {currentPage} of {effectiveTotal} · {readPct}% read
          </div>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <button className="rd-toolbar-btn" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage <= 1}>‹</button>
          <input type="number" min={1} max={effectiveTotal} value={currentPage}
            onChange={e => handlePageChange(Number(e.target.value))}
            style={{ width:48, textAlign:'center', background:'rgba(255,255,255,0.05)',
              border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, color:'#fff',
              padding:'6px 4px', fontSize:12 }}/>
          <button className="rd-toolbar-btn" onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= effectiveTotal}>›</button>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <button className="rd-toolbar-btn" onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}>−</button>
          <span style={{ fontSize:11, color:'rgba(255,255,255,0.5)', minWidth:36, textAlign:'center' }}>
            {Math.round(zoom * 100)}%
          </span>
          <button className="rd-toolbar-btn" onClick={() => setZoom(z => Math.min(2, z + 0.1))}>+</button>
        </div>

        <div style={{ display:'flex', gap:6 }}>
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runSearch()}
            placeholder="Search document…"
            style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)',
              borderRadius:8, padding:'6px 12px', color:'#fff', fontSize:12, width:160, outline:'none' }}/>
          <button className="rd-toolbar-btn" onClick={runSearch}>Search</button>
          {searchMatches.length > 0 && (
            <>
              <span style={{ fontSize:11, color:'rgba(255,255,255,0.4)', alignSelf:'center' }}>
                {matchIndex + 1}/{searchMatches.length}
              </span>
              <button className="rd-toolbar-btn" onClick={() => {
                const next = (matchIndex + 1) % searchMatches.length
                setMatchIndex(next)
                handlePageChange(searchMatches[next])
              }}>Next</button>
            </>
          )}
        </div>

        <button className="rd-toolbar-btn" onClick={() => setPanelOpen(o => !o)}>
          {panelOpen ? 'Hide panel' : 'Show panel'}
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ height:3, background:'rgba(255,255,255,0.06)', flexShrink:0 }}>
        <div style={{ height:'100%', width:`${readPct}%`,
          background:'linear-gradient(90deg,#7C3AED,#22D3EE)', transition:'width 0.4s ease' }}/>
      </div>

      {/* Main content */}
      <div className="reader-layout" style={{ flex:1, display:'flex', overflow:'hidden' }}>

        {/* Viewer */}
        <div ref={viewerRef} className="reader-viewer-panel scroll-thin" onMouseUp={handleTextSelection}
          style={{ flex:1, overflow:'auto', padding:'24px', background:'#0A0A12' }}>
          {isPdf && (fileData || fileUrl) ? (
            <Document file={fileData ? { data: fileData } : fileUrl} onLoadSuccess={({ numPages }) => {
              setNumPdfPages(numPages)
              if (numPages !== totalPages) setTotalPages(numPages)
            }} loading={
              <div style={{ textAlign:'center', padding:40, color:'rgba(255,255,255,0.4)' }}>Loading PDF…</div>
            }>
              <Page pageNumber={currentPage} scale={zoom} renderTextLayer renderAnnotationLayer
                loading={<div style={{ padding:40, color:'rgba(255,255,255,0.3)' }}>Loading page…</div>}/>
            </Document>
          ) : (
            <div style={{ maxWidth:780, margin:'0 auto', background:'#13131F',
              border:'1px solid rgba(255,255,255,0.07)', borderRadius:16, padding:'32px 36px',
              fontSize:15 * zoom, lineHeight:1.75, color:'rgba(255,255,255,0.88)',
              whiteSpace:'pre-wrap', userSelect:'text' }}>
              {highlightText(pageText, searchQuery)}
            </div>
          )}
        </div>

        {/* Side panel */}
        {panelOpen && (
          <div className="reader-side-panel" style={{ width:340, flexShrink:0, borderLeft:'1px solid rgba(255,255,255,0.06)',
            display:'flex', flexDirection:'column', background:'#0E0E1A' }}>
            <div style={{ display:'flex', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
              <button className={`rd-side-tab${sideTab === 'ai' ? ' active' : ''}`}
                onClick={() => setSideTab('ai')}>AI Assistant</button>
              <button className={`rd-side-tab${sideTab === 'notes' ? ' active' : ''}`}
                onClick={() => setSideTab('notes')}>Notes ({notes.length})</button>
            </div>

            {sideTab === 'ai' ? (
              <>
                <div className="scroll-thin" style={{ flex:1, overflowY:'auto', padding:16,
                  display:'flex', flexDirection:'column', gap:12 }}>
                  {aiMessages.length === 0 && (
                    <div style={{ textAlign:'center', padding:'40px 20px', color:'rgba(255,255,255,0.3)',
                      fontSize:13, lineHeight:1.6 }}>
                      Select text in the document to ask AI questions, get explanations, generate quizzes, or create flashcards.
                    </div>
                  )}
                  {aiMessages.map((msg, i) => (
                    <div key={i} style={{
                      alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth:'92%', padding:'10px 14px', borderRadius:14, fontSize:13, lineHeight:1.55,
                      background: msg.role === 'user' ? 'rgba(124,58,237,0.25)' : '#13131F',
                      border: msg.role === 'user' ? '1px solid rgba(124,58,237,0.35)' : '1px solid rgba(255,255,255,0.07)',
                      color: msg.role === 'user' ? '#E9D5FF' : 'rgba(255,255,255,0.85)',
                      animation:'fadeUp 0.25s ease',
                    }}>
                      {msg.role === 'assistant'
                        ? <ReactMarkdown className="markdown">{msg.content}</ReactMarkdown>
                        : msg.content}
                    </div>
                  ))}
                  {aiLoading && (
                    <div style={{ display:'flex', gap:5, padding:'8px 14px' }}>
                      {[0,1,2].map(i => (
                        <div key={i} style={{ width:6, height:6, borderRadius:'50%',
                          background:'#7C3AED', animation:`bounce 1s ${i * 0.15}s infinite` }}/>
                      ))}
                    </div>
                  )}
                </div>
                <form onSubmit={handleFollowUp} style={{ padding:14, borderTop:'1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display:'flex', gap:8 }}>
                    <input value={followUp} onChange={e => setFollowUp(e.target.value)}
                      placeholder="Ask a follow-up…"
                      style={{ flex:1, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)',
                        borderRadius:10, padding:'10px 12px', color:'#fff', fontSize:13, outline:'none' }}/>
                    <button type="submit" disabled={aiLoading || !followUp.trim()}
                      style={{ padding:'10px 14px', borderRadius:10, border:'none',
                        background: followUp.trim() ? 'linear-gradient(135deg,#7C3AED,#6D28D9)' : 'rgba(255,255,255,0.08)',
                        color:'#fff', cursor:'pointer', fontWeight:700, fontSize:14 }}>→</button>
                  </div>
                </form>
              </>
            ) : (
              <div className="scroll-thin" style={{ flex:1, overflowY:'auto', padding:12,
                display:'flex', flexDirection:'column', gap:10 }}>
                {notes.length === 0 && (
                  <div style={{ textAlign:'center', padding:40, color:'rgba(255,255,255,0.3)', fontSize:13 }}>
                    No notes yet. Highlight text and choose "Save as Note".
                  </div>
                )}
                {notes.map(note => (
                  <div key={note.id} style={{ background:'#13131F', border:'1px solid rgba(255,255,255,0.07)',
                    borderRadius:12, padding:14 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                      <span style={{ fontSize:10, fontWeight:700, color:'#7C3AED', letterSpacing:0.5 }}>
                        PAGE {note.page_num}
                      </span>
                      <button onClick={async () => {
                        await deleteDocumentNote(note.id)
                        setNotes(prev => prev.filter(n => n.id !== note.id))
                      }} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.25)',
                        cursor:'pointer', fontSize:12 }}>✕</button>
                    </div>
                    <p style={{ margin:'0 0 8px', fontSize:12, color:'rgba(255,255,255,0.75)',
                      fontStyle:'italic', borderLeft:'2px solid #7C3AED', paddingLeft:10 }}>
                      "{note.highlighted_text.slice(0, 200)}{note.highlighted_text.length > 200 ? '…' : ''}"
                    </p>
                    {note.ai_explanation && (
                      <p style={{ margin:0, fontSize:11, color:'rgba(255,255,255,0.45)', lineHeight:1.5 }}>
                        {note.ai_explanation.slice(0, 300)}{note.ai_explanation.length > 300 ? '…' : ''}
                      </p>
                    )}
                    <div style={{ fontSize:10, color:'rgba(255,255,255,0.2)', marginTop:8 }}>
                      {new Date(note.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating selection toolbar */}
      {selection && toolbarPos && (
        <div style={{
          position:'fixed', top: toolbarPos.top, left: toolbarPos.left,
          transform:'translateX(-50%)', zIndex:1000,
          display:'flex', gap:4, padding:6, background:'#1A1A2D',
          border:'1px solid rgba(124,58,237,0.4)', borderRadius:12,
          boxShadow:'0 8px 32px rgba(0,0,0,0.5)', animation:'fadeUp 0.2s ease',
          flexWrap:'wrap', maxWidth:'90vw',
        }}>
          {TOOLBAR_ACTIONS.map(action => (
            <button key={action.id} className="rd-action-btn"
              onMouseDown={e => e.preventDefault()}
              onClick={() => runAIAction(action.id)}>
              {action.icon} {action.label}
            </button>
          ))}
        </div>
      )}

      <style>{`@keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-4px)} }`}</style>
    </div>
  )
}
