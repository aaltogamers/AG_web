import { Html, Head, Main, NextScript } from 'next/document'

// The CMS shows /cms-preview in an iframe while editing, so it isn't a real page view
const Document = ({ __NEXT_DATA__ }) => {
  const trackPageViews = !__NEXT_DATA__.page.startsWith('/cms-preview')
  return (
    <Html lang="en" className="h-full">
      <Head>
        <link rel="shortcut icon" href="/favicon.ico" />
        <script src="/sw.js" />
        {trackPageViews && (
          <script
            defer
            src="https://stats.aaltogamers.fi/stats.js"
            data-website-id="1d896449-3521-48db-b264-1328aa7e520c"
            data-domains="aaltogamers.fi,www.aaltogamers.fi"
            data-exclude-hash="true"
          />
        )}
      </Head>
      <body className="text-white min-h-full">
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}

export default Document
