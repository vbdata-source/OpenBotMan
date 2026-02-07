/**
 * API client with authentication
 */

// API Key from localStorage or default
export function getApiKey(): string {
  return localStorage.getItem('openbotman-api-key') || 'local-dev-key'
}

export function setApiKey(key: string) {
  localStorage.setItem('openbotman-api-key', key)
}

// Fetch with auth header and cache-busting
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const apiKey = getApiKey()
  
  // Add cache-buster for GET requests to prevent 304 Not Modified
  const separator = path.includes('?') ? '&' : '?'
  const urlWithCacheBuster = options.method === 'POST' ? path : `${path}${separator}_t=${Date.now()}`
  
  return fetch(urlWithCacheBuster, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    },
  })
}

// Typed API calls
export async function fetchTeams() {
  const res = await apiFetch('/api/v1/teams')
  if (!res.ok) throw new Error('Failed to fetch teams')
  return res.json()
}

export async function fetchJobs() {
  const res = await apiFetch('/api/v1/jobs')
  if (!res.ok) throw new Error('Failed to fetch jobs')
  return res.json()
}

export async function fetchJob(jobId: string) {
  // Use verbose=true to get full agent responses
  const res = await apiFetch(`/api/v1/jobs/${jobId}?verbose=true`)
  if (!res.ok) throw new Error('Failed to fetch job')
  return res.json()
}

export async function startDiscussion(topic: string, team?: string) {
  const res = await apiFetch('/api/v1/discuss', {
    method: 'POST',
    body: JSON.stringify({ topic, team, async: true }),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.message || 'Failed to start discussion')
  }
  return res.json()
}

export async function cancelJob(jobId: string) {
  const res = await apiFetch(`/api/v1/jobs/${jobId}/cancel`, {
    method: 'POST',
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.message || 'Failed to cancel job')
  }
  return res.json()
}

export async function deleteJob(jobId: string) {
  const res = await apiFetch(`/api/v1/jobs/${jobId}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.message || 'Failed to delete job')
  }
  return res.json()
}
