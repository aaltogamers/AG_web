import moment, { Moment } from 'moment'
import { useEffect, useState } from 'react'

/**
 * The current time, or null during server rendering and the first client render.
 * Event pages are built at deploy time, so anything time-dependent (like whether
 * sign-up is open) has to be decided in the browser.
 */
export const useNow = (refreshMs = 60_000): Moment | null => {
  const [now, setNow] = useState<Moment | null>(null)
  useEffect(() => {
    setNow(moment())
    const interval = setInterval(() => setNow(moment()), refreshMs)
    return () => clearInterval(interval)
  }, [refreshMs])
  return now
}
