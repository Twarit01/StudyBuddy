import client from './client'

export const getStudyPlan = async () => {
  const res = await client.post('/progress/study-plan')
  return res.data
}