/* eslint-disable react/jsx-props-no-spreading */
import Layout from '../components/Layout'
import '../styles/globals.css'
import '../styles/main.css'

const App = ({ Component, pageProps }) => {
  return (
    <Layout>
      <Component {...pageProps} />
    </Layout>
  )
}

export default App
