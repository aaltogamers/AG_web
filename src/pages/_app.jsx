/* eslint-disable react/jsx-props-no-spreading */
import React, { useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'
import '../styles/globals.css'
import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword, User } from 'firebase/auth'
import { firebaseConfig } from '../utils/db'
import { Timestamp, getFirestore, addDoc, collection } from 'firebase/firestore'

const App = ({ Component, pageProps }) => {
  const router = useRouter()
  const app = initializeApp(firebaseConfig)
  const auth = getAuth(app)
  const db = getFirestore(app)
  const oldRoutes = useRef(new Set())

  const LayoutToUse =
    router.asPath.startsWith('/cms') ||
    router.asPath.startsWith('/admin') ||
    router.asPath.startsWith('/bet') ||
    router.asPath.startsWith('/mapban')
      ? React.Fragment
      : Layout

  useEffect(() => {
    auth.onAuthStateChanged(async (user) => {
      if (!user) {
        await signInWithEmailAndPassword(auth, 'guest@aaltogamers.fi', 'aaltogamerpassword')
      }
    })

    const path = router.asPath
    if (!oldRoutes.current.has(path)) {
      oldRoutes.current.add(path)
      addDoc(collection(db, 'analytics'), { path, timestamp: Timestamp.now() })
    }

    router.events.on('routeChangeStart', (url) => {
      if (!oldRoutes.current.has(url)) {
        oldRoutes.current.add(url)
        addDoc(collection(db, 'analytics'), { path: url, timestamp: Timestamp.now() })
      }
    })
  }, [router])

  return (
    <LayoutToUse>
      <Component {...pageProps} />
    </LayoutToUse>
  )
}

export default App
