import '../styles/globals.css'

// eslint-disable-next-line react/function-component-definition
export default function App({ Component, pageProps }) {
  // eslint-disable-next-line react/jsx-filename-extension, react/jsx-props-no-spreading
  return <Component {...pageProps} />
}
