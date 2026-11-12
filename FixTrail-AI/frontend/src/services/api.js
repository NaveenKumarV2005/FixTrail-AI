
const API_URL = import.meta.env.VITE_API_URL

export async function apiRequest(path, options = {}) {
  const token = localStorage.getItem('fixtrail_token')

  const headers = {
    ...options.headers,
  }

  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.detail || 'Something went wrong')
  }

  return data
}

export async function login(email, password) {
  const formData = new URLSearchParams()

  formData.append('username', email)
  formData.append('password', password)

  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData,
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.detail || 'Login failed')
  }

  localStorage.setItem('fixtrail_token', data.access_token)
  localStorage.setItem('fixtrail_user', JSON.stringify(data.user))

  return data.user
}

export async function register(userData) {
  return apiRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(userData),
  })
}

export function logout() {
  localStorage.removeItem('fixtrail_token')
  localStorage.removeItem('fixtrail_user')
}
