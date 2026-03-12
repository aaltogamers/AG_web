import Head from 'next/head'
import BracketsSection from '../components/BracketsSection'
import makeBackgroundInvisible from '../utils/makeBackgroundInvisible'
import { useEffect } from 'react'

const Brackets = () => {
  useEffect(() => {
    makeBackgroundInvisible()
  }, [])

  return (
    <>
      <Head>
        <title>Brackets - Aalto Gamers</title>
      </Head>

      <BracketsSection />
    </>
  )
}

export default Brackets
