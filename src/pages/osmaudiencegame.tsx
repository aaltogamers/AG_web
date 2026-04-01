'use client'

import dynamic from 'next/dynamic'

const AudienceGame = dynamic(() => import('../game/AudienceGame'), { ssr: false })

const OSMAudienceGame = () => {
  return (
    <div>
      <AudienceGame />
    </div>
  )
}

export default OSMAudienceGame
