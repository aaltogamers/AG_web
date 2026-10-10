import Head from 'next/head'
import Script from 'next/script'
import Layout from '../components/Layout'
import '../styles/globals.css'
import { Metadata } from 'next'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <Head>
        <link rel="shortcut icon" href="/favicon.ico" />
      </Head>
      <body className="text-white min-h-full">
        <Layout>{children}</Layout>
        <Script
          src="https://stats.aaltogamers.fi/stats.js"
          data-website-id="1d896449-3521-48db-b264-1328aa7e520c"
          data-domains="aaltogamers.fi,www.aaltogamers.fi"
          // The Telegram tasks app gets the user's login data in the URL hash
          data-exclude-hash="true"
          strategy="afterInteractive"
        />
      </body>
    </html>
  )
}

export const metadata: Metadata = {
  title: 'Aalto Gamers',
  description: 'Aalto Gamers is a student organization at Aalto University',
}
