import Head from 'next/head'
import BoardMember from '../components/BoardMember'
import CmsEditLink from '../components/CmsEditLink'
import Header from '../components/Header'
import History from '../components/History'
import Markdown from '../components/Markdown'
import PageWrapper from '../components/PageWrapper'
import { AGBoardMember, HistoryEntry } from '../types/types'
import { getFolder, getFile } from '../utils/fileUtils'

interface Props {
  title: string
  latestHistorySlug: string
  content: string
  boardTitle: string
  boardMembers: AGBoardMember[]
  historyItems: HistoryEntry[]
}

const About = ({
  title,
  content,
  boardMembers,
  boardTitle,
  historyItems,
  latestHistorySlug,
}: Props) => {
  return (
    <PageWrapper>
      <Head>
        <title>About - Aalto Gamers</title>
      </Head>
      <div className="flex justify-center">
        <div className="flex flex-col items-center text-center md:w-3/4">
          <Header>{title}</Header>
          <CmsEditLink
            cmsPath="collections/pages/entries/about"
            label="Edit about"
            className="mt-4"
          />
          <div className="my-20">
            <Markdown>{content}</Markdown>
          </div>
          <Header>{boardTitle}</Header>
          <CmsEditLink
            cmsPath={`collections/history/entries/${latestHistorySlug}`}
            label="Edit board"
            className="mt-4"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 text-lg gap-8 md:gap-16 mt-16">
            {boardMembers.map((boardMember) => (
              <BoardMember boardMember={boardMember} key={boardMember.name} />
            ))}
          </div>
          <History historyItems={historyItems} />
          <CmsEditLink cmsPath="collections/history" label="Edit history" className="mt-4" />
        </div>
      </div>
    </PageWrapper>
  )
}

export default About

export const getStaticProps = () => {
  const historyEntries = getFolder('history') as HistoryEntry[]
  const sortedHistory = historyEntries.sort((a, b) => parseInt(b.year) - parseInt(a.year))
  const latestHistory = sortedHistory[0]
  const boardMembers = latestHistory?.boardMembers ?? []

  return {
    props: {
      boardTitle: `Aalto Gamers Board of ${latestHistory.year}`,
      boardMembers,
      latestHistorySlug: latestHistory.slug,
      historyItems: sortedHistory,
      ...getFile('about'),
    },
  }
}
