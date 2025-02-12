import { FirebaseApp } from 'firebase/app'
import { useFirestore } from '../utils/db'
import React from 'react'

type Props = {
  app: FirebaseApp
}

type Analytic = {
  id: string
  isDev: boolean
  path: string
  timestamp: {
    seconds: number
    nanoseconds: number
  }
}

const SiteStatistics = ({ app }: Props) => {
  const analytics = useFirestore(app, 'analytics') as Analytic[]

  const nonDevAnalytics = analytics.filter((analytic) => !analytic.isDev)

  const counts: { [key: string]: number } = {}

  nonDevAnalytics.forEach((analytic) => {
    const path = analytic.path
    if (!counts[path]) {
      counts[path] = 0
    }
    counts[path]++
  })

  return (
    <div className="grid" style={{ gridTemplateColumns: 'auto 1fr' }}>
      {Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([path, count]) => (
          <React.Fragment key={path}>
            <span className=" text-right pr-10">{count}</span> <span>{path}</span>
          </React.Fragment>
        ))}
    </div>
  )
}

export default SiteStatistics
