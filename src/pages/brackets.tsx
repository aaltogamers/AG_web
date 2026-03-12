import Head from 'next/head'
import BracketsSection from '../components/BracketsSection'

const Brackets = () => {
  return (
    <>
      <Head>
        <title>Brackets - Aalto Gamers</title>
      </Head>

      <div className="p-8">
        <BracketsSection />
      </div>
    </>
  )
}

export default Brackets
