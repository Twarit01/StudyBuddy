import client from './client'

export const generateQuiz = async (topic, quizType, difficulty, count, documentId = null) => {
  const res = await client.post('/quiz/generate', {
    topic,
    quiz_type: quizType,
    difficulty,
    count,
    document_id: documentId,
  })
  return res.data
}

export const evaluateAnswer = async (question, studentAnswer, expectedAnswer, keyPoints = []) => {
  const res = await client.post('/quiz/evaluate-answer', {
    question,
    student_answer: studentAnswer,
    expected_answer: expectedAnswer,
    key_points: keyPoints,
  })
  return res.data
}

export const submitQuiz = async (data) => {
  const res = await client.post('/quiz/submit', data)
  return res.data
}

export const getQuizHistory = async () => {
  const res = await client.get('/quiz/history')
  return res.data
}

export const getQuizAttempt = async (attemptId) => {
  const res = await client.get(`/quiz/history/${attemptId}`)
  return res.data
}