import Link from 'next/link'
import React from 'react'

type HeaderLink = {
  name: string
  link: string
}

interface Props {
  open: boolean
  onClick: () => void
}

const BurgerButton = ({ open, onClick }: Props) => (
  <button type="button" className="text-white w-16 h-16 relative bg-red" onClick={onClick}>
    <span className="sr-only">Open menu</span>
    <div className="block w-5 absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
      <span
        aria-hidden="true"
        className={`block absolute h-0.5 w-5 bg-current transform transition duration-500 ease-in-out ${
          open ? 'rotate-45' : '-translate-y-1.5'
        }`}
      />
      <span
        aria-hidden="true"
        className={`block absolute h-0.5 w-5 bg-current transform transition duration-500 ease-in-out ${
          open ? 'opacity-0' : ''
        }`}
      />
      <span
        aria-hidden="true"
        className={`block absolute h-0.5 w-5 bg-current transform transition duration-500 ease-in-out ${
          open ? '-rotate-45' : 'translate-y-1.5'
        }`}
      />
    </div>
  </button>
)

const Header = () => {
  const links: HeaderLink[] = [
    { name: 'Events', link: '/events' },
    { name: 'About', link: '/about' },
    { name: 'Hall of Fame', link: '/halloffame' },
    { name: 'Partners', link: '/partners' },
    { name: 'Join', link: '/join' },
  ]
  const [isOpen, setIsOpen] = React.useState(false)

  return (
    <>
      <nav className="hidden md:flex h-16  bg-darkBlue">
        <Link href="/" className="flex">
          <img src="/images/Banner_logo.png" alt="Aalto Gamers" />
        </Link>
        <div className="flex justify-end w-full text-center items-center">
          {links.map(({ name, link }) => (
            <Link href={link} key={name} className="px-4 h-fit">
              {name}
            </Link>
          ))}
        </div>
      </nav>
      <div className="md:hidden">
        <div className="flex items-center bg-darkBlue h-16">
          <BurgerButton open={isOpen} onClick={() => setIsOpen(!isOpen)} />
          <Link href="/" className="w-full text-center h-fit font-blockletter text-3xl pr-16">
            AALTO GAMERS
          </Link>
        </div>
        <div
          className={`fixed bg-darkBlue z-[100000] top-16 left-0 w-full h-full transition-[max-width] ease-in-out duration-500 pt-12 ${
            isOpen ? 'max-w-[50%] overflow-x-hidden overflow-y-auto' : 'max-w-0 overflow-hidden'
          }`}
        >
          <nav className="flex flex-col p-4 w-[50vw] min-h-full">
            {links.map(({ name, link }) => (
              <Link href={link} key={name} className="text-2xl py-4">
                {name}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </>
  )
}
export default Header
