import React, { ReactNode } from 'react'
import NavBar from './NavBar'
import Footer from './Footer'
import { NavBarAdminProvider } from './NavBarAdminProvider'

interface Props {
  children: ReactNode
}

const Layout = ({ children }: Props) => (
  <NavBarAdminProvider>
    <div className="min-h-screen flex flex-col relative">
      <NavBar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  </NavBarAdminProvider>
)

export default Layout
