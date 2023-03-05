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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
          {boardMembers.map((boardMember) => (
            <div key={boardMember.name} className="flex flex-col justify-center align-center m-8">
              {boardMember.image ? (
                <img src={boardMember.image} alt={`${boardMember.name}`} />
              ) : (
                <img src="images/board-juho.jpg" alt={`${boardMember.name}`} />
              )}
              <h3 className="mt-4 mb-2">{boardMember.title}</h3>
              <h4>{boardMember.name}</h4>
              <div>{boardMember.status}</div>
              <div>Favorite game: {boardMember.game}</div>
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
