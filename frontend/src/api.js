// Tiny fetch wrapper that auto-attaches the JWT and parses JSON.

const BASE = import.meta.env.VITE_API_BASE || ''

export function getToken() {
  return localStorage.getItem('nutritrack.token')
}

export function setToken(token) {
  if (token) localStorage.setItem('nutritrack.token', token)
  else localStorage.removeItem('nutritrack.token')
}

async function request(path, { method = 'GET', body, isForm = false } = {}) {
  const headers = {}
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (!isForm && body !== undefined) headers['Content-Type'] = 'application/json'

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 204) return null
  const text = await res.text()
  const data = text ? JSON.parse(text) : null

  if (!res.ok) {
    const detail = data?.detail || res.statusText || 'Request failed'
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail))
  }
  return data
}

export const api = {
  signup: (payload) => request('/api/auth/signup', { method: 'POST', body: payload }),
  login: (payload) => request('/api/auth/login', { method: 'POST', body: payload }),
  me: () => request('/api/auth/me'),

  listEntries: (date) => request(`/api/foods${date ? `?date=${date}` : ''}`),
  createEntry: (entry) => request('/api/foods', { method: 'POST', body: entry }),
  deleteEntry: (id) => request(`/api/foods/${id}`, { method: 'DELETE' }),
  dashboard: () => request('/api/foods/dashboard'),

  listRecipes: (favoritesOnly = false) =>
    request(`/api/recipes${favoritesOnly ? '?favorites_only=true' : ''}`),
  createRecipe: (recipe) => request('/api/recipes', { method: 'POST', body: recipe }),
  updateRecipe: (id, recipe) => request(`/api/recipes/${id}`, { method: 'PATCH', body: recipe }),
  deleteRecipe: (id) => request(`/api/recipes/${id}`, { method: 'DELETE' }),
  logRecipe: (id, servings) =>
    request(`/api/recipes/${id}/log${servings != null ? `?servings=${servings}` : ''}`, { method: 'POST' }),

  chat: (message, history = []) =>
    request('/api/chat', { method: 'POST', body: { message, history } }),
  chatHistory: () => request('/api/chat/history'),

  barcodeLookup: (code) => request(`/api/lookup/barcode/${encodeURIComponent(code)}`),
  photoLookup: (file) => {
    const form = new FormData()
    form.append('file', file)
    return request('/api/lookup/photo', { method: 'POST', body: form, isForm: true })
  },
}
