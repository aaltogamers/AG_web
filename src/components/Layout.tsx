import React, { ReactNode } from 'react'
import Header from './Header'
import Footer from './Footer'

interface Props {
  children: ReactNode
}

const Layout = ({ children }: Props) => (
  <div className="landing">
    <Header />
    {children}
    <Footer />
  </div>
)

export default Layout
