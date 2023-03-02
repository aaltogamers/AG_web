import Head from 'next/head'
import Header from '../components/Header'
import PageWrapper from '../components/PageWrapper'

const HallOfFame = () => {
  return (
    <PageWrapper>
      <Head>
        <title>Hall of Fame - Aalto Gamers</title>
      </Head>
      <Header>Hall of Fame</Header>
      <h2 className="text-center mt-24">Coming soon...</h2>
    </PageWrapper>
  )
}

export default HallOfFame
