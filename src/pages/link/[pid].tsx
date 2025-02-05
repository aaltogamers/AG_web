'use server'

import { GetStaticPropsContext } from 'next'
import { getFile } from '../../utils/fileUtils'
import { redirect as doRedirect } from 'next/navigation'

type Redirect = {
  name: string
  path: string
  url: string
}

type Props = {
  redirect: Redirect
}

const Links = ({ redirect }: Props) => {
  try {
    if (redirect) {
      console.log(redirect.url)
      doRedirect(redirect.url)
    }
  } catch (error) {
    console.error(error)
  }
}

export default Links

export async function getStaticPaths() {
  return { paths: [], fallback: true }
}

export const getStaticProps = (context: GetStaticPropsContext) => {
  const pid = context?.params?.pid
  const { redirects } = getFile('redirects') as unknown as { redirects: Redirect[] }
  const redirect = redirects.find((r) => r.path === pid)

  return {
    props: { redirect },
    redirect: redirect && {
      destination: redirect.url,
    },
  }
}
