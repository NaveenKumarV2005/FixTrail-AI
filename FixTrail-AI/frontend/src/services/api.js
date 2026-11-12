
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

// Upload a repair image
export async function uploadRepairImage(repairId, file, imageType) {
  const formData = new FormData()
  formData.append('image', file)

  return apiRequest(
    `/api/repairs/${repairId}/images?image_type=${imageType}`,
    {
      method: 'POST',
      body: formData,
    }
  )
}

// Get repair images
export async function getRepairImages(repairId) {
  return apiRequest(`/api/repairs/${repairId}/images`)
}

// Submit customer review
export async function submitReview(repairId, review) {
  return apiRequest(`/api/repairs/${repairId}/review`, {
    method: 'POST',
    body: JSON.stringify(review),
  })
}

// Get technician reviews
export async function getTechnicianReviews(technicianId) {
  return apiRequest(`/api/repairs/technicians/${technicianId}/reviews`)
}

export function getImageUrl(filePath) {
  return `${API_URL}/${filePath.replace(/\\/g, '/')}`
}

export function logout() {
  localStorage.removeItem('fixtrail_token')
  localStorage.removeItem('fixtrail_user')
}
