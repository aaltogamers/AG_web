import AGImage from './AGImage'
import { AGPartner } from '../types/types'

type Props = {
  partner: AGPartner
}

const Partner = ({ partner }: Props) => {
  return (
    <div
      key={partner.name}
      className="flex flex-col items-center px-8 max-w-xl text-center mb-24 md:mb-0 md:w-2/5"
    >
      <AGImage src={partner.image} alt={partner.name} />
      <h3 className="pt-12">{partner.name}</h3>
      {[partner.finnishLink, partner.englishLink].map((link) => (
        <a href={link} className="link text-xl" key={link}>
          {link}
        </a>
      ))}
    </div>
  )
}

export default Partner
