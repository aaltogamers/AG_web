'use server'

import { GetStaticPropsContext } from 'next'
import { getFile } from '../../utils/fileUtils'
import { redirect as doRedirect } from 'next/navigation'
import { useEffect } from 'react'

type Redirect = {
  name: string
  slug: string
  url: string
}

type Props = {
  redirect: Redirect | null
}

const Links = ({ redirect }: Props) => {
  useEffect(() => {
    if (redirect) {
      doRedirect(redirect.url)
    }
  })

  if (redirect) {
    return `Redirecting you to ${redirect.name}...`
  }

  return 'Link not found'
}

export default Links

export async function getStaticPaths() {
  const { redirects } = getFile('redirects') as unknown as { redirects: Redirect[] }
  return { paths: redirects.map((item) => `/link/${item.slug}`), fallback: false }
}

export const getStaticProps = async (context: GetStaticPropsContext) => {
  const pid = context?.params?.pid
  const { redirects } = getFile('redirects') as unknown as { redirects: Redirect[] }
  const redirect = redirects.find((r) => r.slug === pid)

  return {
    props: { redirect: redirect || null },
  }
}
