import { useState, useEffect } from 'react'
import { listSubjects, createSubject, deleteSubject, getSubjectOverview } from '../api/subjects'
import { listDocuments, uploadDocument, deleteDocument, assignSubject, getDocumentSummary, regenerateSummary, generateFormulaSheet, getFormulaSheet } from '../api/documents'
import { exportFormulaSheetPDF, exportSummaryPDF } from '../utils/exportPDF'
import FileUpload from '../components/FileUpload'

const SUBJECT_COLORS = [
  '#7c6af7', '#5de0b0', '#f7a84a', '#f76ab4',
  '#60a5fa', '#f87171', '#34d399', '#a78bfa'
]

const SUBJECT_EMOJIS = ['📚', '💻', '⚡', '🔬', '📐', '🧮', '🌊', '⚙️', '📊', '🧪']

export default function Documents() {
  const [subjects, setSubjects]             = useState([])
  const [documents, setDocuments]           = useState([])
  const [activeSubject, setActiveSubject]   = useState(null) // null = all docs
  const [loading, setLoading]               = useState(false)
  const [uploading, setUploading]           = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  // Subject creation
  const [showNewSubject, setShowNewSubject] = useState(false)
  const [newSubject, setNewSubject]         = useState({ name: '', color: '#7c6af7', emoji: '📚' })

  // Document detail panel
  const [selectedDoc, setSelectedDoc]       = useState(null)
  const [docSummary, setDocSummary]         = useState(null)
  const [docFormulas, setDocFormulas]       = useState(null)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [loadingFormulas, setLoadingFormulas] = useState(false)

  // Subject overview
  const [subjectOverview, setSubjectOverview]   = useState(null)
  const [loadingOverview, setLoadingOverview]   = useState(false)

  useEffect(() => {
    fetchSubjects()
    fetchDocuments()
  }, [])

  useEffect(() => {
    fetchDocuments(activeSubject)
  }, [activeSubject])

  const fetchSubjects = async () => {
    try {
      const data = await listSubjects()
      setSubjects(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('fetchSubjects error:', err)
      setSubjects([])
    }
  }

  const fetchDocuments = async (subjectId = null) => {
    setLoading(true)
    try {
      const data = await listDocuments(subjectId)
      setDocuments(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('fetchDocuments error:', err)
      setDocuments([])
    }
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
      setNewSubject({ name: '', color: '#7c6af7', emoji: '📚' })
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
    setDocFormulas(null)
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
    <div className="flex h-full overflow-hidden bg-gray-50 dark:bg-[#0f0f13] transition-colors">

      {/* Left — Subject list */}
      <div className="w-52 flex-shrink-0 bg-white dark:bg-[#18181f] border-r border-gray-200 dark:border-[#222230] flex flex-col overflow-hidden">

        <div className="p-3 border-b border-gray-200 dark:border-[#222230]">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Subjects</h2>
          <button
            onClick={() => setShowNewSubject(true)}
            className="w-full bg-[#7c6af7] hover:bg-[#6b5ce7] text-white text-xs font-medium rounded-lg py-2 transition-colors"
          >
            + New Subject
          </button>
        </div>

        {/* New subject form */}
        {showNewSubject && (
          <div className="p-3 border-b border-gray-200 dark:border-[#222230] bg-gray-50 dark:bg-[#222230]">
            <input
              type="text"
              value={newSubject.name}
              onChange={e => setNewSubject({ ...newSubject, name: e.target.value })}
              placeholder="Subject name"
              className="w-full bg-white dark:bg-[#18181f] border border-gray-200 dark:border-[#333344] rounded-lg px-2.5 py-1.5 text-xs text-gray-900 dark:text-white outline-none focus:border-[#7c6af7] mb-2"
              onKeyDown={e => e.key === 'Enter' && handleCreateSubject()}
              autoFocus
            />
            <div className="flex gap-1 flex-wrap mb-2">
              {SUBJECT_EMOJIS.map(em => (
                <button
                  key={em}
                  onClick={() => setNewSubject({ ...newSubject, emoji: em })}
                  className={`text-sm p-1 rounded transition-colors ${newSubject.emoji === em ? 'bg-[#7c6af7]/20' : 'hover:bg-gray-100 dark:hover:bg-[#333344]'}`}
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
                  className={`w-5 h-5 rounded-full transition-transform ${newSubject.color === color ? 'scale-125 ring-2 ring-white' : ''}`}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={handleCreateSubject} className="flex-1 bg-[#7c6af7] text-white text-xs rounded-lg py-1.5 hover:bg-[#6b5ce7]">Create</button>
              <button onClick={() => setShowNewSubject(false)} className="flex-1 bg-gray-200 dark:bg-[#333344] text-gray-600 dark:text-gray-300 text-xs rounded-lg py-1.5">Cancel</button>
            </div>
          </div>
        )}

        {/* Subject list */}
        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5">
          {/* All documents */}
          <button
            onClick={() => setActiveSubject(null)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm w-full text-left transition-colors
              ${activeSubject === null
                ? 'bg-[#7c6af7]/15 text-[#7c6af7]'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#222230]'}`}
          >
            <span>📁</span>
            <span className="flex-1 text-xs font-medium">All Documents</span>
            <span className="text-[10px]">{documents.length}</span>
          </button>

          {subjects.map(s => (
            <div key={s.id} className="group relative">
              <button
                onClick={() => setActiveSubject(s.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm w-full text-left transition-colors
                  ${activeSubject === s.id
                    ? 'bg-[#7c6af7]/15 text-[#7c6af7]'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#222230]'}`}
              >
                <span style={{ color: s.color }}>{s.emoji}</span>
                <span className="flex-1 text-xs font-medium truncate">{s.name}</span>
                <span className="text-[10px] text-gray-400">{s.doc_count}</span>
              </button>
              <button
                onClick={() => handleDeleteSubject(s.id)}
                className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 text-xs transition-all"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Middle — Document list */}
      <div className="w-72 flex-shrink-0 border-r border-gray-200 dark:border-[#222230] flex flex-col overflow-hidden bg-white dark:bg-[#18181f]">

        <div className="p-3 border-b border-gray-200 dark:border-[#222230]">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              {activeSubjectData ? `${activeSubjectData.emoji} ${activeSubjectData.name}` : 'All Documents'}
            </h2>
            {activeSubject && (
              <button
                onClick={handleSubjectOverview}
                disabled={loadingOverview}
                className="text-xs text-[#7c6af7] hover:underline"
              >
                {loadingOverview ? 'Loading...' : 'AI Overview'}
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
          <div className="p-3 border-b border-gray-200 dark:border-[#222230] bg-[#7c6af7]/5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-[#7c6af7]">✨ Subject Overview</span>
              <button onClick={() => setSubjectOverview(null)} className="text-xs text-gray-400">✕</button>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-3">{subjectOverview.overview}</p>
          </div>
        )}

        {/* Documents */}
        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-[#7c6af7] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-400">No documents yet</p>
              <p className="text-xs text-gray-400 mt-1">Upload a file above</p>
            </div>
          ) : documents.map(doc => (
            <div
              key={doc.id}
              onClick={() => handleSelectDoc(doc)}
              className={`p-3 rounded-lg cursor-pointer transition-colors border group
                ${selectedDoc?.id === doc.id
                  ? 'bg-[#7c6af7]/10 border-[#7c6af7]/30'
                  : 'bg-gray-50 dark:bg-[#222230] border-transparent hover:border-gray-200 dark:hover:border-[#333344]'}`}
            >
              <div className="flex items-start gap-2">
                <span className="text-base flex-shrink-0">
                  {doc.file_type === 'pdf' ? '📕' : doc.file_type === 'docx' ? '📘' : '📄'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{doc.original_name}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {doc.chunk_count} chunks · {(doc.file_size / 1024).toFixed(0)}KB
                  </p>
                  <div className="flex gap-1 mt-1">
                    {doc.summary && <span className="text-[9px] bg-[#5de0b0]/20 text-[#5de0b0] px-1.5 py-0.5 rounded-full">Summary</span>}
                    {doc.formula_sheet && <span className="text-[9px] bg-[#f7a84a]/20 text-[#f7a84a] px-1.5 py-0.5 rounded-full">Formulas</span>}
                  </div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); handleDeleteDocument(doc.id) }}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 text-xs transition-all flex-shrink-0"
                >
                  ✕
                </button>
              </div>

              {/* Subject selector */}
              {activeSubject === null && (
                <select
                  value={doc.subject_id || ''}
                  onChange={e => { e.stopPropagation(); handleAssignSubject(doc.id, e.target.value) }}
                  onClick={e => e.stopPropagation()}
                  className="mt-2 w-full bg-white dark:bg-[#18181f] border border-gray-200 dark:border-[#333344] rounded px-2 py-1 text-[10px] text-gray-600 dark:text-gray-400 outline-none"
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
            <div className="text-4xl mb-3">📄</div>
            <p className="text-sm text-gray-500">Select a document to view details</p>
            <p className="text-xs text-gray-400 mt-1">Summary, formula sheet, and more</p>
          </div>
        ) : (
          <div className="h-full overflow-y-auto p-6">

            {/* Doc header */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                <span className="text-3xl">
                  {selectedDoc.file_type === 'pdf' ? '📕' : selectedDoc.file_type === 'docx' ? '📘' : '📄'}
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{selectedDoc.original_name}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
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
                className="flex items-center gap-2 bg-[#5de0b0]/10 hover:bg-[#5de0b0]/20 border border-[#5de0b0]/30 text-[#5de0b0] text-sm font-medium rounded-xl px-4 py-2.5 transition-colors"
              >
                {loadingSummary ? (
                  <><div className="w-4 h-4 border-2 border-[#5de0b0]/30 border-t-[#5de0b0] rounded-full animate-spin" />Generating...</>
                ) : '📋 View Summary'}
              </button>

              <button
                onClick={handleGetFormulas}
                disabled={loadingFormulas}
                className="flex items-center gap-2 bg-[#f7a84a]/10 hover:bg-[#f7a84a]/20 border border-[#f7a84a]/30 text-[#f7a84a] text-sm font-medium rounded-xl px-4 py-2.5 transition-colors"
              >
                {loadingFormulas ? (
                  <><div className="w-4 h-4 border-2 border-[#f7a84a]/30 border-t-[#f7a84a] rounded-full animate-spin" />Generating...</>
                ) : '🧮 Formula Sheet'}
              </button>

              {docSummary && (
                <button
                  onClick={() => exportSummaryPDF({ summary: docSummary, documentName: selectedDoc.original_name })}
                  className="flex items-center gap-2 bg-white dark:bg-[#18181f] border border-gray-200 dark:border-[#222230] text-gray-600 dark:text-gray-300 text-sm font-medium rounded-xl px-4 py-2.5 transition-colors hover:border-[#7c6af7]"
                >
                  📥 Export Summary
                </button>
              )}

              {docFormulas && (
                <button
                  onClick={() => exportFormulaSheetPDF({ formulas: docFormulas, documentName: selectedDoc.original_name })}
                  className="flex items-center gap-2 bg-white dark:bg-[#18181f] border border-gray-200 dark:border-[#222230] text-gray-600 dark:text-gray-300 text-sm font-medium rounded-xl px-4 py-2.5 transition-colors hover:border-[#7c6af7]"
                >
                  📥 Export Formulas
                </button>
              )}
            </div>

            {/* Summary display */}
            {docSummary && (
              <div className="bg-white dark:bg-[#18181f] border border-gray-200 dark:border-[#222230] rounded-xl p-5 mb-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  📋 Document Summary
                </h3>
                <div className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">
                  {docSummary}
                </div>
              </div>
            )}

            {/* Formula sheet display */}
            {docFormulas && (
              <div className="bg-white dark:bg-[#18181f] border border-gray-200 dark:border-[#222230] rounded-xl p-5 mb-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  🧮 Formula Sheet
                </h3>
                <div className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap font-mono">
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