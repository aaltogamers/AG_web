// Client-side admin auth helpers.
//
// The server issues a signed, HttpOnly `ag_admin` cookie after a successful
// POST to /api/admin/login. We never store the password in JS — the cookie
// is attached automatically by the browser on same-origin requests. All
// admin-guarded endpoints (signups, polls, mapbans, analytics stats, ...)
// read the same cookie.

export const loginAdmin = async (password: string): Promise<boolean> => {
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password }),
    credentials: 'same-origin',
  })
  return res.ok
}

export const logoutAdmin = async (): Promise<void> => {
  await fetch('/api/admin/logout', {
    method: 'POST',
    credentials: 'same-origin',
  }).catch(() => undefined)
}

export const checkAdminSession = async (): Promise<boolean> => {
  try {
    const res = await fetch('/api/admin/me', { credentials: 'same-origin' })
    return res.ok
  } catch {
    return false
  }
}

// Admin-authenticated fetch. Cookie goes automatically with same-origin.
export const fetchAdmin = async (url: string): Promise<Response> =>
  fetch(url, { credentials: 'same-origin' })
