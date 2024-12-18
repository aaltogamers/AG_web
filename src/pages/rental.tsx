import Head from 'next/head'
import Header from '../components/Header'
import Markdown from '../components/Markdown'
import PageWrapper from '../components/PageWrapper'
import { getFile } from '../utils/fileUtils'

interface item {
  name: string
  stock: number
  price: number
}

interface Props {
  title: string
  content: string
  equipment_list: item[]
}

const Rental = ({ title, content, equipment_list }: Props) => {
  return (
    <PageWrapper>
      <Head>
        <title>Equipment Rental - Aalto Gamers</title>
      </Head>
      <div className="flex justify-center">
        <div className="flex flex-col items-center text-center md:w-3/4">
          <Header>{title}</Header>
          <div className="my-20">
            <Markdown>{content}</Markdown>
          </div>
          <table className="table-auto w-full text-md">
            <tbody>
              {equipment_list.map((item: item) => (
                <tr key={item.name} className="border-b p-2 text-left">
                  <td>{item?.stock ?? 1}x </td>
                  <td>{item.name}</td>
                  <td className="text-right">
                    {item?.price ? `${item?.price}€ / day` : 'not available'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PageWrapper>
  )
}

export default Rental

export const getStaticProps = () => ({
  props: { ...getFile('equipment') },
})
