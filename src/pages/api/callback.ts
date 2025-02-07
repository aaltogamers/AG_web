import type { NextApiRequest, NextApiResponse } from 'next'
import { App } from 'octokit'

type ResponseData = string

export default async function handler(_: NextApiRequest, res: NextApiResponse<ResponseData>) {
  const app = new App({
    appId: process.env.APP_ID || '',
    privateKey: Buffer.from(process.env.PRIVATE_KEY || '', 'base64').toString('ascii'),
  })

  const authRes = await app.octokit.request(
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
