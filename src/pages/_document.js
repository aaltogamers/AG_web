/* eslint-disable react/jsx-filename-extension */
import { Html, Head, Main, NextScript } from 'next/document'

const Document = () => {
  return (
    <Html lang="en" className="h-full">
      <Head />
      <body className="bg-black text-white h-full">
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}

export default Document
