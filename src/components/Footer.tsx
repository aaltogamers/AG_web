import Link from 'next/link'
import React from 'react'
import { medias } from '../utils/contants'

const Footer = () => (
  <footer className="flex flex-col justify-center items-center">
    <div className="flex justify-center mt-10">
      {medias.slice(1).map(({ link, Icon }) => (
        <Link href={link} key={link} className="hover:text-red">
          <Icon size={30} className="mx-2" />
        </Link>
      ))}
    </div>
    <div className="py-10 ">&copy; 2023 Aalto Gamers ry. All rights reserved.</div>
  </footer>
)

export default Footer
