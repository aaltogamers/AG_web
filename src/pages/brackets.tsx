import Head from 'next/head'
import makeBackgroundInvisible from '../utils/makeBackgroundInvisible'
import { useEffect } from 'react'
import { bracketStyles } from '../utils/createMockBracketData'
import BracketsMain from '../components/BracketsMain'

const Brackets = () => {
  useEffect(() => {
    makeBackgroundInvisible()
  }, [])

  return (
    <>
      <Head>
        <title>Brackets - Aalto Gamers</title>
      </Head>

      <BracketsMain bracketStyles={bracketStyles} />
    </>
  )
}

export default Brackets
