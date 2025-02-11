import Link from 'next/link'
import React from 'react'
import MobileNavBar from './MobileNavBar'
import { HeaderLink } from '../types/types'
import AGImage from './AGImage'

type DesktopProps = {
  links: HeaderLink[]
}

const DesktopNavBar = ({ links }: DesktopProps) => (
  <nav className="hidden md:flex h-20 text-xl  bg-darkgray">
    <Link href="/" className="flex w-60">
      <AGImage src="/images/navbar/ag-banner.png" alt="AG" />
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

const NavBar = () => {
  const links: HeaderLink[] = [
    { name: 'About', link: '/about' },
    { name: 'Events', link: '/events' },
    { name: 'Equipment', link: '/equipment' },
    { name: 'Partners', link: '/partners' },
    { name: 'Gallery', link: '/gallery' },
    { name: 'Join', link: '/join' },
  ]

  return (
    <>
      <DesktopNavBar links={links} />
      <MobileNavBar links={links} />
    </>
  )
}

export default NavBar
