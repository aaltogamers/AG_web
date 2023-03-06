import Head from 'next/head'
import Link from 'next/link'
import Header from '../components/Header'
import PageWrapper from '../components/PageWrapper'
import { medias } from '../utils/contants'

const Join = () => {
  return (
    <PageWrapper>
      <Head>
        <title>Join - Aalto Gamers</title>
      </Head>
      <Header>Join us</Header>
      <h3 className="w-full text-center mt-10">Be a part of the coolest gaming community!</h3>
      <div className="w-full justify-center flex">
        <div className="grid grid-cols-3 gap-4 w-3/4">
          {medias.map(({ name, link, Icon }) => (
            <Link
              href={link}
              key={name}
              className="flex items-center justify-center text-xl hover:text-red"
            >
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
