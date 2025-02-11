import Head from 'next/head'
//import type { Metadata } from 'next'

import Layout from '../components/Layout'
import '../styles/globals.css'
import { Metadata } from 'next'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  /*
  const LayoutToUse =
    pathname &&
    (pathname.startsWith('/cms') ||
      pathname.startsWith('/admin') ||
      pathname.startsWith('/bet') ||
      pathname.startsWith('/mapban'))
      ? React.Fragment
      : Layout
    */

  return (
    <html lang="en" className="h-full">
      <Head>
        <link rel="shortcut icon" href="/images/favicon.png" />
      </Head>
      <body className="text-white min-h-full">
        <Layout>{children}</Layout>
      </body>
    </html>
  )
}

export const metadata: Metadata = {
  title: 'Aalto Gamers',
  description: 'Aalto Gamers is a student organization at Aalto University',
}
