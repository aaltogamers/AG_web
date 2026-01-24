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
  contactPeopleNames: string[]
  boardMembers: AGBoardMember[]
}

const SafeSpace = ({ title, content, boardMembers, contactPeopleNames }: Props) => {
  const contactPersons = boardMembers
    .filter((person) => contactPeopleNames.includes(person.name))
    .map(({ image, name, contactInformation }) => ({
      image,
      name,
      title: 'Harassment contact person',
      contactInformation,
    }))
  return (
    <PageWrapper>
      <Head>
        <title>Safer Space Policy - Aalto Gamers</title>
      </Head>
      <div className="flex justify-center">
        <div className="flex flex-col md:w-3/4 items-center">
          <Header>{title}</Header>
          <div className="my-20">
            <Markdown>{content}</Markdown>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 text-lg md:w-2/3 justify-center">
            {contactPersons.map((boardMember) => (
              <BoardMember boardMember={boardMember} key={boardMember.name} showContactInfo />
            ))}
          </div>
        </div>
      </div>
    </PageWrapper>
  )
}

export default SafeSpace

export const getStaticProps = () => ({
  props: { boardMembers: getFolder('boardmembers'), ...getFile('safespace') },
})
