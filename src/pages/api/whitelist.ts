import type { NextApiRequest, NextApiResponse } from 'next'

import { Rcon } from 'rcon-client'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { username } = req.body
  if (!username || typeof username !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid username' })
  }

  const rcon_ip = process.env.RCON_IP
  const rcon_password = process.env.RCON_PASSWORD
  const rcon_port = parseInt(process.env.RCON_PORT || '25575', 10)

  if (!rcon_ip || !rcon_password) {
    return res
      .status(500)
      .json({ error: 'RCON_IP or RCON_PASSWORD missing in environment variables' })
  }

  try {
    const rcon = new Rcon({
      host: rcon_ip,
      port: rcon_port,
      password: rcon_password,
    })
    await rcon.connect()
    const response = await rcon.send(`whitelist add ${username}`)
    await rcon.end()
    return res.status(200).json({ message: response })
  } catch (err: unknown) {
    const error = err as { code?: string; message?: string }

    if (error?.code === 'ECONNREFUSED') {
      return res.status(502).json({
        error: 'Failed to connect to the Minecraft server. Is it running and is RCON enabled?',
      })
    }
    return res.status(500).json({ error: `An error occurred: ${error.message || error}` })
  }
}
