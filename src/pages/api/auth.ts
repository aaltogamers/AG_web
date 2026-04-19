import type { NextApiRequest, NextApiResponse } from 'next'
import { App } from 'octokit'
import { isAdminAuthorized, setAdminSessionCookie, verifyAdminPassword } from '../../utils/adminSession'

const passwordForm = (text: string) => `
  <!DOCTYPE html>
  <html>
  <head>
    <title>AG Content Management System Login</title>
  </head>
  <body>
  <h1>Enter password for AG content management system</h1>
  <form method="post" style="display: flex; flex-direction: column; gap: 0.5rem;">
    <input type="password" name="password" style="width: 300px;" autofocus/>
    <span style="color: red;">${text ? text : ''}</span>
    <button type="submit" style="width: 100px;">Submit</button>
  </form>
  </body>
  </html>
`

const mintGithubTokenScript = async (): Promise<string> => {
  const appId = process.env.APP_ID
  const privateKeyB64 = process.env.PRIVATE_KEY
  const installationId = process.env.INSTALLATION_ID

  const missing = [
    !appId && 'APP_ID',
    !privateKeyB64 && 'PRIVATE_KEY',
    !installationId && 'INSTALLATION_ID',
  ].filter(Boolean)
  if (missing.length > 0) {
    throw new Error(`Missing GitHub App env vars: ${missing.join(', ')}`)
  }

  let privateKey: string
  try {
    // Trim: secret stores often append a newline, which breaks base64 decode.
    privateKey = Buffer.from((privateKeyB64 as string).trim(), 'base64').toString('utf8')
  } catch (e) {
    throw new Error(`PRIVATE_KEY is not valid base64: ${e instanceof Error ? e.message : e}`)
  }
  if (!privateKey.includes('BEGIN') || !privateKey.includes('PRIVATE KEY')) {
    throw new Error(
      'PRIVATE_KEY must be base64-encoded PEM file bytes (see infra/README.md). After decode, the value should contain BEGIN … PRIVATE KEY (e.g. RSA or PKCS#8).'
    )
  }

  const oktoApp = new App({ appId: appId as string, privateKey })

  const authRes = await oktoApp.octokit.request(
    `POST /app/installations/${installationId}/access_tokens`
  )

  const postMsgContent = {
    token: authRes.data.token,
    provider: 'github',
  }

  return `
    <script>
    (function() {
      function recieveMessage(e) {
        console.log("recieveMessage %o", e);
        window.opener.postMessage(
          'authorization:github:success:${JSON.stringify(postMsgContent)}',
          e.origin
        );
      }
      window.addEventListener("message", recieveMessage, false);
      window.opener.postMessage("authorizing:github", "*");
      console.log("Message sent");
    })()
    </script>`
}

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const respondWithToken = async (res: NextApiResponse<string>): Promise<void> => {
  try {
    res.send(await mintGithubTokenScript())
  } catch (e) {
    console.error('[api/auth] failed to mint github token:', e)
    const msg = e instanceof Error ? e.message : String(e)
    res.status(500).send(passwordForm(`GitHub token error: ${escapeHtml(msg)}`))
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<string>) {
  res.setHeader('content-type', 'text/html; charset=utf-8')

  try {
    if (isAdminAuthorized(req)) {
      return await respondWithToken(res)
    }

    if (req.method === 'GET') {
      return res.send(passwordForm(''))
    }

    const body = req.body as { password?: unknown } | undefined | string
    let password = ''
    if (typeof body === 'string') {
      password = new URLSearchParams(body).get('password') ?? ''
    } else if (body && typeof body === 'object' && typeof body.password === 'string') {
      password = body.password
    }

    if (!password) {
      return res.send(passwordForm(''))
    }
    if (!process.env.ADMIN_PASSWORD) {
      console.error('[api/auth] ADMIN_PASSWORD not configured on server')
      return res.status(500).send(passwordForm('Server misconfigured: ADMIN_PASSWORD not set'))
    }
    if (!verifyAdminPassword(password)) {
      return res.send(passwordForm('Incorrect password'))
    }

    setAdminSessionCookie(res)
    return await respondWithToken(res)
  } catch (e) {
    console.error('[api/auth] unexpected handler error:', e)
    const msg = e instanceof Error ? e.message : String(e)
    return res.status(500).send(passwordForm(`Server error: ${escapeHtml(msg)}`))
  }
}
