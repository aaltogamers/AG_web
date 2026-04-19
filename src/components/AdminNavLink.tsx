'use client'

import Link from 'next/link'
import { useNavBarAdmin } from './NavBarAdminProvider'

type Props = {
  className?: string
  onNavigate?: () => void
}

const AdminNavLink = ({ className, onNavigate }: Props) => {
  const isAdmin = useNavBarAdmin()
  if (isAdmin !== true) return null

  return (
    <Link href="/admin/signups" className={className} onClick={onNavigate}>
      ADMIN
    </Link>
  )
}

export default AdminNavLink
