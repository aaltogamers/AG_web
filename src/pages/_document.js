/* eslint-disable react/jsx-filename-extension */
import { Html, Head, Main, NextScript } from 'next/document'
import Layout from '../components/Layout'

const Document = () => {
  return (
    <Html lang="en" className="h-full">
      <Head />
      <body className="text-white min-h-full">
        <Layout>
          <Main />
          <NextScript />
        </Layout>
      </body>
    </Html>
  )
}

export default Document
