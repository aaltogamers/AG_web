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
  isHost,
  myPlayer,
  onDisconnect,
  PlayerState,
  useIsHost,
  useMultiplayerState,
  usePlayersList,
  waitForPlayerState,
  waitForState,
} from 'playroomkit'
import { useParams } from 'next/navigation'
import Layout from '../components/Layout'
import { bigAccumulator, bigCooldown, smallAccumulator, smallCooldown } from './constants'
import { bootRef } from './rpc'

const isMobile = /iPhone|Android/i.test(navigator.userAgent)

export let playerList: PlayerState[] = []

const getScale = () => {
  if (isMobile) {
    console.log('mobile')
    return {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 1920,
      height: 1080,
    }
  }

  return {
    scale: {
      autoCenter: Phaser.Scale.CENTER_BOTH,
      mode: Phaser.Scale.FIT,
      expandParent: true,
      width: 1920,
      height: 1080,
      max: {
        width: Math.min(window.innerWidth, window.innerHeight * (16 / 9)),
        height: Math.min(window.innerHeight, window.innerWidth * (9 / 16)),
      },
    },
  }
}

const startGame = () => {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: 'game-container',
    ...getScale(),
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
  const [error, setError] = useState<string | undefined>(undefined)
  const [launched, _] = useMultiplayerState('launched', false)
  const useHost = useIsHost()
  const commonMargins = 'mt-1 mb-1'
  let approved = false
  let waitForHost = connected && !useHost && !launched

  const players = usePlayersList()
  const params = useParams()

  const tryJoin = async (skipCheck?: boolean) => {
    const waitForApprove = () => {
      if (!isHost() && !launched && !skipCheck) {
        return
      } else if (players.some((a) => a.getState('name') == name && a.id != myPlayer().id)) {
        setError('Name already taken')
        return
      } else if (!skipCheck) {
        myPlayer().setState('name', name, true)
        setTimeout(() => {
          if (!approved) {
            myPlayer().leaveRoom()
            setError('Connecting timed out')
          }
        }, 2000)
      }

      if (isHost()) {
        waitForPlayerState(myPlayer(), 'name', () => {
          setReady(true)
          setError(undefined)
          setConnected(false)

          approved = true
        })
      } else {
        if (getState(myPlayer().id)) {
          setReady(true)
          setError(undefined)
          setConnected(false)
          approved = true
        } else {
          waitForState(myPlayer().id, (value) => {
            if (value) {
              setReady(true)
              setError(undefined)
              setConnected(false)
              approved = true
            }
          })
        }
      }
    }

    if (!skipCheck) {
      if (roomcode == '') {
        setError('Room code must be atleast 1 character')
        return
      }
      if (name == '') {
        setError('Name must be atleast 1 character')
      }
      if (getRoomCode() == roomcode && name != '') {
        waitForApprove()
        return
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
        pos: { x: 940, y: 540 },
        selected: 0,
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
        paused: false,
        shields: [],
        ready: [],
      },
    })
      .then(() => {
        if (name != '') {
          setError(undefined)
          setConnected(true)
          waitForApprove()
        } else if (skipCheck) {
          setConnected(true)
          setError(undefined)
          waitForApprove()
        } else {
          setConnected(true)
          setError(undefined)
        }
        onDisconnect(() => {
          setReady(false)
          setConnected(false)
          approved = false
        })
      })
      .catch((e) => {
        if (e.message === 'ROOM_LIMIT_EXCEEDED') {
          setError(`Room full`)
        } else if (e.message === 'PLAYER_LEAVED') {
          setTimeout(() => tryJoin(true), 3500)
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

  useEffect(() => {
    playerList = players
    bootRef?.reSyncPlayers(players)
  }, [players])

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
                disabled={connected || error == 'Connecting ...'}
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
                disabled={error == 'Connecting ...'}
              />
              <button
                className={`text-1xl font-medium rounded-md ${error == 'Connecting ...' || waitForHost ? 'bg-gray-500 ' : 'bg-gray-700/70 hover:text-green-500 hover:cursor-pointer'} p-1 px-4 ${commonMargins} `}
                type="submit"
                disabled={error == 'Connecting ...' || waitForHost}
              >
                {waitForHost ? 'Wait for the host to launch' : 'Play'}
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
