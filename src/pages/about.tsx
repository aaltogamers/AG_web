import Head from 'next/head'

import Header from '../components/Header'
import Markdown from '../components/Markdown'
import PageWrapper from '../components/PageWrapper'
import { getFolder, getFile } from '../utils/fileUtils'

type BoardMember = {
  name: string
  title: string
  status: string
  game: string
  image?: string
}

interface Props {
  title: string
  content: string
  boardTitle: string
  boardMembers: BoardMember[]
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
          {boardMembers.map((boardMember) => (
            <div key={boardMember.name} className="flex flex-col align-center m-8">
              <img
                src={boardMember.image || 'images/board-placeholder.png'}
                alt={`${boardMember.name}`}
              />
              <h3 className="mt-4">{boardMember.title}</h3>
              <h4>{boardMember.name}</h4>
              <div className="mt-4 ">
                {boardMember.status}
                <br />
                Favorite game: {boardMember.game}
              </div>
            </div>
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
