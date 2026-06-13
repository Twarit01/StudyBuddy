import { useState, useEffect, useCallback } from 'react'
import { listDocuments, uploadDocument, deleteDocument } from '../api/documents'

export function useDocuments() {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState(null)

  // Fetch all documents
  const fetchDocuments = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listDocuments()
      setDocuments(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to fetch documents')
    } finally {
      setLoading(false)
    }
  }, [])

  // Upload a file
  const upload = useCallback(async (file) => {
    setUploading(true)
    setUploadProgress(0)
    setError(null)
    try {
      const data = await uploadDocument(file, null, (pct) => {
        setUploadProgress(pct)
      })
      // Add new document to list
      setDocuments((prev) => [data, ...prev])
      return data
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to upload document')
      throw err
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
    }, [])
  // Delete a document
  const remove = useCallback(async (documentId) => {
    setError(null)
    try {
      await deleteDocument(documentId)
      setDocuments((prev) => prev.filter((d) => d.id !== documentId))
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete document')
      throw err
    }
  }, [])

  // Load on mount
  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  return {
    documents,
    loading,
    uploading,
    uploadProgress,
    error,
    fetchDocuments,
    upload,
    remove,
  }
}