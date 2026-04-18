const BOT_UA_REGEX =
  /bot|crawl|slurp|spider|mediapartners|facebookexternalhit|facebot|embedly|pinterest|twitterbot|linkedinbot|whatsapp|telegrambot|discordbot|slackbot|vkshare|quora|redditbot|applebot|bingpreview|yandex|baiduspider|duckduckbot|ahrefs|semrush|mj12bot|dotbot|petalbot|seznambot|ia_archiver|archive\.org_bot|headlesschrome|phantomjs|puppeteer|playwright|lighthouse|pagespeed|gtmetrix|pingdom|uptimerobot|newrelic|monitor|curl|wget|httpclient|python-requests|okhttp|go-http-client|java\/|axios|node-fetch|got|undici|scrapy|prerender/i

export type HeaderSource = {
  get(name: string): string | null | undefined
}

const getHeader = (headers: HeaderSource | Record<string, string | string[] | undefined>, name: string): string => {
  if (typeof (headers as HeaderSource).get === 'function') {
    return ((headers as HeaderSource).get(name) || '').toString()
  }
  const raw = (headers as Record<string, string | string[] | undefined>)[name.toLowerCase()]
  if (Array.isArray(raw)) return raw.join(',')
  return (raw || '').toString()
}

export const isBotRequest = (
  headers: HeaderSource | Record<string, string | string[] | undefined>
): boolean => {
  const userAgent = getHeader(headers, 'user-agent').toLowerCase()

  if (!userAgent) return true

  if (BOT_UA_REGEX.test(userAgent)) return true

  const purpose = getHeader(headers, 'purpose').toLowerCase()
  const secPurpose = getHeader(headers, 'sec-purpose').toLowerCase()
  if (purpose === 'prefetch' || secPurpose.includes('prefetch')) return true

  if (getHeader(headers, 'next-url')) return true

  return false
}
