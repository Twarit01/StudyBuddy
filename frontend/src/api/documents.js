import client from './client'

export const uploadDocument = async (file, onProgress) => {
  const formData = new FormData()
  formData.append('file', file)

  const res = await client.post('/documents/upload', formData, {
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

export const listDocuments = async () => {
  const res = await client.get('/documents/')
  return res.data
}

export const deleteDocument = async (documentId) => {
  const res = await client.delete(`/documents/${documentId}`)
  return res.data
}

export const getDocument = async (documentId) => {
  const res = await client.get(`/documents/${documentId}`)
  return res.data
}