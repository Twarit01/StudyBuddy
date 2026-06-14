import { useState, useEffect } from 'react'
import { listSubjects, createSubject, deleteSubject, getSubjectOverview } from '../api/subjects'
import { listDocuments, uploadDocument, deleteDocument, assignSubject, regenerateSummary, generateFormulaSheet } from '../api/documents'
import { exportFormulaSheetPDF, exportSummaryPDF } from '../utils/exportPDF'
import FileUpload from '../components/FileUpload'

const SUBJECT_COLORS = [
  '#8b5cf6', '#10b981', '#f59e0b', '#ec4899',
  '#3b82f6', '#ef4444', '#14b8a6', '#a855f7'
]

const SUBJECT_EMOJIS = ['📚', '💻', '⚡', '🔬', '📐', '🧮', '🌊', '⚙️', '📊', '🧪']

export default function Documents() {
  const [subjects, setSubjects]             = useState([])
  const [documents, setDocuments]           = useState([])
  const [activeSubject, setActiveSubject]   = useState(null)
  const [loading, setLoading]               = useState(false)
  const [uploading, setUploading]           = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  const [showNewSubject, setShowNewSubject] = useState(false)
  const [newSubject, setNewSubject]         = useState({ name: '', color: '#8b5cf6', emoji: '📚' })

  const [selectedDoc, setSelectedDoc]       = useState(null)
  const [docSummary, setDocSummary]         = useState(null)
  const [docFormulas, setDocFormulas]       = useState(null)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [loadingFormulas, setLoadingFormulas] = useState(false)

  const [subjectOverview, setSubjectOverview]   = useState(null)
  const [loadingOverview, setLoadingOverview]   = useState(false)

  useEffect(() => {
    fetchSubjects()
    fetchDocuments()
  }, [])

  useEffect(() => {
    fetchDocuments(activeSubject)
    setSubjectOverview(null)
  }, [activeSubject])

  const fetchSubjects = async () => {
    try {
      const data = await listSubjects()
      setSubjects(Array.isArray(data) ? data : [])
    } catch (err) { console.error(err); setSubjects([]) }
  }

  const fetchDocuments = async (subjectId = null) => {
    setLoading(true)
    try {
      const data = await listDocuments(subjectId)
      setDocuments(Array.isArray(data) ? data : [])
    } catch (err) { console.error(err); setDocuments([]) }
    finally { setLoading(false) }
  }

  const handleUpload = async (file) => {
    setUploading(true)
    setUploadProgress(0)
    try {
      await uploadDocument(file, activeSubject, (pct) => setUploadProgress(pct))
      fetchDocuments(activeSubject)
      fetchSubjects()
    } catch (err) {
      console.error(err)
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const handleCreateSubject = async () => {
    if (!newSubject.name.trim()) return
    try {
      await createSubject(newSubject.name, newSubject.color, newSubject.emoji)
      await fetchSubjects()
      setShowNewSubject(false)
      setNewSubject({ name: '', color: '#8b5cf6', emoji: '📚' })
    } catch (err) { console.error(err) }
  }

  const handleDeleteSubject = async (subjectId) => {
    if (!window.confirm('Delete this subject? Documents will move to uncategorized.')) return
    try {
      await deleteSubject(subjectId)
      await fetchSubjects()
      if (activeSubject === subjectId) setActiveSubject(null)
    } catch (err) { console.error(err) }
  }

  const handleDeleteDocument = async (docId) => {
    try {
      await deleteDocument(docId)
      setDocuments(prev => prev.filter(d => d.id !== docId))
      if (selectedDoc?.id === docId) setSelectedDoc(null)
      fetchSubjects()
    } catch (err) { console.error(err) }
  }

  const handleSelectDoc = async (doc) => {
    setSelectedDoc(doc)
    setDocSummary(doc.summary || null)
    setDocFormulas(doc.formula_sheet || null)
  }

  const handleGetSummary = async () => {
    if (!selectedDoc) return
    setLoadingSummary(true)
    try {
      if (selectedDoc.summary) {
        setDocSummary(selectedDoc.summary)
      } else {
        const data = await regenerateSummary(selectedDoc.id)
        setDocSummary(data.summary)
        setDocuments(prev => prev.map(d =>
          d.id === selectedDoc.id ? { ...d, summary: data.summary } : d
        ))
      }
    } catch (err) { console.error(err) }
    finally { setLoadingSummary(false) }
  }

  const handleGetFormulas = async () => {
    if (!selectedDoc) return
    setLoadingFormulas(true)
    try {
      const data = await generateFormulaSheet(selectedDoc.id)
      setDocFormulas(data.formula_sheet)
      setDocuments(prev => prev.map(d =>
        d.id === selectedDoc.id ? { ...d, formula_sheet: data.formula_sheet } : d
      ))
    } catch (err) { console.error(err) }
    finally { setLoadingFormulas(false) }
  }

  const handleSubjectOverview = async () => {
    if (!activeSubject) return
    setLoadingOverview(true)
    try {
      const data = await getSubjectOverview(activeSubject)
      setSubjectOverview(data)
    } catch (err) { console.error(err) }
    finally { setLoadingOverview(false) }
  }

  const handleAssignSubject = async (docId, subjectId) => {
    try {
      await assignSubject(docId, subjectId || null)
      fetchDocuments(activeSubject)
      fetchSubjects()
    } catch (err) { console.error(err) }
  }

  const activeSubjectData = subjects.find(s => s.id === activeSubject)

  return (
    <div className="flex h-full overflow-hidden bg-surface-muted dark:bg-[#0F172A] transition-colors duration-200">

      {/* Left — Subject list */}
      <div className="w-56 flex-shrink-0 bg-white dark:bg-[#1E293B] border-r border-surface-border dark:border-[#334155] flex flex-col overflow-hidden">

        <div className="p-4 border-b border-surface-border dark:border-[#334155]">
          <h2 className="text-sm font-semibold text-ink-900 dark:text-white mb-3">Subjects</h2>
          <button
            onClick={() => setShowNewSubject(true)}
            className="w-full bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium rounded-xl py-2.5 transition-colors flex items-center justify-center gap-1.5"
          >
            <i className="ti ti-plus" style={{ fontSize: 14 }} aria-hidden="true"></i>
            New subject
          </button>
        </div>

        {/* New subject form */}
        {showNewSubject && (
          <div className="p-3 border-b border-surface-border dark:border-[#334155] bg-surface-muted dark:bg-[#1E293B]">
            <input
              type="text"
              value={newSubject.name}
              onChange={e => setNewSubject({ ...newSubject, name: e.target.value })}
              placeholder="Subject name"
              className="w-full bg-white dark:bg-[#1E293B] border border-surface-border dark:border-[#334155] rounded-lg px-2.5 py-1.5 text-xs text-ink-900 dark:text-white outline-none focus:border-primary-400 mb-2"
              onKeyDown={e => e.key === 'Enter' && handleCreateSubject()}
              autoFocus
            />
            <div className="flex gap-1 flex-wrap mb-2">
              {SUBJECT_EMOJIS.map(em => (
                <button
                  key={em}
                  onClick={() => setNewSubject({ ...newSubject, emoji: em })}
                  className={`text-sm p-1 rounded transition-colors ${newSubject.emoji === em ? 'bg-primary-100 dark:bg-primary-600/20' : 'hover:bg-surface-border dark:hover:bg-[#334155]'}`}
                >
                  {em}
                </button>
              ))}
            </div>
            <div className="flex gap-1 flex-wrap mb-2">
              {SUBJECT_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => setNewSubject({ ...newSubject, color })}
                  style={{ backgroundColor: color }}
                  className={`w-5 h-5 rounded-full transition-transform ${newSubject.color === color ? 'scale-125 ring-2 ring-white dark:ring-[#1E293B]' : ''}`}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={handleCreateSubject} className="flex-1 bg-primary-600 text-white text-xs rounded-lg py-1.5 hover:bg-primary-700">Create</button>
              <button onClick={() => setShowNewSubject(false)} className="flex-1 bg-surface-border dark:bg-[#334155] text-ink-700 dark:text-gray-300 text-xs rounded-lg py-1.5">Cancel</button>
            </div>
          </div>
        )}

        {/* Subject list */}
        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5">
          <button
            onClick={() => setActiveSubject(null)}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm w-full text-left transition-colors
              ${activeSubject === null
                ? 'bg-primary-50 dark:bg-primary-600/15 text-primary-700 dark:text-primary-300'
                : 'text-ink-500 dark:text-gray-400 hover:bg-surface-muted dark:hover:bg-[#1E293B]'}`}
          >
            <i className="ti ti-folders" style={{ fontSize: 16 }} aria-hidden="true"></i>
            <span className="flex-1 text-xs font-medium">All documents</span>
            <span className="text-[10px]">{documents.length}</span>
          </button>

          {subjects.map(s => (
            <div key={s.id} className="group relative">
              <button
                onClick={() => setActiveSubject(s.id)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm w-full text-left transition-colors
                  ${activeSubject === s.id
                    ? 'bg-primary-50 dark:bg-primary-600/15 text-primary-700 dark:text-primary-300'
                    : 'text-ink-500 dark:text-gray-400 hover:bg-surface-muted dark:hover:bg-[#1E293B]'}`}
              >
                <span>{s.emoji}</span>
                <span className="flex-1 text-xs font-medium truncate">{s.name}</span>
                <span className="text-[10px] text-ink-400">{s.doc_count}</span>
              </button>
              <button
                onClick={() => handleDeleteSubject(s.id)}
                className="absolute right-2 top-2.5 opacity-0 group-hover:opacity-100 text-ink-400 hover:text-red-500 text-xs transition-all"
              >
                <i className="ti ti-x" style={{ fontSize: 12 }} aria-hidden="true"></i>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Middle — Document list */}
      <div className="w-80 flex-shrink-0 border-r border-surface-border dark:border-[#334155] flex flex-col overflow-hidden bg-white dark:bg-[#1E293B]">

        <div className="p-4 border-b border-surface-border dark:border-[#334155]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-ink-900 dark:text-white">
              {activeSubjectData ? `${activeSubjectData.emoji} ${activeSubjectData.name}` : 'All documents'}
            </h2>
            {activeSubject && (
              <button
                onClick={handleSubjectOverview}
                disabled={loadingOverview}
                className="text-xs text-primary-600 dark:text-primary-300 hover:underline flex items-center gap-1"
              >
                {loadingOverview ? '...' : <><i className="ti ti-sparkles" style={{ fontSize: 13 }} aria-hidden="true"></i>AI overview</>}
              </button>
            )}
          </div>
          <FileUpload
            onUpload={handleUpload}
            uploading={uploading}
            uploadProgress={uploadProgress}
          />
        </div>

        {/* Subject overview */}
        {subjectOverview && (
          <div className="p-3 border-b border-surface-border dark:border-[#334155] bg-primary-50 dark:bg-primary-600/10">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-primary-600 dark:text-primary-300 flex items-center gap-1">
                <i className="ti ti-sparkles" style={{ fontSize: 13 }} aria-hidden="true"></i>
                Subject overview
              </span>
              <button onClick={() => setSubjectOverview(null)} className="text-ink-400">
                <i className="ti ti-x" style={{ fontSize: 12 }} aria-hidden="true"></i>
              </button>
            </div>
            <p className="text-xs text-ink-600 dark:text-gray-400 line-clamp-4 whitespace-pre-wrap">{subjectOverview.overview}</p>
          </div>
        )}

        {/* Documents */}
        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-10">
              <i className="ti ti-file-off text-ink-400" style={{ fontSize: 28 }} aria-hidden="true"></i>
              <p className="text-sm text-ink-500 mt-2">No documents yet</p>
              <p className="text-xs text-ink-400 mt-1">Upload a file above</p>
            </div>
          ) : documents.map(doc => (
            <div
              key={doc.id}
              onClick={() => handleSelectDoc(doc)}
              className={`p-3 rounded-xl cursor-pointer transition-colors border group
                ${selectedDoc?.id === doc.id
                  ? 'bg-primary-50 dark:bg-primary-600/10 border-primary-200 dark:border-primary-600/30'
                  : 'bg-surface-muted dark:bg-[#1E293B] border-transparent hover:border-surface-border dark:hover:border-[#334155]'}`}
            >
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500 flex items-center justify-center flex-shrink-0">
                  <i className="ti ti-file-text" style={{ fontSize: 16 }} aria-hidden="true"></i>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-ink-900 dark:text-white truncate">{doc.original_name}</p>
                  <p className="text-[10px] text-ink-400 mt-0.5">
                    {doc.chunk_count} chunks · {(doc.file_size / 1024).toFixed(0)}KB
                  </p>
                  <div className="flex gap-1 mt-1.5">
                    {doc.summary && <span className="text-[9px] bg-emerald-50 dark:bg-emerald-400/15 text-emerald-600 dark:text-emerald-300 px-1.5 py-0.5 rounded-full">Summary</span>}
                    {doc.formula_sheet && <span className="text-[9px] bg-amber-50 dark:bg-amber-400/15 text-amber-600 dark:text-amber-300 px-1.5 py-0.5 rounded-full">Formulas</span>}
                  </div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); handleDeleteDocument(doc.id) }}
                  className="opacity-0 group-hover:opacity-100 text-ink-400 hover:text-red-500 text-xs transition-all flex-shrink-0"
                >
                  <i className="ti ti-x" style={{ fontSize: 12 }} aria-hidden="true"></i>
                </button>
              </div>

              {activeSubject === null && (
                <select
                  value={doc.subject_id || ''}
                  onChange={e => { e.stopPropagation(); handleAssignSubject(doc.id, e.target.value) }}
                  onClick={e => e.stopPropagation()}
                  className="mt-2 w-full bg-white dark:bg-[#1E293B] border border-surface-border dark:border-[#334155] rounded-lg px-2 py-1 text-[10px] text-ink-500 outline-none"
                >
                  <option value="">Uncategorized</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Right — Document detail panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selectedDoc ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary-50 dark:bg-primary-600/15 text-primary-600 dark:text-primary-300 flex items-center justify-center mb-3">
              <i className="ti ti-file-text" style={{ fontSize: 26 }} aria-hidden="true"></i>
            </div>
            <p className="text-sm text-ink-500">Select a document to view details</p>
            <p className="text-xs text-ink-400 mt-1">Summary, formula sheet, and more</p>
          </div>
        ) : (
          <div className="h-full overflow-y-auto p-6">

            {/* Doc header */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-500 flex items-center justify-center flex-shrink-0">
                  <i className="ti ti-file-text" style={{ fontSize: 22 }} aria-hidden="true"></i>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-ink-900 dark:text-white">{selectedDoc.original_name}</h2>
                  <p className="text-xs text-ink-400 mt-0.5">
                    {selectedDoc.chunk_count} chunks · {(selectedDoc.file_size / 1024).toFixed(0)}KB · {selectedDoc.file_type.toUpperCase()}
                  </p>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 mb-6 flex-wrap">
              <button
                onClick={handleGetSummary}
                disabled={loadingSummary}
                className="flex items-center gap-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-300 text-sm font-medium rounded-xl px-4 py-2.5 transition-colors"
              >
                {loadingSummary ? (
                  <><div className="w-4 h-4 border-2 border-emerald-300 border-t-emerald-600 rounded-full animate-spin" />Generating...</>
                ) : <><i className="ti ti-file-description" style={{ fontSize: 16 }} aria-hidden="true"></i>View summary</>}
              </button>

              <button
                onClick={handleGetFormulas}
                disabled={loadingFormulas}
                className="flex items-center gap-2 bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 border border-amber-200 dark:border-amber-500/30 text-amber-600 dark:text-amber-300 text-sm font-medium rounded-xl px-4 py-2.5 transition-colors"
              >
                {loadingFormulas ? (
                  <><div className="w-4 h-4 border-2 border-amber-300 border-t-amber-600 rounded-full animate-spin" />Generating...</>
                ) : <><i className="ti ti-math-function" style={{ fontSize: 16 }} aria-hidden="true"></i>Formula sheet</>}
              </button>

              {docSummary && (
                <button
                  onClick={() => exportSummaryPDF({ summary: docSummary, documentName: selectedDoc.original_name })}
                  className="flex items-center gap-2 bg-white dark:bg-[#1E293B] border border-surface-border dark:border-[#334155] text-ink-700 dark:text-gray-300 text-sm font-medium rounded-xl px-4 py-2.5 transition-colors hover:border-primary-300 shadow-soft"
                >
                  <i className="ti ti-download" style={{ fontSize: 16 }} aria-hidden="true"></i>
                  Export summary
                </button>
              )}

              {docFormulas && (
                <button
                  onClick={() => exportFormulaSheetPDF({ formulas: docFormulas, documentName: selectedDoc.original_name })}
                  className="flex items-center gap-2 bg-white dark:bg-[#1E293B] border border-surface-border dark:border-[#334155] text-ink-700 dark:text-gray-300 text-sm font-medium rounded-xl px-4 py-2.5 transition-colors hover:border-primary-300 shadow-soft"
                >
                  <i className="ti ti-download" style={{ fontSize: 16 }} aria-hidden="true"></i>
                  Export formulas
                </button>
              )}
            </div>

            {/* Summary display */}
            {docSummary && (
              <div className="bg-white dark:bg-[#1E293B] border border-surface-border dark:border-[#334155] rounded-2xl p-5 mb-4 shadow-soft">
                <h3 className="text-sm font-semibold text-ink-900 dark:text-white mb-3 flex items-center gap-2">
                  <i className="ti ti-file-description text-emerald-500" style={{ fontSize: 18 }} aria-hidden="true"></i>
                  Document summary
                </h3>
                <div className="text-sm text-ink-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">
                  {docSummary}
                </div>
              </div>
            )}

            {/* Formula sheet display */}
            {docFormulas && (
              <div className="bg-white dark:bg-[#1E293B] border border-surface-border dark:border-[#334155] rounded-2xl p-5 mb-4 shadow-soft">
                <h3 className="text-sm font-semibold text-ink-900 dark:text-white mb-3 flex items-center gap-2">
                  <i className="ti ti-math-function text-amber-500" style={{ fontSize: 18 }} aria-hidden="true"></i>
                  Formula sheet
                </h3>
                <div className="text-sm text-ink-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap font-mono">
                  {docFormulas}
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  )
}