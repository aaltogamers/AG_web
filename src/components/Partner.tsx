import AGImage from './AGImage'
import { AGPartner } from '../types/types'

type Props = {
  partner: AGPartner
}

const Partner = ({ partner }: Props) => {
  return (
    <div key={partner.name} className="flex flex-col items-center text-center md:mb-24 mb-12">
      <AGImage src={partner.image} alt={partner.name} className="h-70 w-100 object-contain" />
      <h3 className="pt-12 mb-6">{partner.name}</h3>
      {[partner.finnishLink, partner.englishLink]
        .filter((link) => link)
        .map((link) => (
          <a href={link} className="link text-xl" key={link}>
            {link}
          </a>
        ))}
    </div>
  )
}

export default Partner
