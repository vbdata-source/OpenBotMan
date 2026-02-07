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

// Fetch with auth header
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const apiKey = getApiKey()
  
  return fetch(path, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
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
