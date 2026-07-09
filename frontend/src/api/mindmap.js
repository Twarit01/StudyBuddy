import client from './client'

/**
 * Generate a concept mind map from one or more document IDs.
 * @param {number[]} documentIds  - Array of processed document IDs (max 5)
 * @returns {Promise<{nodes: Array, edges: Array}>}
 */
export const generateMindMap = async (documentIds) => {
  const res = await client.post('/mindmap/generate', { document_ids: documentIds })
  return res.data
}
