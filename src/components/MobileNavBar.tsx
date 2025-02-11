'use client'

import { useState } from 'react'
import BurgerButton from './BurgerButton'
import Link from 'next/link'
import { HeaderLink } from '../types/types'
import AGImage from './ImageThatWorksWithPreview'

type MobileProps = {
  links: HeaderLink[]
}

const MobileNavBar = ({ links }: MobileProps) => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="md:hidden fixed top-0 left-0 z-20 w-full">
      <div className="flex items-center  bg-darkgray h-16">
        <BurgerButton open={isOpen} onClick={() => setIsOpen(!isOpen)} />
        <div className="flex justify-center w-full">
          <Link href="/" className="flex" onClick={() => setIsOpen(false)}>
            <AGImage src="/images/navbar/ag-text.svg" alt="Aalto Gamers" className="h-14" />
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
              <Link
                href={link}
                key={name}
                className="text-2xl py-4"
                onClick={() => setIsOpen(false)}
              >
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
}

export default MobileNavBar
