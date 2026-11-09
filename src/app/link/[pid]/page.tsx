import { redirect } from 'next/navigation'
import { getRedirects } from '../../../utils/redirects'

type Props = {
  params: Promise<{ pid: string }>
}

const Links = async ({ params }: Props) => {
  const pid = (await params).pid
  const redirectItem = getRedirects().find((r) => r.slug === pid)

  if (redirectItem) {
    redirect(redirectItem.url)
  }

  return (
    <div className="w-full flex items-center justify-center p-20">
      <h2>Link not found</h2>
    </div>
  )
}

export default Links

export async function generateStaticParams() {
  return getRedirects().map((item) => ({ slug: `/link/${item.slug}` }))
}
