import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { listSubjects, createSubject, deleteSubject, getSubjectOverview } from '../api/subjects'
import { listDocuments, uploadDocument, deleteDocument, assignSubject, regenerateSummary, generateFormulaSheet } from '../api/documents'
import { exportFormulaSheetPDF, exportSummaryPDF } from '../utils/exportPDF'

const SUBJECT_COLORS = ['#6366F1','#22D3EE','#10B981','#F59E0B','#EC4899','#EF4444','#8B5CF6','#14B8A6']
const SUBJECT_EMOJIS = ['📚','💻','⚡','🔬','📐','🧮','🌊','⚙️','📊','🧪']

export default function Documents() {
  const navigate = useNavigate()
  const [subjects, setSubjects]               = useState([])
  const [documents, setDocuments]             = useState([])
  const [activeSubject, setActiveSubject]     = useState(null)
  const [loading, setLoading]                 = useState(false)
  const [uploading, setUploading]             = useState(false)
  const [uploadProgress, setUploadProgress]   = useState(0)
  const [showNewSubject, setShowNewSubject]   = useState(false)
  const [newSubject, setNewSubject]           = useState({ name: '', color: '#6366F1', emoji: '📚' })
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

  useEffect(() => { fetchSubjects(); fetchDocuments() }, [])
  useEffect(() => { fetchDocuments(activeSubject); setSubjectOverview(null) }, [activeSubject])

  const fetchSubjects = async () => {
    try { const d = await listSubjects(); setSubjects(Array.isArray(d) ? d : []) }
    catch { setSubjects([]) }
  }

  const fetchDocuments = async (subjectId = null) => {
    setLoading(true); setError(null)
    try { const d = await listDocuments(subjectId); setDocuments(Array.isArray(d) ? d : []) }
    catch { setDocuments([]); setError('Could not load documents. Please refresh and try again.') }
    finally { setLoading(false) }
  }

  const handleFileSelect = async (file) => {
    if (!file) return
    setUploading(true); setUploadProgress(0); setError(null)
    try {
      await uploadDocument(file, activeSubject, pct => setUploadProgress(pct))
      fetchDocuments(activeSubject); fetchSubjects()
    } catch (err) { console.error(err); setError(err.response?.data?.detail || 'Upload failed. Please try again.') }
    finally { setUploading(false); setUploadProgress(0) }
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
      setNewSubject({ name: '', color: '#6366F1', emoji: '📚' })
    } catch (err) { console.error(err); setError(err.response?.data?.detail || 'Could not generate summary.') }
  }

  const handleDeleteSubject = async (subjectId) => {
    if (!window.confirm('Delete this subject? Documents will move to uncategorized.')) return
    try { await deleteSubject(subjectId); await fetchSubjects(); if (activeSubject === subjectId) setActiveSubject(null) }
    catch (err) { console.error(err) }
  }

  const handleDeleteDocument = async (docId) => {
    try {
      await deleteDocument(docId)
      setDocuments(prev => prev.filter(d => d.id !== docId))
      if (selectedDoc?.id === docId) setSelectedDoc(null)
      fetchSubjects()
    } catch (err) { console.error(err); setError(err.response?.data?.detail || 'Could not extract formulas.') }
  }

  const handleSelectDoc = (doc) => {
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
      setDocuments(prev => prev.map(d => d.id === selectedDoc.id ? { ...d, summary: data.summary } : d))
    } catch (err) { console.error(err) }
    finally { setLoadingSummary(false) }
  }

  const handleGetFormulas = async () => {
    if (!selectedDoc) return
    setLoadingFormulas(true)
    try {
      const data = await generateFormulaSheet(selectedDoc.id)
      setDocFormulas(data.formula_sheet)
      setDocuments(prev => prev.map(d => d.id === selectedDoc.id ? { ...d, formula_sheet: data.formula_sheet } : d))
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
    <div className="flex h-full overflow-hidden bg-[#F8FAFC] dark:bg-[#0B0F1A] transition-colors duration-200">

      {/* Left sidebar — subjects */}
      <div className="w-52 flex-shrink-0 flex flex-col overflow-hidden bg-white dark:bg-[#0D1220] border-r border-[#F1F5F9] dark:border-[#1F2937]">

        <div className="px-4 py-4 border-b border-[#F1F5F9] dark:border-[#1F2937]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-label text-[#94A3B8]">Subjects</h2>
            <button onClick={() => setShowNewSubject(true)}
              className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-indigo-50 dark:hover:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 transition-colors">
              <i className="ti ti-plus" style={{ fontSize: 14 }} aria-hidden="true"></i>
            </button>
          </div>

          {showNewSubject && (
            <div className="mb-3 p-3 rounded-xl bg-[#F8FAFC] dark:bg-[#141B2D] border border-[#E2E8F0] dark:border-[#1F2937]">
              <input
                type="text" value={newSubject.name}
                onChange={e => setNewSubject({ ...newSubject, name: e.target.value })}
                placeholder="Subject name"
                className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none mb-2 border
                  bg-white dark:bg-[#0B0F1A] border-[#E2E8F0] dark:border-[#1F2937]
                  text-[#0F172A] dark:text-[#F1F5F9] focus:border-indigo-400"
                onKeyDown={e => e.key === 'Enter' && handleCreateSubject()}
                autoFocus
              />
              <div className="flex gap-1 flex-wrap mb-2">
                {SUBJECT_EMOJIS.map(em => (
                  <button key={em} onClick={() => setNewSubject({ ...newSubject, emoji: em })}
                    className={`text-sm p-0.5 rounded transition-colors ${newSubject.emoji === em ? 'bg-indigo-100 dark:bg-indigo-500/20' : 'hover:bg-slate-100 dark:hover:bg-[#1F2937]'}`}>
                    {em}
                  </button>
                ))}
              </div>
              <div className="flex gap-1 flex-wrap mb-2">
                {SUBJECT_COLORS.map(color => (
                  <button key={color} onClick={() => setNewSubject({ ...newSubject, color })}
                    style={{ backgroundColor: color, width: 18, height: 18, borderRadius: '50%' }}
                    className={`transition-transform ${newSubject.color === color ? 'scale-125 ring-2 ring-white dark:ring-[#141B2D]' : ''}`} />
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={handleCreateSubject} className="flex-1 bg-indigo-600 text-white text-xs rounded-lg py-1.5 hover:bg-indigo-700">Create</button>
                <button onClick={() => setShowNewSubject(false)} className="flex-1 bg-slate-200 dark:bg-[#1F2937] text-slate-700 dark:text-slate-300 text-xs rounded-lg py-1.5">Cancel</button>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          <button
            onClick={() => setActiveSubject(null)}
            className={`nav-item w-full mb-0.5 ${activeSubject === null ? 'active' : ''}`}
          >
            <i className="ti ti-folders" style={{ fontSize: 16 }} aria-hidden="true"></i>
            <span className="flex-1 text-left">All files</span>
            <span className="text-[10px] text-slate-400">{documents.length}</span>
          </button>

          {subjects.map(s => (
            <div key={s.id} className="group relative mb-0.5">
              <button
                onClick={() => setActiveSubject(s.id)}
                className={`nav-item w-full ${activeSubject === s.id ? 'active' : ''}`}
              >
                <span style={{ color: s.color }}>{s.emoji}</span>
                <span className="flex-1 text-left text-sm truncate">{s.name}</span>
                <span className="text-[10px] text-slate-400">{s.doc_count}</span>
              </button>
              <button
                onClick={() => handleDeleteSubject(s.id)}
                className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all text-slate-400"
              >
                <i className="ti ti-x" style={{ fontSize: 11 }} aria-hidden="true"></i>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <div className="px-6 py-4 flex items-center justify-between bg-white dark:bg-[#0D1220] border-b border-[#F1F5F9] dark:border-[#1F2937]">
          <div>
            <h1 className="text-title text-[#0F172A] dark:text-[#F1F5F9]">
              {activeSubjectData ? `${activeSubjectData.emoji} ${activeSubjectData.name}` : 'All documents'}
            </h1>
            <p className="text-caption mt-0.5 text-[#94A3B8]">
              {documents.length} document{documents.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {activeSubject && (
              <button onClick={handleSubjectOverview} disabled={loadingOverview}
                className="btn-secondary text-xs py-2 px-3">
                <i className="ti ti-sparkles" style={{ fontSize: 14, color: '#6366F1' }} aria-hidden="true"></i>
                {loadingOverview ? 'Generating...' : 'AI Overview'}
              </button>
            )}
            <label className="btn-primary text-sm cursor-pointer">
              <i className="ti ti-upload" style={{ fontSize: 16 }} aria-hidden="true"></i>
              Upload
              <input type="file" accept=".pdf,.docx,.txt" className="hidden"
                onChange={e => e.target.files[0] && handleFileSelect(e.target.files[0])} />
            </label>
          </div>
        </div>

        {/* Upload progress */}
        {uploading && (
          <div className="px-6 py-2 bg-[#EEF2FF] dark:bg-indigo-500/10 border-b border-[#C7D2FE] dark:border-indigo-500/20">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin flex-shrink-0" />
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-indigo-700 dark:text-indigo-300 font-medium">Uploading and processing...</span>
                  <span className="text-indigo-500 dark:text-indigo-400">{uploadProgress}%</span>
                </div>
                <div className="progress-bar" style={{ height: 4 }}>
                  <div className="progress-fill progress-fill-indigo" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Subject overview banner */}
        {subjectOverview && (
          <div className="px-6 py-4 bg-[#EEF2FF] dark:bg-indigo-500/10 border-b border-[#C7D2FE] dark:border-indigo-500/20">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <i className="ti ti-sparkles mt-0.5" style={{ fontSize: 16, color: '#6366F1' }} aria-hidden="true"></i>
                <div>
                  <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-1">AI Subject Overview</p>
                  <p className="text-xs text-indigo-600 dark:text-indigo-300/80 leading-relaxed line-clamp-3">{subjectOverview.overview}</p>
                </div>
              </div>
              <button onClick={() => setSubjectOverview(null)} className="text-indigo-400 hover:text-indigo-600 flex-shrink-0">
                <i className="ti ti-x" style={{ fontSize: 14 }} aria-hidden="true"></i>
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="px-6 py-3 bg-red-50 dark:bg-red-500/10 border-b border-red-200 dark:border-red-500/20 text-sm text-red-600 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">

          {/* Document grid */}
          <div className={`overflow-y-auto transition-all duration-300 ${selectedDoc ? 'lg:w-[420px] lg:flex-shrink-0 max-h-[45%] lg:max-h-none' : 'flex-1'}`}>

            {/* Drop zone (when no docs) */}
            {!loading && documents.length === 0 && (
              <div
                onDrop={handleDrop}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                className="m-6 flex flex-col items-center justify-center rounded-2xl py-16 text-center transition-colors"
                style={{
                  border: `2px dashed ${dragOver ? '#6366F1' : 'var(--drop-border)'}`,
                  background: dragOver ? 'rgba(99,102,241,0.06)' : 'var(--drop-bg)',
                }}
              >
                <style>{`:root{--drop-border:#E2E8F0;--drop-bg:#F8FAFC}.dark{--drop-border:#1F2937;--drop-bg:#141B2D}`}</style>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 bg-[#EEF2FF] dark:bg-indigo-500/15">
                  <i className="ti ti-cloud-upload" style={{ fontSize: 26, color: '#6366F1' }} aria-hidden="true"></i>
                </div>
                <p className="text-sm font-medium text-[#0F172A] dark:text-[#F1F5F9] mb-1">Drop files here</p>
                <p className="text-caption mb-4 text-[#94A3B8]">PDF, DOCX, or TXT — up to 50MB</p>
                <label className="btn-primary text-sm cursor-pointer">
                  <i className="ti ti-upload" style={{ fontSize: 15 }} aria-hidden="true"></i>
                  Browse files
                  <input type="file" accept=".pdf,.docx,.txt" className="hidden"
                    onChange={e => e.target.files[0] && handleFileSelect(e.target.files[0])} />
                </label>
              </div>
            )}

            {loading && (
              <div className="flex justify-center py-20">
                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {!loading && documents.length > 0 && (
              <div className="p-6">
                <div className={`grid gap-3 ${selectedDoc ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
                  {documents.map(doc => (
                    <div
                      key={doc.id}
                      onClick={() => handleSelectDoc(doc)}
                      className={`p-4 rounded-2xl border cursor-pointer group transition-all bg-white dark:bg-[#141B2D] shadow-sm
                        ${selectedDoc?.id === doc.id
                          ? 'border-indigo-300 dark:border-indigo-500/50 ring-1 ring-indigo-200 dark:ring-indigo-500/30'
                          : 'border-[#E2E8F0] dark:border-[#1F2937]'}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: doc.file_type === 'pdf' ? 'rgba(239,68,68,0.12)' : doc.file_type === 'docx' ? 'rgba(59,130,246,0.12)' : 'rgba(16,185,129,0.12)' }}>
                          <i className="ti ti-file-text" style={{ fontSize: 18, color: doc.file_type === 'pdf' ? '#EF4444' : doc.file_type === 'docx' ? '#3B82F6' : '#10B981' }} aria-hidden="true"></i>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#0F172A] dark:text-[#F1F5F9] truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{doc.original_name}</p>
                          <p className="text-caption mt-0.5 text-[#94A3B8]">
                            {(doc.file_size / 1024).toFixed(0)} KB · {doc.chunk_count} chunks
                          </p>
                          <div className="flex gap-1.5 mt-2">
                            {doc.summary && <span className="badge badge-green">Summary</span>}
                            {doc.formula_sheet && <span className="badge badge-amber">Formulas</span>}
                          </div>
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); handleDeleteDocument(doc.id) }}
                          className="opacity-0 group-hover:opacity-100 hover:text-red-500 text-slate-400 transition-all flex-shrink-0 mt-0.5"
                        >
                          <i className="ti ti-trash" style={{ fontSize: 14 }} aria-hidden="true"></i>
                        </button>
                      </div>

                      {activeSubject === null && (
                        <select
                          value={doc.subject_id || ''}
                          onChange={e => { e.stopPropagation(); handleAssignSubject(doc.id, e.target.value) }}
                          onClick={e => e.stopPropagation()}
                          className="mt-3 w-full rounded-lg px-2 py-1 text-[11px] outline-none border
                            bg-[#F8FAFC] dark:bg-[#0B0F1A] border-[#E2E8F0] dark:border-[#1F2937]
                            text-[#0F172A] dark:text-[#F1F5F9]"
                        >
                          <option value="">No subject</option>
                          {subjects.map(s => <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>)}
                        </select>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Slide-over preview panel */}
          {selectedDoc && (
            <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#0D1220] border-l border-[#F1F5F9] dark:border-[#1F2937]">

              {/* Panel header */}
              <div className="px-6 py-4 flex items-center justify-between border-b border-[#F1F5F9] dark:border-[#1F2937]">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: selectedDoc.file_type === 'pdf' ? 'rgba(239,68,68,0.12)' : 'rgba(59,130,246,0.12)' }}>
                    <i className="ti ti-file-text" style={{ fontSize: 16, color: selectedDoc.file_type === 'pdf' ? '#EF4444' : '#3B82F6' }} aria-hidden="true"></i>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#0F172A] dark:text-[#F1F5F9] truncate">{selectedDoc.original_name}</p>
                    <p className="text-caption text-[#94A3B8]">
                      {(selectedDoc.file_size / 1024).toFixed(0)} KB · {selectedDoc.chunk_count} chunks · {selectedDoc.file_type.toUpperCase()}
                    </p>
                  </div>
                </div>
                <button onClick={() => setSelectedDoc(null)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-[#1F2937] transition-colors flex-shrink-0 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                  <i className="ti ti-x" style={{ fontSize: 14 }} aria-hidden="true"></i>
                </button>
              </div>

              {/* Tabs */}
              <div className="flex px-6 py-0 border-b border-[#F1F5F9] dark:border-[#1F2937]">
                {[
                  { id: 'summary', label: 'Summary', icon: 'ti-file-description' },
                  { id: 'formulas', label: 'Formulas', icon: 'ti-math-function' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => { setActiveTab(tab.id); tab.id === 'summary' ? handleGetSummary() : handleGetFormulas() }}
                    className="flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px"
                    style={{
                      color: activeTab === tab.id ? '#6366F1' : '#94A3B8',
                      borderBottomColor: activeTab === tab.id ? '#6366F1' : 'transparent',
                    }}
                  >
                    <i className={`ti ${tab.icon}`} style={{ fontSize: 15 }} aria-hidden="true"></i>
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="px-6 py-3 flex flex-wrap gap-2 border-b border-[#F1F5F9] dark:border-[#1F2937]">
                <button
                  onClick={() => navigate('/chat', { state: { documentId: selectedDoc.id } })}
                  className="btn-secondary text-xs py-2 px-3">
                  <i className="ti ti-message-circle" style={{ fontSize: 13 }} aria-hidden="true"></i>
                  Ask about this
                </button>
                <button
                  onClick={() => navigate('/quiz', { state: { documentId: selectedDoc.id } })}
                  className="btn-secondary text-xs py-2 px-3">
                  <i className="ti ti-pencil" style={{ fontSize: 13 }} aria-hidden="true"></i>
                  Quiz from this
                </button>
                <button
                  onClick={() => navigate('/flashcards', { state: { documentId: selectedDoc.id } })}
                  className="btn-secondary text-xs py-2 px-3">
                  <i className="ti ti-cards" style={{ fontSize: 13 }} aria-hidden="true"></i>
                  Cards from this
                </button>
              </div>

              {/* Panel content */}
              <div className="flex-1 overflow-y-auto p-6">
                {activeTab === 'summary' && (
                  <div>
                    {loadingSummary ? (
                      <div className="flex flex-col items-center py-16">
                        <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-3" />
                        <p className="text-sm text-slate-500">Generating summary with AI...</p>
                      </div>
                    ) : docSummary ? (
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <span className="badge badge-green">AI Generated</span>
                          <button
                            onClick={() => exportSummaryPDF({ summary: docSummary, documentName: selectedDoc.original_name })}
                            className="btn-secondary text-xs py-1.5 px-3">
                            <i className="ti ti-download" style={{ fontSize: 13 }} aria-hidden="true"></i>
                            Export PDF
                          </button>
                        </div>
                        <div className="text-sm leading-relaxed whitespace-pre-wrap text-[#374151] dark:text-[#CBD5E1]">
                          {docSummary}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center py-16 text-center">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 bg-[#EEF2FF] dark:bg-indigo-500/15">
                          <i className="ti ti-file-description" style={{ fontSize: 22, color: '#6366F1' }} aria-hidden="true"></i>
                        </div>
                        <p className="text-sm font-medium text-[#0F172A] dark:text-[#F1F5F9] mb-1">No summary yet</p>
                        <p className="text-caption mb-4 text-[#94A3B8]">Generate an AI summary of this document</p>
                        <button onClick={handleGetSummary} className="btn-primary text-sm">
                          <i className="ti ti-sparkles" style={{ fontSize: 15 }} aria-hidden="true"></i>
                          Generate summary
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'formulas' && (
                  <div>
                    {loadingFormulas ? (
                      <div className="flex flex-col items-center py-16">
                        <div className="w-8 h-8 border-2 border-cyan-200 border-t-cyan-600 rounded-full animate-spin mb-3" />
                        <p className="text-sm text-slate-500">Extracting formulas with AI...</p>
                      </div>
                    ) : docFormulas ? (
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <span className="badge badge-amber">Formula sheet</span>
                          <button
                            onClick={() => exportFormulaSheetPDF({ formulas: docFormulas, documentName: selectedDoc.original_name })}
                            className="btn-secondary text-xs py-1.5 px-3">
                            <i className="ti ti-download" style={{ fontSize: 13 }} aria-hidden="true"></i>
                            Export PDF
                          </button>
                        </div>
                        <div className="text-sm leading-relaxed whitespace-pre-wrap font-mono text-[#374151] dark:text-[#CBD5E1]"
                          style={{ fontSize: 13 }}>
                          {docFormulas}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center py-16 text-center">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 bg-[#ECFEFF] dark:bg-cyan-500/15">
                          <i className="ti ti-math-function" style={{ fontSize: 22, color: '#22D3EE' }} aria-hidden="true"></i>
                        </div>
                        <p className="text-sm font-medium text-[#0F172A] dark:text-[#F1F5F9] mb-1">No formula sheet yet</p>
                        <p className="text-caption mb-4 text-[#94A3B8]">Extract all formulas from this document</p>
                        <button onClick={handleGetFormulas} className="btn-primary text-sm">
                          <i className="ti ti-sparkles" style={{ fontSize: 15 }} aria-hidden="true"></i>
                          Extract formulas
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
