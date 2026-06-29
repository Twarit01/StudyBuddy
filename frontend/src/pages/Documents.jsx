import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { listSubjects, createSubject, deleteSubject, getSubjectOverview } from '../api/subjects'
import { listDocuments, uploadDocument, deleteDocument, assignSubject, regenerateSummary, generateFormulaSheet } from '../api/documents'
import { listAllReadingProgress } from '../api/reader'
import { exportFormulaSheetPDF, exportSummaryPDF } from '../utils/exportPDF'

const SUBJECT_COLORS = ['#6366F1','#22D3EE','#10B981','#F59E0B','#EC4899','#EF4444','#8B5CF6','#14B8A6']
const SUBJECT_EMOJIS = ['📚','💻','⚡','🔬','📐','🧮','🌊','⚙️','📊','🧪']

const FILE_ICON_COLORS = {
  pdf:  { bg:'rgba(139,92,246,0.2)',  color:'#8B5CF6' },
  docx: { bg:'rgba(59,130,246,0.2)',  color:'#3B82F6' },
  txt:  { bg:'rgba(16,185,129,0.2)',  color:'#10B981' },
}
const fileStyle = (type) => FILE_ICON_COLORS[type] || FILE_ICON_COLORS.txt

export default function Documents() {
  const navigate = useNavigate()

  const [subjects, setSubjects]               = useState([])
  const [documents, setDocuments]             = useState([])
  const [activeSubject, setActiveSubject]     = useState(null)
  const [loading, setLoading]                 = useState(false)
  const [uploading, setUploading]             = useState(false)
  const [uploadProgress, setUploadProgress]   = useState(0)
  const [showNewSubject, setShowNewSubject]   = useState(false)
  const [newSubject, setNewSubject]           = useState({ name:'', color:'#6366F1', emoji:'📚' })
  const [selectedDoc, setSelectedDoc]         = useState(null)
  const [docSummary, setDocSummary]           = useState(null)
  const [docFormulas, setDocFormulas]         = useState(null)
  const [loadingSummary, setLoadingSummary]   = useState(false)
  const [loadingFormulas, setLoadingFormulas] = useState(false)
  const [activeTab, setActiveTab]             = useState('summary')
  const [dragOver, setDragOver]               = useState(false)
  const [subjectOverview, setSubjectOverview] = useState(null)
  const [loadingOverview, setLoadingOverview] = useState(false)
  const [error, setError]                     = useState(null)
  const [progressMap, setProgressMap]         = useState({})

  const readPct = (doc) => progressMap[doc.id]?.percent ?? 0

  useEffect(() => { fetchSubjects(); fetchDocuments(); fetchReadingProgress() }, [])

  const fetchReadingProgress = async () => {
    try {
      const rows = await listAllReadingProgress()
      const map = {}
      rows.forEach(r => { map[r.document_id] = r })
      setProgressMap(map)
    } catch { /* optional */ }
  }
  useEffect(() => { fetchDocuments(activeSubject); setSubjectOverview(null) }, [activeSubject])

  const fetchSubjects = async () => {
    try { const d = await listSubjects(); setSubjects(Array.isArray(d) ? d : []) }
    catch { setSubjects([]) }
  }

  const fetchDocuments = async (subjectId = null) => {
    setLoading(true); setError(null)
    try { const d = await listDocuments(subjectId); setDocuments(Array.isArray(d) ? d : []) }
    catch { setDocuments([]); setError('Could not load documents. Please refresh.') }
    finally { setLoading(false) }
  }

  const handleFileSelect = async (file) => {
    if (!file) return
    setUploading(true); setUploadProgress(0); setError(null)
    try {
      await uploadDocument(file, activeSubject, pct => setUploadProgress(pct))
      fetchDocuments(activeSubject); fetchSubjects()
    } catch (err) {
      setError(err.response?.data?.detail || 'Upload failed. Please try again.')
    } finally { setUploading(false); setUploadProgress(0) }
  }

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  const handleCreateSubject = async () => {
    if (!newSubject.name.trim()) return
    try {
      await createSubject(newSubject.name, newSubject.color, newSubject.emoji)
      await fetchSubjects()
      setShowNewSubject(false)
      setNewSubject({ name:'', color:'#6366F1', emoji:'📚' })
    } catch (err) { setError(err.response?.data?.detail || 'Could not create subject.') }
  }

  const handleDeleteSubject = async (subjectId) => {
    if (!window.confirm('Delete this subject? Documents will move to uncategorized.')) return
    try {
      await deleteSubject(subjectId); await fetchSubjects()
      if (activeSubject === subjectId) setActiveSubject(null)
    } catch (err) { console.error(err) }
  }

  const handleDeleteDocument = async (docId) => {
    try {
      await deleteDocument(docId)
      setDocuments(prev => prev.filter(d => d.id !== docId))
      if (selectedDoc?.id === docId) setSelectedDoc(null)
      fetchSubjects()
    } catch (err) { setError(err.response?.data?.detail || 'Could not delete document.') }
  }

  const handleSelectDoc = (doc) => {
    if (selectedDoc?.id === doc.id) { setSelectedDoc(null); return }
    setSelectedDoc(doc)
    setDocSummary(doc.summary || null)
    setDocFormulas(doc.formula_sheet || null)
    setActiveTab('summary')
  }

  const handleGetSummary = async () => {
    if (!selectedDoc) return
    setLoadingSummary(true)
    try {
      if (selectedDoc.summary) { setDocSummary(selectedDoc.summary); return }
      const data = await regenerateSummary(selectedDoc.id)
      setDocSummary(data.summary)
      setDocuments(prev => prev.map(d => d.id===selectedDoc.id ? {...d, summary:data.summary} : d))
    } catch (err) { console.error(err) }
    finally { setLoadingSummary(false) }
  }

  const handleGetFormulas = async () => {
    if (!selectedDoc) return
    setLoadingFormulas(true)
    try {
      const data = await generateFormulaSheet(selectedDoc.id)
      setDocFormulas(data.formula_sheet)
      setDocuments(prev => prev.map(d => d.id===selectedDoc.id ? {...d, formula_sheet:data.formula_sheet} : d))
    } catch (err) { console.error(err) }
    finally { setLoadingFormulas(false) }
  }

  const handleSubjectOverview = async () => {
    if (!activeSubject) return
    setLoadingOverview(true)
    try { const data = await getSubjectOverview(activeSubject); setSubjectOverview(data) }
    catch (err) { console.error(err) }
    finally { setLoadingOverview(false) }
  }

  const handleAssignSubject = async (docId, subjectId) => {
    try { await assignSubject(docId, subjectId || null); fetchDocuments(activeSubject); fetchSubjects() }
    catch (err) { console.error(err) }
  }

  const activeSubjectData = subjects.find(s => s.id === activeSubject)

  return (
    <div style={{
      display:'flex', height:'100%', overflow:'hidden', background:'#0C0C14',
      color:'#fff', fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'
    }}>
      <style>{`
        .sb-item { display:flex; align-items:center; gap:9px; padding:8px 10px; border-radius:10px;
                   cursor:pointer; font-size:12px; font-weight:500; color:rgba(255,255,255,0.45);
                   transition:all 0.15s; border:none; background:none; width:100%; text-align:left; }
        .sb-item:hover { background:rgba(255,255,255,0.06); color:rgba(255,255,255,0.85); }
        .sb-item.active { background:rgba(124,58,237,0.2); color:#C4B5FD; }
        .doc-row { display:flex; align-items:center; gap:0; background:#13131F;
                   border:1px solid rgba(255,255,255,0.07); border-radius:14px;
                   padding:18px 20px; transition:all 0.15s; cursor:default; }
        .doc-row:hover { border-color:rgba(255,255,255,0.13); }
        .doc-row.selected { border-color:rgba(124,58,237,0.45); background:#17172A; }
        .act-btn { display:inline-flex; align-items:center; gap:5px; padding:7px 14px;
                   border-radius:9px; font-size:12px; font-weight:600; cursor:pointer;
                   border:1px solid; transition:all 0.15s; font-family:inherit; white-space:nowrap; }
        .act-btn-ghost { background:rgba(255,255,255,0.04); border-color:rgba(255,255,255,0.1);
                         color:rgba(255,255,255,0.6); }
        .act-btn-ghost:hover { background:rgba(255,255,255,0.08); color:#fff; }
        .act-btn-purple { background:rgba(124,58,237,0.2); border-color:rgba(124,58,237,0.4); color:#C4B5FD; }
        .act-btn-purple:hover { background:rgba(124,58,237,0.35); }
        .act-btn-primary { background:linear-gradient(135deg,#7C3AED,#6D28D9); border-color:transparent; color:#fff; }
        .act-btn-primary:hover { background:linear-gradient(135deg,#8B5CF6,#7C3AED); }
        .tab-btn { flex:1; padding:11px 0; font-size:13px; font-weight:600; cursor:pointer;
                   border:none; background:none; font-family:inherit; transition:all 0.15s;
                   border-bottom:2px solid transparent; }
        .scroll-thin::-webkit-scrollbar { width:4px; }
        .scroll-thin::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:4px; }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:none} }
        .fade-in { animation:fadeIn 0.2s ease; }
        .pbar-track { height:4px; background:rgba(255,255,255,0.07); border-radius:4px; overflow:hidden; }
        .pbar-fill  { height:100%; border-radius:4px; transition:width 0.4s; }
        .del-btn { opacity:0; transition:opacity 0.15s; background:none; border:none;
                   cursor:pointer; color:rgba(255,255,255,0.3); font-size:13px; padding:4px 6px; }
        .del-btn:hover { color:#F87171; }
        .doc-row:hover .del-btn { opacity:1; }
      `}</style>

      {/* ── Left: Subjects sidebar ── */}
      <div style={{
        width:196, flexShrink:0, display:'flex', flexDirection:'column',
        background:'#0E0E1A', borderRight:'1px solid rgba(255,255,255,0.06)', overflow:'hidden'
      }}>
        <div style={{ padding:'16px 12px 10px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <span style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.28)', letterSpacing:1 }}>SUBJECTS</span>
            <button onClick={()=>setShowNewSubject(p=>!p)}
              style={{ width:22, height:22, borderRadius:6, background:'rgba(124,58,237,0.2)',
                border:'none', cursor:'pointer', color:'#C4B5FD', fontSize:15,
                display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1 }}>+</button>
          </div>

          {showNewSubject && (
            <div style={{ padding:11, borderRadius:11, background:'rgba(255,255,255,0.04)',
              border:'1px solid rgba(255,255,255,0.08)', marginBottom:8 }}>
              <input type="text" value={newSubject.name}
                onChange={e=>setNewSubject({...newSubject, name:e.target.value})}
                placeholder="Subject name"
                onKeyDown={e=>e.key==='Enter'&&handleCreateSubject()}
                autoFocus
                style={{ width:'100%', background:'rgba(255,255,255,0.05)',
                  border:'1px solid rgba(255,255,255,0.1)', borderRadius:7,
                  padding:'6px 9px', color:'#fff', fontSize:12, outline:'none',
                  fontFamily:'inherit', marginBottom:8, boxSizing:'border-box' }}/>
              <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:7 }}>
                {SUBJECT_EMOJIS.map(em=>(
                  <button key={em} onClick={()=>setNewSubject({...newSubject, emoji:em})}
                    style={{ background:newSubject.emoji===em?'rgba(124,58,237,0.3)':'transparent',
                      border:'none', cursor:'pointer', borderRadius:5, padding:'2px 3px', fontSize:13 }}>{em}</button>
                ))}
              </div>
              <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:10 }}>
                {SUBJECT_COLORS.map(c=>(
                  <div key={c} onClick={()=>setNewSubject({...newSubject, color:c})}
                    style={{ width:16, height:16, borderRadius:'50%', background:c, cursor:'pointer',
                      outline:newSubject.color===c?`2px solid ${c}`:'none', outlineOffset:2 }}/>
                ))}
              </div>
              <div style={{ display:'flex', gap:6 }}>
                <button onClick={handleCreateSubject}
                  style={{ flex:1, background:'linear-gradient(135deg,#7C3AED,#6D28D9)', color:'#fff',
                    border:'none', borderRadius:7, padding:'6px 0', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                  Create
                </button>
                <button onClick={()=>setShowNewSubject(false)}
                  style={{ flex:1, background:'rgba(255,255,255,0.07)', color:'rgba(255,255,255,0.55)',
                    border:'none', borderRadius:7, padding:'6px 0', fontSize:11, cursor:'pointer' }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="scroll-thin" style={{ flex:1, overflowY:'auto', padding:'8px' }}>
          <button onClick={()=>setActiveSubject(null)}
            className={`sb-item${activeSubject===null?' active':''}`}>
            <span style={{ fontSize:15 }}>📁</span>
            <span style={{ flex:1 }}>All files</span>
            <span style={{ fontSize:10, color:'rgba(255,255,255,0.28)' }}>{documents.length}</span>
          </button>
          {subjects.map(s=>(
            <div key={s.id} style={{ position:'relative' }}
              onMouseEnter={e=>{ const b=e.currentTarget.querySelector('.dsb'); if(b) b.style.opacity='1' }}
              onMouseLeave={e=>{ const b=e.currentTarget.querySelector('.dsb'); if(b) b.style.opacity='0' }}>
              <button onClick={()=>setActiveSubject(s.id)}
                className={`sb-item${activeSubject===s.id?' active':''}`}>
                <span style={{ color:s.color }}>{s.emoji}</span>
                <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.name}</span>
                <span style={{ fontSize:10, color:'rgba(255,255,255,0.28)' }}>{s.doc_count}</span>
              </button>
              <button className="dsb" onClick={()=>handleDeleteSubject(s.id)}
                style={{ position:'absolute', right:6, top:'50%', transform:'translateY(-50%)',
                  background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.28)',
                  fontSize:11, opacity:0, transition:'opacity 0.15s', padding:'2px 4px' }}>✕</button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main ── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Top bar */}
        <div style={{ padding:'18px 24px', background:'#0E0E1A',
          borderBottom:'1px solid rgba(255,255,255,0.06)', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
            <div>
              <h1 style={{ margin:0, fontSize:22, fontWeight:800, letterSpacing:'-0.3px' }}>
                {activeSubjectData ? `${activeSubjectData.emoji} ${activeSubjectData.name}` : 'Document Hub'}
              </h1>
              <p style={{ margin:'4px 0 0', fontSize:12, color:'rgba(255,255,255,0.38)' }}>
                Upload study materials and chat with your AI tutor about them
              </p>
            </div>
            <div style={{ display:'flex', gap:9, alignItems:'center' }}>
              {activeSubject && (
                <button onClick={handleSubjectOverview} disabled={loadingOverview}
                  className="act-btn act-btn-ghost">
                  {loadingOverview
                    ? <div style={{ width:12, height:12, border:'2px solid rgba(255,255,255,0.3)',
                        borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
                    : '✨'} AI Overview
                </button>
              )}
              <label className="act-btn act-btn-primary" style={{ cursor:'pointer' }}>
                + Upload Document
                <input type="file" accept=".pdf,.docx,.txt" style={{ display:'none' }}
                  onChange={e=>e.target.files[0]&&handleFileSelect(e.target.files[0])}/>
              </label>
            </div>
          </div>
        </div>

        {/* Upload progress */}
        {uploading && (
          <div style={{ padding:'10px 24px', background:'rgba(124,58,237,0.08)',
            borderBottom:'1px solid rgba(124,58,237,0.2)', flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:13, height:13, border:'2px solid rgba(124,58,237,0.4)',
                borderTopColor:'#7C3AED', borderRadius:'50%', animation:'spin 0.8s linear infinite', flexShrink:0 }}/>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:4 }}>
                  <span style={{ color:'#C4B5FD', fontWeight:600 }}>Uploading and processing...</span>
                  <span style={{ color:'#7C3AED', fontWeight:700 }}>{uploadProgress}%</span>
                </div>
                <div className="pbar-track">
                  <div className="pbar-fill" style={{ width:`${uploadProgress}%`, background:'linear-gradient(90deg,#7C3AED,#22D3EE)' }}/>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AI overview banner */}
        {subjectOverview && (
          <div style={{ padding:'13px 24px', background:'rgba(124,58,237,0.08)',
            borderBottom:'1px solid rgba(124,58,237,0.2)', flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
              <div style={{ display:'flex', gap:9, alignItems:'flex-start' }}>
                <span style={{ fontSize:15, marginTop:1 }}>✨</span>
                <div>
                  <div style={{ fontSize:11, fontWeight:700, color:'#C4B5FD', marginBottom:4 }}>AI Subject Overview</div>
                  <p style={{ margin:0, fontSize:12, color:'rgba(196,181,253,0.72)', lineHeight:1.65 }}>
                    {subjectOverview.overview}
                  </p>
                </div>
              </div>
              <button onClick={()=>setSubjectOverview(null)}
                style={{ background:'none', border:'none', cursor:'pointer',
                  color:'rgba(255,255,255,0.3)', fontSize:13, flexShrink:0, padding:2 }}>✕</button>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ padding:'9px 24px', background:'rgba(239,68,68,0.08)',
            borderBottom:'1px solid rgba(239,68,68,0.2)', fontSize:12, color:'#FCA5A5', flexShrink:0 }}>
            {error}
          </div>
        )}

        {/* Body */}
        <div style={{ flex:1, overflow:'hidden', display:'flex' }}>

          {/* Document list */}
          <div className="scroll-thin"
            style={{ overflowY:'auto', transition:'width 0.25s',
              width: selectedDoc ? '52%' : '100%', flexShrink:0 }}>

            {/* Drop zone */}
            {!loading && documents.length===0 && (
              <div onDrop={handleDrop}
                onDragOver={e=>{e.preventDefault();setDragOver(true)}}
                onDragLeave={()=>setDragOver(false)}
                style={{ margin:'20px 24px', borderRadius:18, padding:'56px 32px', textAlign:'center',
                  border:`2px dashed ${dragOver?'#7C3AED':'rgba(255,255,255,0.1)'}`,
                  background: dragOver?'rgba(124,58,237,0.07)':'rgba(255,255,255,0.02)',
                  transition:'all 0.2s' }}>
                <div style={{ width:56, height:56, borderRadius:18, background:'rgba(124,58,237,0.15)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:26, margin:'0 auto 16px' }}>📤</div>
                <p style={{ fontSize:17, fontWeight:700, margin:'0 0 7px' }}>Drop your documents here</p>
                <p style={{ fontSize:12, color:'rgba(255,255,255,0.38)', margin:'0 0 22px' }}>
                  PDF, DOCX, TXT · Up to 50MB each
                </p>
                <label className="act-btn act-btn-primary" style={{ cursor:'pointer' }}>
                  Browse files
                  <input type="file" accept=".pdf,.docx,.txt" style={{ display:'none' }}
                    onChange={e=>e.target.files[0]&&handleFileSelect(e.target.files[0])}/>
                </label>
              </div>
            )}

            {loading && (
              <div style={{ display:'flex', justifyContent:'center', padding:60 }}>
                <div style={{ width:24, height:24, border:'3px solid #7C3AED',
                  borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
              </div>
            )}

            {/* ── Figma-style document rows ── */}
            {!loading && documents.length>0 && (
              <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:10 }}>
                {documents.map(doc=>{
                  const fc  = fileStyle(doc.file_type)
                  const pct = readPct(doc)
                  const isSelected = selectedDoc?.id===doc.id
                  return (
                    <div key={doc.id} className={`doc-row fade-in${isSelected?' selected':''}`}>

                      {/* Coloured file icon */}
                      <div style={{ width:44, height:44, borderRadius:13, flexShrink:0,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:22, background:fc.bg, marginRight:16 }}>📄</div>

                      {/* Doc info + progress bar */}
                      <div style={{ flex:1, minWidth:0, marginRight:16 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                          <p style={{ margin:0, fontSize:14, fontWeight:700,
                            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                            color:'rgba(255,255,255,0.92)' }}>{doc.original_name}</p>
                          {doc.summary && (
                            <span style={{ padding:'2px 7px', borderRadius:20, fontSize:10, fontWeight:700,
                              background:'rgba(16,185,129,0.18)', color:'#6EE7B7', flexShrink:0 }}>Summary</span>
                          )}
                          {doc.formula_sheet && (
                            <span style={{ padding:'2px 7px', borderRadius:20, fontSize:10, fontWeight:700,
                              background:'rgba(245,158,11,0.18)', color:'#FCD34D', flexShrink:0 }}>Formulas</span>
                          )}
                        </div>
                        <p style={{ margin:'0 0 10px', fontSize:11, color:'rgba(255,255,255,0.35)' }}>
                          {doc.chunk_count} chunks
                          {activeSubject===null && doc.subject_id &&
                            (() => { const s=subjects.find(x=>x.id===doc.subject_id); return s?` · ${s.emoji} ${s.name}`:'' })()
                          }
                          &nbsp;·&nbsp;{doc.file_type?.toUpperCase()}
                        </p>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <div className="pbar-track" style={{ flex:1 }}>
                            <div className="pbar-fill"
                              style={{ width:`${pct}%`, background:`linear-gradient(90deg,${fc.color},rgba(255,255,255,0.25))` }}/>
                          </div>
                          <span style={{ fontSize:11, fontWeight:700, color:fc.color, flexShrink:0 }}>{pct}%</span>
                        </div>
                        {activeSubject===null && (
                          <select value={doc.subject_id||''}
                            onChange={e=>{e.stopPropagation();handleAssignSubject(doc.id,e.target.value)}}
                            onClick={e=>e.stopPropagation()}
                            style={{ marginTop:9, background:'rgba(255,255,255,0.04)',
                              border:'1px solid rgba(255,255,255,0.08)', borderRadius:7,
                              padding:'4px 8px', color:'rgba(255,255,255,0.5)',
                              fontSize:11, outline:'none', cursor:'pointer' }}>
                            <option value="">No subject</option>
                            {subjects.map(s=><option key={s.id} value={s.id}>{s.emoji} {s.name}</option>)}
                          </select>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div style={{ display:'flex', gap:7, alignItems:'center', flexShrink:0 }}>
                        <button onClick={()=>navigate('/chat',{state:{documentId:doc.id}})}
                          className="act-btn act-btn-ghost">💬 Chat</button>
                        <button onClick={()=>navigate(`/reader/${doc.id}`, {
                          state: { page: progressMap[doc.id]?.last_page || 1 }
                        })}
                          className="act-btn act-btn-primary">📖 Reader</button>
                        <button onClick={()=>handleSelectDoc(doc)}
                          className="act-btn act-btn-purple">
                          ▷ {isSelected ? 'Close' : 'Resume'}
                        </button>
                        <button className="del-btn" onClick={()=>handleDeleteDocument(doc.id)}>🗑</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Right: Preview panel ── */}
          {selectedDoc && (
            <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden',
              background:'#0E0E1A', borderLeft:'1px solid rgba(255,255,255,0.06)' }}>

              <div style={{ padding:'14px 18px', borderBottom:'1px solid rgba(255,255,255,0.06)',
                display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
                  <div style={{ width:36, height:36, borderRadius:10, flexShrink:0,
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:18,
                    background: fileStyle(selectedDoc.file_type).bg }}>📄</div>
                  <div style={{ minWidth:0 }}>
                    <p style={{ margin:0, fontSize:13, fontWeight:600, overflow:'hidden',
                      textOverflow:'ellipsis', whiteSpace:'nowrap', color:'rgba(255,255,255,0.9)' }}>
                      {selectedDoc.original_name}
                    </p>
                    <p style={{ margin:'2px 0 0', fontSize:11, color:'rgba(255,255,255,0.35)' }}>
                      {(selectedDoc.file_size/1024).toFixed(0)} KB · {selectedDoc.chunk_count} chunks · {selectedDoc.file_type?.toUpperCase()}
                    </p>
                  </div>
                </div>
                <button onClick={()=>setSelectedDoc(null)}
                  style={{ width:28, height:28, borderRadius:8, background:'rgba(255,255,255,0.06)',
                    border:'none', cursor:'pointer', color:'rgba(255,255,255,0.5)',
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, flexShrink:0 }}>✕</button>
              </div>

              <div style={{ padding:'10px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)',
                display:'flex', gap:7, flexWrap:'wrap', flexShrink:0 }}>
                <button onClick={()=>navigate(`/reader/${selectedDoc.id}`, {
                  state: { page: progressMap[selectedDoc.id]?.last_page || 1 }
                })}
                  className="act-btn act-btn-primary" style={{ fontSize:11 }}>📖 Open in Reader</button>
                <button onClick={()=>navigate('/chat',{state:{documentId:selectedDoc.id}})}
                  className="act-btn act-btn-ghost" style={{ fontSize:11 }}>💬 Ask about this</button>
                <button onClick={()=>navigate('/quiz',{state:{documentId:selectedDoc.id}})}
                  className="act-btn act-btn-ghost" style={{ fontSize:11 }}>📝 Quiz from this</button>
                <button onClick={()=>navigate('/flashcards',{state:{documentId:selectedDoc.id}})}
                  className="act-btn act-btn-ghost" style={{ fontSize:11 }}>🃏 Cards from this</button>
              </div>

              <div style={{ display:'flex', borderBottom:'1px solid rgba(255,255,255,0.06)', flexShrink:0 }}>
                {[{id:'summary',label:'📋 Summary'},{id:'formulas',label:'🧮 Formulas'}].map(tab=>(
                  <button key={tab.id}
                    onClick={()=>{ setActiveTab(tab.id); tab.id==='summary'?handleGetSummary():handleGetFormulas() }}
                    className="tab-btn"
                    style={{ color:activeTab===tab.id?'#C4B5FD':'rgba(255,255,255,0.38)',
                      borderBottomColor:activeTab===tab.id?'#7C3AED':'transparent' }}>
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="scroll-thin" style={{ flex:1, overflowY:'auto', padding:20 }}>
                {activeTab==='summary' && (
                  loadingSummary ? (
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:48 }}>
                      <div style={{ width:26, height:26, border:'3px solid rgba(124,58,237,0.3)',
                        borderTopColor:'#7C3AED', borderRadius:'50%', animation:'spin 0.8s linear infinite', marginBottom:12 }}/>
                      <p style={{ fontSize:12, color:'rgba(255,255,255,0.38)', margin:0 }}>Generating summary with AI...</p>
                    </div>
                  ) : docSummary ? (
                    <div>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                        <span style={{ padding:'3px 10px', borderRadius:20, fontSize:10, fontWeight:700,
                          background:'rgba(16,185,129,0.2)', color:'#6EE7B7' }}>✓ AI Generated</span>
                        <button onClick={()=>exportSummaryPDF({summary:docSummary,documentName:selectedDoc.original_name})}
                          className="act-btn act-btn-ghost" style={{ fontSize:11 }}>↓ Export PDF</button>
                      </div>
                      <div style={{ fontSize:13, lineHeight:1.78, whiteSpace:'pre-wrap', color:'rgba(255,255,255,0.72)' }}>
                        {docSummary}
                      </div>
                    </div>
                  ) : (
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', padding:'48px 24px' }}>
                      <div style={{ width:48, height:48, borderRadius:14, background:'rgba(124,58,237,0.14)',
                        display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, marginBottom:14 }}>📋</div>
                      <p style={{ fontSize:14, fontWeight:700, margin:'0 0 6px' }}>No summary yet</p>
                      <p style={{ fontSize:12, color:'rgba(255,255,255,0.38)', margin:'0 0 18px' }}>Generate an AI summary of this document</p>
                      <button onClick={handleGetSummary} className="act-btn act-btn-primary">✨ Generate summary</button>
                    </div>
                  )
                )}
                {activeTab==='formulas' && (
                  loadingFormulas ? (
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:48 }}>
                      <div style={{ width:26, height:26, border:'3px solid rgba(34,211,238,0.3)',
                        borderTopColor:'#22D3EE', borderRadius:'50%', animation:'spin 0.8s linear infinite', marginBottom:12 }}/>
                      <p style={{ fontSize:12, color:'rgba(255,255,255,0.38)', margin:0 }}>Extracting formulas with AI...</p>
                    </div>
                  ) : docFormulas ? (
                    <div>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                        <span style={{ padding:'3px 10px', borderRadius:20, fontSize:10, fontWeight:700,
                          background:'rgba(245,158,11,0.2)', color:'#FCD34D' }}>Formula sheet</span>
                        <button onClick={()=>exportFormulaSheetPDF({formulas:docFormulas,documentName:selectedDoc.original_name})}
                          className="act-btn act-btn-ghost" style={{ fontSize:11 }}>↓ Export PDF</button>
                      </div>
                      <div style={{ fontSize:12, lineHeight:1.78, whiteSpace:'pre-wrap', fontFamily:'monospace',
                        color:'rgba(255,255,255,0.72)', background:'rgba(255,255,255,0.03)',
                        borderRadius:10, padding:'14px 16px', border:'1px solid rgba(255,255,255,0.07)' }}>
                        {docFormulas}
                      </div>
                    </div>
                  ) : (
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', padding:'48px 24px' }}>
                      <div style={{ width:48, height:48, borderRadius:14, background:'rgba(34,211,238,0.1)',
                        display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, marginBottom:14 }}>🧮</div>
                      <p style={{ fontSize:14, fontWeight:700, margin:'0 0 6px' }}>No formula sheet yet</p>
                      <p style={{ fontSize:12, color:'rgba(255,255,255,0.38)', margin:'0 0 18px' }}>Extract all formulas and equations from this document</p>
                      <button onClick={handleGetFormulas} className="act-btn act-btn-primary">✨ Extract formulas</button>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}