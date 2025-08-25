import Head from 'next/head'
import Layout from '../components/Layout'
import '../styles/globals.css'
import { Metadata } from 'next'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <Head>
        <link rel="shortcut icon" href="/favicon.ico" />
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
