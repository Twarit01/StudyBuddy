import client from './client'

export const uploadDocument = async (file, subjectId = null, onProgress) => {
  const formData = new FormData()
  formData.append('file', file)

  const params = new URLSearchParams()
  if (subjectId) params.append('subject_id', subjectId)
  params.append('generate_summary', 'true')

  const res = await client.post(`/documents/upload?${params}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress) {
        const pct = Math.round((e.loaded * 100) / e.total)
        onProgress(pct)
      }
    },
  })
  return res.data
}

export const listDocuments = async (subjectId = null) => {
  const params = subjectId !== null ? `?subject_id=${subjectId}` : ''
  const res = await client.get(`/documents/${params}`)
  return res.data
}

export const getDocument = async (documentId) => {
  const res = await client.get(`/documents/${documentId}`)
  return res.data
}

export const getDocumentSummary = async (documentId) => {
  const res = await client.get(`/documents/${documentId}/summary`)
  return res.data
}

export const regenerateSummary = async (documentId) => {
  const res = await client.post(`/documents/${documentId}/generate-summary`)
  return res.data
}

export const getFormulaSheet = async (documentId) => {
  const res = await client.get(`/documents/${documentId}/formula-sheet`)
  return res.data
}

export const generateFormulaSheet = async (documentId) => {
  const res = await client.post(`/documents/${documentId}/generate-formula-sheet`)
  return res.data
}

export const assignSubject = async (documentId, subjectId) => {
  const res = await client.patch(`/documents/${documentId}/assign-subject`, {
    subject_id: subjectId
  })
  return res.data
}

export const deleteDocument = async (documentId) => {
  const res = await client.delete(`/documents/${documentId}`)
  return res.data
}