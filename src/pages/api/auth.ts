import { initializeApp } from 'firebase/app'
import type { NextApiRequest, NextApiResponse } from 'next'
import { App } from 'octokit'
import { firebaseConfig } from '../../utils/db'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'

type ResponseData = string

const passwordForm = (text: string) => `
  <!DOCTYPE html>
  <html>
  <head>
    <title>AG Content Management System Login</title>
  </head>
  <body>
  <h1>Enter password for AG content management system</h1>
  <form method="post" style="display: flex; flex-direction: column; gap: 0.5rem;">
    <input type="password" name="password" style="width: 300px;"/>
    <span style="color: red;">${text ? text : ''}</span>
    <button type="submit" style="width: 100px;">Submit</button>
  </form>
  </body>
  </html>
`

export default async function handler(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
  const { password } = req.body

  const firebaseApp = initializeApp(firebaseConfig)
  const auth = getAuth(firebaseApp)

  if (!password) {
    return res.send(passwordForm(''))
  }

  try {
    const email = 'board@aaltogamers.fi'
    await signInWithEmailAndPassword(auth, email, password)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    //
    if (e?.code === 'auth/too-many-requests') {
      return res.send(passwordForm('Too many attempts, try again later'))
    }

    return res.send(passwordForm('Incorrect password'))
  }

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

  // This is what talks to the NetlifyCMS page. Using window.postMessage we give it the
  // token details in a format it's expecting
  const script = `
    <script>
    (function() {
      function recieveMessage(e) {
        console.log("recieveMessage %o", e);
        
        // send message to main window with the app
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

  return res.send(script)
}
