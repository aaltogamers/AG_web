import React, { ReactNode } from 'react'

interface Props {
  children: ReactNode
}

const PageWrapper = ({ children }: Props) => <div className=" p-8 md:p-20">{children}</div>

export default PageWrapper
