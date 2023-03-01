import React, { ReactNode } from 'react'
import NavBar from './NavBar'
import Footer from './Footer'

interface Props {
  children: ReactNode
}

const Layout = ({ children }: Props) => (
  <div>
    <NavBar />
    {children}
    <Footer />
  </div>
)

export default Layout
