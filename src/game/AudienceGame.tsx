'use client'

import Phaser from 'phaser'
import { Boot } from './scenes/Boot'
import { Preloader } from './scenes/Preloader'
import { useEffect, useLayoutEffect, useState } from 'react'
import { MainMenu } from './scenes/MainMenu'
import {
  getRoomCode,
  getState,
  insertCoin,
  myPlayer,
  onDisconnect,
  setState,
  usePlayersList,
} from 'playroomkit'
import { useParams } from 'next/navigation'
import Layout from '../components/Layout'
import { bigAccumulator, bigCooldown, smallAccumulator, smallCooldown } from './constants'

const startGame = () => {
  const config = {
    type: Phaser.AUTO,
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1920,
    height: 1080,
    parent: 'game-container',
    scene: [Boot, Preloader, MainMenu],
    physics: {
      default: 'matter',
      matter: {
        gravity: { x: 0, y: 0 },
      },
    },
  }
  return new Phaser.Game(config)
}

const AudienceGame = () => {
  const [roomcode, setRoomcode] = useState('')
  const [connected, setConnected] = useState(false)
  const [name, setName] = useState('')
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const commonMargins = 'mt-1 mb-1'

  const players = usePlayersList()
  const params = useParams()

  const tryJoin = async (skipCheck?: boolean) => {
    const success = () => {
      setReady(true)
      setError(null)
      setConnected(false)
    }

    if (!skipCheck) {
      if (roomcode == '') {
        setError('Room code must be atleast 1 character')
        return
      }
      if (getRoomCode() == roomcode && name != '') {
        if (players.find((a) => a.getState('name') == name)) {
          setError('Name already taken')
          return
        }
        myPlayer().setState('name', name)
        setState(myPlayer().id, name)
        success()

        return
      }
      if (name == '') {
        setError('Name must be atleast 1 character')
      }
    }
    if (!connected) {
      setError('Connecting ...')
    }
    await insertCoin({
      skipLobby: true,
      maxPlayersPerRoom: 14,
      reconnectGracePeriod: 3000,
      roomCode: roomcode,
      defaultPlayerStates: {
        ready: false,
        joystick: { x: 0, y: 0, force: 0 },
        points: 0,
        name: '',
        active: true,
      },
      defaultStates: {
        alivePlayers: [],
        picked: [],
        gameActive: false,
        gameWon: false,
        winner: '',
        originalHostID: '',
        spectators: [],
        smallSpell: smallCooldown[0],
        bigSpell: bigCooldown[0],
        smallAccumulator: smallAccumulator,
        bigAccumulator: bigAccumulator,
        points: 0,
        winPoints: 0,
        difficulty: 0,
      },
    })
      .then(() => {
        if (getState(myPlayer().id)) {
          myPlayer().setState('name', getState(myPlayer().id))
          success()
        } else if (name != '') {
          if (players.find((a) => a.getState('name') == name)) {
            setError('Name already taken')
            return
          }
          myPlayer().setState('name', name)
          setState(myPlayer().id, name)
          success()
        } else {
          setError(null)
          setConnected(true)
        }
        onDisconnect(() => {
          setReady(false)
          setConnected(false)
        })
      })
      .catch((e) => {
        if (e.message === 'ROOM_LIMIT_EXCEEDED') {
          setError(`Room full`)
        } else if (e.message === 'PLAYER_LEAVED') {
          setError('Please wait 3 seconds before reconnecting')
        }
      })
  }

  useEffect(() => {
    const hash = window.location.hash
    if (hash != '' && !getRoomCode()) {
      setRoomcode(hash.slice(4))
      tryJoin(true)
    } else {
      setReady(false)
    }
  }, [params])

  useLayoutEffect(() => {
    if (ready) {
      startGame()
    }
  }, [ready])

  return (
    <div>
      {!ready ? (
        <Layout>
          <div className="w-full flex justify-center flex-col items-center mt-30">
            {error && (
              <div
                className={`text-1xl  font-medium text-red-100 p-2 rounded-md ${commonMargins} bg-red-500/50 `}
              >
                {error}
              </div>
            )}
            {connected ? (
              <div
                className={`text-1xl font-medium text-green-600 ${commonMargins} flex flex-col `}
              >
                Connected to room {getRoomCode()} ({players.length}/14 in room)
                <button
                  className={`text-1xl font-medium rounded-md bg-gray-700/70 px-1 mx-1 ${commonMargins} hover:text-green-500 hover:cursor-pointer `}
                  onClick={() => myPlayer().leaveRoom()}
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <div className={`text-1xl font-medium  ${commonMargins}`}>Room code</div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                tryJoin()
              }}
              className="w-full flex justify-center flex-col items-center"
            >
              <input
                disabled={connected}
                type="text"
                className={`p-2 rounded-md ${commonMargins} w-70 ${connected ? 'bg-gray-400' : 'bg-white '}`}
                value={roomcode}
                onChange={(e) => setRoomcode(e.target.value.toUpperCase())}
                placeholder="Room code"
              />
              <div className={`text-1xl font-medium  ${commonMargins} rounded-md`}>Name (1-12)</div>
              <input
                type="text"
                className={`p-2 rounded-md ${commonMargins} w-70 bg-white`}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name"
                value={name}
                minLength={1}
                maxLength={12}
              />
              <button
                className={`text-1xl font-medium rounded-md bg-gray-700/70 p-1 px-4 ${commonMargins} hover:text-green-500 hover:cursor-pointer`}
                type="submit"
              >
                Play
              </button>
            </form>
          </div>
        </Layout>
      ) : (
        <div id="game-container"></div>
      )}
    </div>
  )
}

export default AudienceGame
