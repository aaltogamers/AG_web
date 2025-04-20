import { useMultiplayerState, insertCoin, myPlayer } from 'playroomkit'
import { IRefPhaserGame } from '../game/AudienceGame'
import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'

const AudienceGame = dynamic(() => import('../game/AudienceGame'), { ssr: false })

const OSMAudienceGame = () => {
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    insertCoin().then(() => setLoaded(true))
  }, [])
  const [currentLetter, setCurrentLetter] = useMultiplayerState<
    { value: string; id: string; name: string }[]
  >('letter', [])
  const handleClick = () => {
    setCurrentLetter([
      ...currentLetter,
      { value: 'a', id: myPlayer().id, name: myPlayer().getProfile().name },
    ])
  }
  const phaserRef = useRef<IRefPhaserGame | null>(null)
  const currentScene = (scene: Phaser.Scene) => {}

  if (!loaded && myPlayer()?.getProfile() === undefined) return null

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <button onClick={handleClick}>aa</button>
      {currentLetter.map((a, i) => (
        <li>
          {a.value}, {a.name}, {i}
        </li>
      ))}

      <AudienceGame ref={phaserRef} currentActiveScene={currentScene} />
    </div>
  )
}

export default OSMAudienceGame
