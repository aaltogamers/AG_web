/* eslint-disable react/jsx-props-no-spreading */
import React from 'react'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'
import '../styles/globals.css'

const App = ({ Component, pageProps }) => {
  const router = useRouter()
  // Pages that opt out of the site chrome (NavBar/Footer). Also: anything with
  // `?stream` or `?fullscreen` in the URL opts out so any page can be used as
  // a bare overlay (used by /tournaments/[slug] stream mode).
  const isStreamUrl =
    router.query.stream !== undefined || router.query.fullscreen !== undefined
  const LayoutToUse =
    isStreamUrl ||
    router.asPath.startsWith('/cms') ||
    router.asPath.startsWith('/admin') ||
    router.asPath.startsWith('/bet') ||
    router.asPath.startsWith('/mapban') ||
    router.asPath.startsWith('/osmaudiencegame') ||
    router.asPath.startsWith('/brackets') ||
    router.asPath.startsWith('/roulette')
      ? React.Fragment
      : Layout

  return (
    <LayoutToUse>
      <Component {...pageProps} />
    </LayoutToUse>
  )
}

export default App
