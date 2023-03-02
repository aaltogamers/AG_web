import { Link } from 'react-scroll'

interface Props {
  to: string
}

const ScrollLink = ({ to }: Props) => {
  return (
    <Link to={to} smooth className="absolute bottom-2 left-1/2 transform -translate-x-1/2">
      <img src="/images/arrow.svg" alt="arrow" />
    </Link>
  )
}

export default ScrollLink
