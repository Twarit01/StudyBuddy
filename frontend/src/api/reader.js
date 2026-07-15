import client from './client'

export const getDocumentFileUrl = async (documentId) => {
  const res = await client.get(`/reader/${documentId}/file-url`)
  return res.data  // { file_url: "https://..." | null, source: "cloudinary" | "local" }
}

export const getDocumentFileBlob = async (documentId) => {
  const res = await client.get(`/reader/${documentId}/file`, { responseType: 'blob' })
  return res.data
}

export const getDocumentPages = async (documentId) => {
  const res = await client.get(`/reader/${documentId}/pages`)
  return res.data
}

export const getPageContent = async (documentId, pageNum) => {
  const res = await client.get(`/reader/${documentId}/pages/${pageNum}`)
  return res.data
}

export const getReadingProgress = async (documentId) => {
  const res = await client.get(`/reader/${documentId}/progress`)
  return res.data
}

export const updateReadingProgress = async (documentId, lastPage, totalPages) => {
  const res = await client.patch(`/reader/${documentId}/progress`, {
    last_page: lastPage,
    total_pages: totalPages,
  })
  return res.data
}

export const listAllReadingProgress = async () => {
  const res = await client.get('/reader/progress')
  return res.data
}

export const getReadingStats = async () => {
  const res = await client.get('/reader/stats')
  return res.data
}

export const getDocumentNotes = async (documentId) => {
  const res = await client.get(`/reader/${documentId}/notes`)
  return res.data
}

export const createDocumentNote = async (documentId, data) => {
  const res = await client.post(`/reader/${documentId}/notes`, data)
  return res.data
}

export const deleteDocumentNote = async (noteId) => {
  const res = await client.delete(`/reader/notes/${noteId}`)
  return res.data
}

export const selectionAI = async (documentId, payload) => {
  const res = await client.post(`/reader/${documentId}/selection-ai`, payload)
  return res.data
}
