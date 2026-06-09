import client from './client'

export const generateFlashcards = async (topic = null, count = 10, documentId = null) => {
  const res = await client.post('/flashcards/generate', {
    topic,
    count,
    document_id: documentId,
  })
  return res.data
}

export const getAllFlashcards = async () => {
  const res = await client.get('/flashcards/')
  return res.data
}

export const getDueFlashcards = async () => {
  const res = await client.get('/flashcards/due')
  return res.data
}

export const reviewFlashcard = async (cardId, quality) => {
  const res = await client.post(`/flashcards/${cardId}/review`, { quality })
  return res.data
}

export const getFlashcardStats = async () => {
  const res = await client.get('/flashcards/stats')
  return res.data
}

export const deleteFlashcard = async (cardId) => {
  const res = await client.delete(`/flashcards/${cardId}`)
  return res.data
}

export const deleteAllFlashcards = async () => {
  const res = await client.delete('/flashcards/')
  return res.data
}