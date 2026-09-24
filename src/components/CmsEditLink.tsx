'use client'

import { ReactNode } from 'react'
import { FaEdit } from 'react-icons/fa'
import { useNavBarAdmin } from './NavBarAdminProvider'

type ButtonProps = {
  href: string
  label: string
}

/** Styled edit button; render inside CmsEditLink so it is only shown to admins. */
export const AdminLinkButton = ({ href, label }: ButtonProps) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="flex items-center gap-2 border border-lightgray rounded-md px-3 py-1 text-sm hover:border-red"
  >
    <FaEdit size={12} />
    {label}
  </a>
)

type Props = {
  // Decap CMS route, e.g. `collections/event/entries/my-event` (see public/cms/config.yml)
  cmsPath: string
  label: string
  className?: string
  // Extra AdminLinkButtons shown on the same row
  children?: ReactNode
}

/** Small "edit in CMS" button, only shown to logged-in admins. */
const CmsEditLink = ({ cmsPath, label, className = '', children }: Props) => {
  const isAdmin = useNavBarAdmin()
  if (isAdmin !== true) return null

  return (
    <div className={`flex flex-wrap justify-center gap-2 ${className}`}>
      <AdminLinkButton href={`/cms/#/${cmsPath}`} label={label} />
      {children}
    </div>
  )
}

export default CmsEditLink
