'use client'

import { FaEdit } from 'react-icons/fa'
import { useNavBarAdmin } from './NavBarAdminProvider'

type Props = {
  // Decap CMS route, e.g. `collections/event/entries/my-event` (see public/cms/config.yml)
  cmsPath: string
  label: string
  className?: string
}

/** Small "edit in CMS" button, only shown to logged-in admins. */
const CmsEditLink = ({ cmsPath, label, className = '' }: Props) => {
  const isAdmin = useNavBarAdmin()
  if (isAdmin !== true) return null

  return (
    <div className={`flex justify-center ${className}`}>
      <a
        href={`/cms/#/${cmsPath}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 border border-lightgray rounded-md px-3 py-1 text-sm hover:border-red"
      >
        <FaEdit size={12} />
        {label}
      </a>
    </div>
  )
}

export default CmsEditLink
