// Client-side analytics auth helpers.
//
// The server issues a signed, HttpOnly `ag_admin` cookie after a successful
// POST to /api/analytics/login. We never store the password in JS — the cookie
// is attached automatically by the browser on same-origin requests.

export const loginAnalytics = async (password: string): Promise<boolean> => {
  const res = await fetch('/api/analytics/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password }),
    credentials: 'same-origin',
  })
  return res.ok
}

export const logoutAnalytics = async (): Promise<void> => {
  await fetch('/api/analytics/logout', {
    method: 'POST',
    credentials: 'same-origin',
  }).catch(() => undefined)
}

export const fetchAnalytics = async (url: string): Promise<Response> =>
  fetch(url, { credentials: 'same-origin' })
