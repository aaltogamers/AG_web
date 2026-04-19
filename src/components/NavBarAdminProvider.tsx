'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { checkAdminSession } from '../utils/adminAuth'

type Status = boolean | null

const NavBarAdminContext = createContext<Status>(null)

export const NavBarAdminProvider = ({ children }: { children: ReactNode }) => {
  const [isAdmin, setIsAdmin] = useState<Status>(null)

  useEffect(() => {
    void checkAdminSession().then(setIsAdmin)
  }, [])

  return (
    <NavBarAdminContext.Provider value={isAdmin}>
      {children}
    </NavBarAdminContext.Provider>
  )
}

/** `true` when session is admin; `null` while checking; `false` otherwise. */
export const useNavBarAdmin = (): Status => useContext(NavBarAdminContext)
