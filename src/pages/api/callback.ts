import type { NextApiRequest, NextApiResponse } from 'next'
import tiny from 'tiny-json-http'

type ResponseData = string

const client_id = process.env.CLIENT_ID
const client_secret = process.env.CLIENT_SECRET
const tokenUrl = 'https://github.com/login/oauth/access_token'

export default async function handler(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
  const data = {
    code: req.query.code,
    client_id,
    client_secret,
  }

  try {
    const { body } = await tiny.post({
      url: tokenUrl,
      data,
      headers: {
        // GitHub returns a string by default, ask for JSON to make the reponse easier to parse.
        Accept: 'application/json',
      },
    })

    const postMsgContent = {
      token: body.access_token,
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
  } catch (err) {
    // If we hit an error we'll handle that here
    console.log(err)
    res.redirect('/?error=😡')
  }
}
