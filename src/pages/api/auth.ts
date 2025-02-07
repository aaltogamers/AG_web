import type { NextApiRequest, NextApiResponse } from 'next'

type ResponseData = {
  message: string
}

const authUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.CLIENT_ID}&scope=repo,user`

export default function handler(_: NextApiRequest, res: NextApiResponse<ResponseData>) {
  res.redirect(authUrl)
}
