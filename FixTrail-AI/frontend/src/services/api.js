
const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export async function apiRequest(path, options = {}) {
  const token = localStorage.getItem('fixtrail_token');

  const headers = {
    ...options.headers,
  };

  // Set JSON content type only for JSON requests.
  // FormData must set its own multipart boundary.
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.detail || 'Something went wrong');
  }

  return data;
}

// Login
export async function login(email, password) {
  const formData = new URLSearchParams();

  formData.append('username', email);
  formData.append('password', password);

  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || 'Login failed');
  }

  localStorage.setItem('fixtrail_token', data.access_token);
  localStorage.setItem('fixtrail_user', JSON.stringify(data.user));

  return data.user;
}

// Register
export async function register(userData) {
  return apiRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(userData),
  });
}

// Upload repair image
export async function uploadRepairImage(repairId, file, imageType) {
  const formData = new FormData();
  formData.append('image', file);

  return apiRequest(
    `/api/repairs/${repairId}/images?image_type=${encodeURIComponent(imageType)}`,
    {
      method: 'POST',
      body: formData,
    }
  );
}

// Get repair images
export async function getRepairImages(repairId) {
  return apiRequest(`/api/repairs/${repairId}/images`);
}

// Get repair estimates
export async function getRepairEstimates(repairId) {
  return apiRequest(`/api/repairs/${repairId}/estimates`);
}

// Select technician estimate
export async function selectRepairEstimate(repairId, estimateId) {
  return apiRequest(
    `/api/repairs/${repairId}/estimates/${estimateId}/select`,
    {
      method: 'POST',
    }
  );
}

// Submit review
export async function submitReview(repairId, review) {
  return apiRequest(`/api/repairs/${repairId}/review`, {
    method: 'POST',
    body: JSON.stringify(review),
  });
}

// Get technician reviews
export async function getTechnicianReviews(technicianId) {
  return apiRequest(
    `/api/repairs/technicians/${technicianId}/reviews`
  );
}

// Get image URL
export function getImageUrl(filePath) {
  const safePath = filePath.replace(/\\/g, '/');
  return `${API_URL}/${safePath}`;
}

// Logout
export function logout() {
  localStorage.removeItem('fixtrail_token');
  localStorage.removeItem('fixtrail_user');
}

// Get customer repair passports
export async function getMyPassports() {
  return apiRequest('/api/passports/my');
}

// Get a specific repair passport
export async function getPassport(passportNumber) {
  return apiRequest(
    `/api/passports/${encodeURIComponent(passportNumber)}`
  );
}

// AI visual repair verification
export async function verifyRepair(repairId) {
  return apiRequest(
    `/api/verification/repairs/${repairId}/verify`,
    {
      method: 'POST',
    }
  );
}

// AI damage image description
export async function describeDamageImage(file) {
  const formData = new FormData();

  formData.append('image', file);

  return apiRequest('/api/verification/describe-damage', {
    method: 'POST',
    body: formData,
  });
}
