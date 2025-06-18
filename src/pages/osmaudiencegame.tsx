import { IRefPhaserGame } from '../game/AudienceGame'
import { useRef } from 'react'
import dynamic from 'next/dynamic'

const AudienceGame = dynamic(() => import('../game/AudienceGame'), { ssr: false })

const OSMAudienceGame = () => {
  const phaserRef = useRef<IRefPhaserGame | null>(null)
  const currentScene = (scene: Phaser.Scene) => {}

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <AudienceGame ref={phaserRef} currentActiveScene={currentScene} />
    </div>
  )
}

export default OSMAudienceGame
