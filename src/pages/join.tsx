import Head from 'next/head'
import Link from 'next/link'
import Header from '../components/Header'
import PageWrapper from '../components/PageWrapper'
import { medias } from '../utils/socialMediaLinks'

const Join = () => {
  return (
    <PageWrapper>
      <Head>
        <title>Join - Aalto Gamers</title>
      </Head>
      <Header>Join us</Header>
      <h3 className="w-full text-center mt-10">Be a part of the coolest gaming community!</h3>
      <div className="w-full justify-center flex">
        <div className="flex flex-row flex-wrap justify-center gap-8 gap-x-16 w-3/4 mt-4">
          {medias.map(({ name, link, Icon }) => (
            <Link href={link} key={name} className="flex items-center justify-center text-xl">
              {name}
              <Icon size={100} className="m-4" />
            </Link>
          ))}
        </div>
      </div>
    </PageWrapper>
  )
}

export default Join
