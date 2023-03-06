import React, { ReactNode } from 'react'

interface Props {
  children: ReactNode
}

const PageWrapper = ({ children }: Props) => (
  <div className="px-8 md:px-24 lg:px-48">{children}</div>
)

export default PageWrapper
