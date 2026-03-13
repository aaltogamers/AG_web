import Head from 'next/head'
import makeBackgroundInvisible from '../utils/makeBackgroundInvisible'
import { useEffect } from 'react'
import { bracketStyles, teams } from '../utils/createMockBracketData'
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

      <BracketsMain
        bracketStyles={bracketStyles}
        teams={teams}
        teamCount={16}
        bracketType="double_elimination_to_top_4"
      />
    </>
  )
}

export default Brackets
