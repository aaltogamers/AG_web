import { getFile } from '../../../utils/fileUtils'
import { redirect } from 'next/navigation'

type Redirect = {
  name: string
  slug: string
  url: string
}

type Props = {
  params: Promise<{ pid: string }>
}

const Links = async ({ params }: Props) => {
  const pid = (await params).pid
  const { redirects } = getFile('redirects', './public/') as unknown as { redirects: Redirect[] }
  const redirectItem = redirects.find((r) => r.slug === pid)

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
  const { redirects } = getFile('redirects', './public/') as unknown as { redirects: Redirect[] }
  return redirects.map((item) => ({ slug: `/link/${item.slug}` }))
}
