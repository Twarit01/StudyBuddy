import client from './client'

export const register = async (email, fullName, password) => {
  const res = await client.post('/auth/register', {
    email,
    full_name: fullName,
    password,
  })
  return res.data
}

export const login = async (email, password) => {
  const res = await client.post('/auth/login', { email, password })
  return res.data
}

export const getMe = async () => {
  const res = await client.get('/auth/me')
  return res.data
}