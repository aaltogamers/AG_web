const BOT_UA_REGEX =
  /bot|crawl|slurp|spider|mediapartners|facebookexternalhit|facebot|embedly|pinterest|twitterbot|linkedinbot|whatsapp|telegrambot|discordbot|slackbot|vkshare|quora|redditbot|applebot|bingpreview|yandex|baiduspider|duckduckbot|ahrefs|semrush|mj12bot|dotbot|petalbot|seznambot|ia_archiver|archive\.org_bot|headlesschrome|phantomjs|puppeteer|playwright|lighthouse|pagespeed|gtmetrix|pingdom|uptimerobot|newrelic|monitor|curl|wget|httpclient|python-requests|okhttp|go-http-client|java\/|axios|node-fetch|got|undici|scrapy|prerender|bytespider|amazonbot|gptbot|chatgpt|openai|anthropic|claudebot|perplexity|cohere|googleother|google-extended|google-read-aloud|adsbot|feedfetcher|storebot|ccbot|dataforseo|diffbot|rogerbot|screaming|sitebulb|turnitin|zgrab|censys|shodan|nuclei|sqlmap|nikto|acunetix|burp|nessus|qualys|masscan|httpx|libwww|urllib|mechanize|aiohttp|rest-client|postman|insomnia|kube-probe|elb-health|healthcheck|statuscake|site24x7|keycdn|synthetics|datadog|dynatrace|grafana|uptime|nutch|exabot|sogou|qwantify|bitlybot|netcraft|mail\.ru/i

/** Chromium 101+ typically sends `sec-ch-ua`; many scrapers omit it while using a recent Chrome/Edge UA. */
const CHROMIUM_UA_VER = /\b(?:chrome|edg)\/(\d+)/i

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

const recentChromiumVersion = (userAgentLower: string): number | null => {
  const m = userAgentLower.match(CHROMIUM_UA_VER)
  if (!m) return null
  const v = parseInt(m[1], 10)
  return Number.isFinite(v) ? v : null
}

const missingSecChUaForClaimedChromium = (
  headers: HeaderSource | Record<string, string | string[] | undefined>,
  userAgentLower: string
): boolean => {
  const ver = recentChromiumVersion(userAgentLower)
  if (ver === null || ver < 101) return false
  return getHeader(headers, 'sec-ch-ua').trim() === ''
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

  if (missingSecChUaForClaimedChromium(headers, userAgent)) return true

  return false
}
