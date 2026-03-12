import Head from 'next/head'
import BracketsSection from '../components/BracketsSection'
import Header from '../components/Header'
import PageWrapper from '../components/PageWrapper'

const Brackets = () => {
  return (
    <>
      <Head>
        <title>Brackets - Aalto Gamers</title>
      </Head>
      <PageWrapper>
        <section className="pb-24">
          <Header>Brackets</Header>

          <BracketsSection />
        </section>
      </PageWrapper>
    </>
  )
}

export default Brackets
