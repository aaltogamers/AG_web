import Head from 'next/head'
import CmsEditLink from '../components/CmsEditLink'
import Header from '../components/Header'
import PageWrapper from '../components/PageWrapper'
import Scoreboard from '../components/Scoreboard'
import { ScoreBoardEntry } from '../types/types'
import { getFile } from '../utils/fileUtils'

type LeaderBoardEntryWithHistory = {
  name: string
  point_entries: { points: number; date: string }[]
}

type Props = {
  learderboard_entries: LeaderBoardEntryWithHistory[]
}

const LeaderBoard = ({ learderboard_entries }: Props) => {
  const entries: ScoreBoardEntry[] = learderboard_entries
    ? learderboard_entries.map(({ name, point_entries }) => {
        return {
          name,
          score: point_entries?.reduce((acc, { points }) => acc + points, 0) || 0,
        }
      })
    : []
  return (
    <PageWrapper>
      <Head>
        <title>Biweekly Leaderboard - Aalto Gamers</title>
      </Head>
      <Header>Biweekly Leaderboard</Header>
      <CmsEditLink
        cmsPath="collections/pages/entries/leaderboard"
        label="Edit leaderboard"
        className="mt-4"
      />
      <Scoreboard entries={entries} placeholderText="Waiting for the start of the next season..." />
    </PageWrapper>
  )
}

export default LeaderBoard

export const getStaticProps = () => ({
  props: { ...getFile('leaderboard') },
})
