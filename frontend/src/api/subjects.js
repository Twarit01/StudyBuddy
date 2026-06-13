import client from './client'

export const createSubject = async (name, color, emoji) => {
  const res = await client.post('/subjects/', { name, color, emoji })
  return res.data
}

export const listSubjects = async () => {
  const res = await client.get('/subjects/')
  return res.data
}

export const getSubjectDocuments = async (subjectId) => {
  const res = await client.get(`/subjects/${subjectId}/documents`)
  return res.data
}

export const getSubjectOverview = async (subjectId) => {
  const res = await client.post(`/subjects/${subjectId}/overview`)
  return res.data
}

export const updateSubject = async (subjectId, data) => {
  const res = await client.put(`/subjects/${subjectId}`, data)
  return res.data
}

export const deleteSubject = async (subjectId) => {
  const res = await client.delete(`/subjects/${subjectId}`)
  return res.data
}