import { Html, Head, Main, NextScript } from 'next/document'

const Document = () => {
  return (
    <Html lang="en" className="h-full">
      <Head>
        <link rel="shortcut icon" href="/images/favicon.png" />
        <script src="/sw.js" />
      </Head>
      <body className="text-white min-h-full">
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}

export default Document
