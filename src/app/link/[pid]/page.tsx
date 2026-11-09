import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getRedirects } from '../../../utils/redirects'
import { trackPageView } from '../../../utils/umami'

type Props = {
  params: Promise<{ pid: string }>
  searchParams: Promise<{ ref?: string | string[] }>
}

const Links = async ({ params, searchParams }: Props) => {
  const pid = (await params).pid
  const redirectItem = getRedirects().find((r) => r.slug === pid)

  if (redirectItem) {
    const { ref } = await searchParams
    const query = typeof ref === 'string' && ref ? `?ref=${encodeURIComponent(ref)}` : ''
    trackPageView(`/link/${pid}${query}`, await headers())
    redirect(redirectItem.url)
  }

  return (
    <div className="w-full flex items-center justify-center p-20">
      <h2>Link not found</h2>
    </div>
  )
}

export default Links
