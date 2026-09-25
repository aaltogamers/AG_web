// GitHub App access to the site repo, used for the Decap CMS login (/api/auth)
// and for editing CMS content from the AI agent API (/api/agent/events).
import { App } from 'octokit'

// Same repo and branch as the backend in public/cms/config.yml
export const REPO_OWNER = 'aaltogamers'
export const REPO_NAME = 'AG_web'
export const REPO_BRANCH = 'master'

let app: App | null = null

const getApp = (): App => {
  if (app) return app
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

  app = new App({ appId: appId as string, privateKey })
  return app
}

// Short-lived installation token, handed to Decap CMS after login
export const mintInstallationToken = async (): Promise<string> => {
  const res = await getApp().octokit.request(
    `POST /app/installations/${process.env.INSTALLATION_ID}/access_tokens`
  )
  return res.data.token
}

export const getRepoOctokit = () =>
  getApp().getInstallationOctokit(Number(process.env.INSTALLATION_ID))
