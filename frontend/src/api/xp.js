import client from './client'

/**
 * Get the current user's XP summary — total XP, level, progress to
 * next level, current/longest streak, and recent XP events.
 */
export const getXPSummary = async () => {
  const { data } = await client.get('/xp/summary')
  return data
}