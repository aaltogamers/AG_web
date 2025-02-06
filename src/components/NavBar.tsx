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
  <nav className="hidden md:flex h-20 text-xl  bg-darkgray">
    <Link href="/" className="flex w-60">
      <img src="/images/navbar/ag-banner.png" alt="AG" />
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
  <div className="md:hidden fixed top-0 left-0 z-20 w-full">
    <div className="flex items-center  bg-darkgray h-16">
      <BurgerButton open={isOpen} onClick={() => setIsOpen(!isOpen)} />
      <div className="flex justify-center w-full">
        <Link href="/" className="flex" onClick={() => setIsOpen(false)}>
          <img src="/images/navbar/ag-text.svg" alt="Aalto Gamers" className="h-14" />
        </Link>
      </div>
    </div>
    <div className="flex">
      <div
        className={`fixed bg-darkgray z-10 top-16 left-0 w-full h-full transition-[max-width] ease-in-out duration-500 pt-12 ${
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
    { name: 'About', link: '/about' },
    { name: 'Events', link: '/events' },
    { name: 'Partners', link: '/partners' },
    { name: 'Gallery', link: '/gallery' },
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
