import Head from 'next/head'
import BoardMember from '../components/BoardMember'
import Header from '../components/Header'
import Markdown from '../components/Markdown'
import PageWrapper from '../components/PageWrapper'
import { AGBoardMember } from '../types/types'
import { getFolder, getFile } from '../utils/fileUtils'

interface Props {
  title: string
  content: string
  boardTitle: string
  boardMembers: AGBoardMember[]
}

const About = ({ title, content, boardMembers, boardTitle }: Props) => {
  return (
    <PageWrapper>
      <Head>
        <title>About - Aalto Gamers</title>
      </Head>
      <div className="flex flex-col items-center text-center">
        <Header>{title}</Header>
        <div className="my-20">
          <Markdown>{content}</Markdown>
        </div>
        <h2>{boardTitle}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 text-lg">
          {boardMembers
            .sort((member1, member2) => member1.orderNumber - member2.orderNumber)
            .map((boardMember) => (
              <BoardMember boardMember={boardMember} key={boardMember.name} />
            ))}
        </div>
      </div>
    </PageWrapper>
  )
}

export default About

export const getStaticProps = () => ({
  props: { boardMembers: getFolder('boardmembers'), ...getFile('about') },
})
