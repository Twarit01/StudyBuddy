import client from './client'

export const askQuestion = async (question, sessionId = null, documentId = null) => {
  const res = await client.post('/chat/ask', {
    question,
    session_id: sessionId,
    document_id: documentId,
  })
  return res.data
}

export const getSessions = async () => {
  const res = await client.get('/chat/sessions')
  return res.data
}

export const getSessionMessages = async (sessionId) => {
  const res = await client.get(`/chat/sessions/${sessionId}/messages`)
  return res.data
}

export const deleteSession = async (sessionId) => {
  const res = await client.delete(`/chat/sessions/${sessionId}`)
  return res.data
}