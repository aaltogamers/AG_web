import Link from 'next/link'
import React, { Dispatch, SetStateAction } from 'react'
import BurgerButton from './BurgerButton'

type HeaderLink = {
  name: string
  link: string
}

type DesktopProps = {
  links: HeaderLink[]
}

type MobileProps = {
  isOpen: boolean
  setIsOpen: Dispatch<SetStateAction<boolean>>
  links: HeaderLink[]
}

const DesktopNavBar = ({ links }: DesktopProps) => (
  <nav className="hidden md:flex h-16  bg-darkGray">
    <Link href="/" className="flex">
      <img src="/images/ag-banner.png" alt="Aalto Gamers" />
    </Link>
    <div className="flex justify-end w-full text-center items-center">
      {links.map(({ name, link }) => (
        <Link href={link} key={name} className="px-4 h-fit">
          {name}
        </Link>
      ))}
    </div>
  </nav>
)

const MobileNavBar = ({ isOpen, setIsOpen, links }: MobileProps) => (
  <div className="md:hidden">
    <div className="flex items-center bg-darkGray h-16">
      <BurgerButton open={isOpen} onClick={() => setIsOpen(!isOpen)} />
      <Link
        href="/"
        className="flex w-full text-center h-fit font-blockletter text-3xl pr-16 justify-center"
      >
        <img src="images/ag-text.svg" alt="Aalto Gamers" className="h-14" />
      </Link>
    </div>
    <div className="flex">
      <div
        className={`fixed bg-darkGray top-16 left-0 w-full h-full transition-[max-width] ease-in-out duration-500 pt-12 ${
          isOpen ? 'max-w-[50%] overflow-x-hidden overflow-y-auto' : 'max-w-0 overflow-hidden'
        }`}
      >
        <nav className="flex flex-col p-4 w-[50vw] min-h-full">
          {links.map(({ name, link }) => (
            <Link href={link} key={name} className="text-2xl py-4" onClick={() => setIsOpen(false)}>
              {name}
            </Link>
          ))}
        </nav>
      </div>
      <div
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
        className={isOpen ? 'fixed w-[50vw] min-h-full  right-0 top-16' : 'hidden'}
      />
    </div>
  </div>
)

const NavBar = () => {
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
      <DesktopNavBar links={links} />
      <MobileNavBar isOpen={isOpen} setIsOpen={setIsOpen} links={links} />
    </>
  )
}

export default NavBar
