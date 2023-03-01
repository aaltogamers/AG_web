import React from 'react'
import Header from './Header'
import Footer from './Footer'

const Layout = ({ children, ...props }) => (
  <div className={props.location === '/' ? 'landing' : ''}>
    <div id="page-wrapper">
      {children}
      <Footer />
    </div>
  </div>
)

export default Layout
