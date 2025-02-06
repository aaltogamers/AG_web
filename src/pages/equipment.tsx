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
          <table className="table-auto w-full text-md text-xl">
            <thead>
              <tr className="border-b p-2 ">
                <th className="text-center font-normal py-2 px-2">Quantity</th>
                <th className="text-left font-normal py-2 px-4">Equipment</th>
                <th className="text-center font-normal py-2 px-4">Price (item / day)</th>
                <th className="text-center font-normal py-2 px-2">Price (all / day)</th>
              </tr>
            </thead>
            <tbody>
              {equipment_list.map((item: item) => (
                <tr key={item.name} className="border-b p-2 text-left">
                  <td className="py-2 text-center">{item.stock}</td>
                  <td className="py-2 px-4">{item.name}</td>
                  <td className="text-center py-2 px-4">{`${item.price}€`}</td>
                  <td className="text-center py-2 px-2">
                    {`${(Number(item?.price) || 0) * item.stock}€`}
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
