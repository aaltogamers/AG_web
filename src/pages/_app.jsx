/* eslint-disable react/jsx-props-no-spreading */
import React from 'react'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'
import '../styles/globals.css'

const App = ({ Component, pageProps }) => {
  const router = useRouter()

  const LayoutToUse = router.asPath.startsWith('/admin') ? React.Fragment : Layout

  return (
    <LayoutToUse>
      <Component {...pageProps} />
    </LayoutToUse>
  )
}

export default App
