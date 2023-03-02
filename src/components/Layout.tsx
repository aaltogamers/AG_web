import React, { ReactNode } from 'react'
import NavBar from './NavBar'
import Footer from './Footer'

interface Props {
  children: ReactNode
}

const Layout = ({ children }: Props) => (
  <div className="min-h-screen flex flex-col">
    <NavBar />
    <main className="flex-1 p-8 md:p-20">{children}</main>
    <Footer />
  </div>
)

export default Layout
