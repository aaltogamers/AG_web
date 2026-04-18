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
  const oktoApp = new App({
    appId: process.env.APP_ID || '',
    privateKey: Buffer.from(process.env.PRIVATE_KEY || '', 'base64').toString('ascii'),
  })

  const authRes = await oktoApp.octokit.request(
    `POST /app/installations/${process.env.INSTALLATION_ID}/access_tokens`
  )

  const postMsgContent = {
    token: authRes.data.token,
    provider: 'github',
  }

  // Hand the token to Decap CMS via window.postMessage on the opener window.
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

export default async function handler(req: NextApiRequest, res: NextApiResponse<string>) {
  res.setHeader('content-type', 'text/html; charset=utf-8')

  // If the caller already has a valid admin session cookie (e.g. they just
  // logged in via /admin), skip the password form and hand out a token.
  if (isAdminAuthorized(req)) {
    try {
      return res.send(await mintGithubTokenScript())
    } catch (e) {
      console.error('[api/auth] failed to mint github token:', e)
      return res.status(500).send(passwordForm('Failed to mint GitHub token'))
    }
  }

  // GET with no cookie → show the password form.
  if (req.method === 'GET') {
    return res.send(passwordForm(''))
  }

  // POST with password → validate, set cookie, hand out a token.
  const password = typeof req.body?.password === 'string' ? req.body.password : ''

  if (!password) {
    return res.send(passwordForm(''))
  }
  if (!process.env.ADMIN_PASSWORD) {
    return res.status(500).send(passwordForm('ADMIN_PASSWORD not configured on server'))
  }
  if (!verifyAdminPassword(password)) {
    return res.send(passwordForm('Incorrect password'))
  }

  setAdminSessionCookie(res)

  try {
    return res.send(await mintGithubTokenScript())
  } catch (e) {
    console.error('[api/auth] failed to mint github token:', e)
    return res.status(500).send(passwordForm('Failed to mint GitHub token'))
  }
}
