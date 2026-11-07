// Client-side fetch wrapper cho /api/v1-style endpoints của ứng dụng.
export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

export async function api(path, { method = 'GET', body, query } = {}) {
  const qs = query ? '?' + new URLSearchParams(Object.entries(query).filter(([, v]) => v !== '' && v != null && v !== undefined)).toString() : ''
  const base = (process.env.NEXT_PUBLIC_BASEPATH || '') + '/api'
  const res = await fetch(base + path + qs, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin'
  })
  let json = null
  try {
    json = await res.json()
  } catch {}
  if (res.status === 401 && typeof window !== 'undefined' && !path.startsWith('/auth/')) {
    window.location.href = '/login'
  }
  if (!res.ok) throw new ApiError(json?.error || 'Có lỗi xảy ra', res.status)
  return json?.data
}
