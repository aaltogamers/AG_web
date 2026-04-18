import { useEffect, useState } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'
import Link from 'next/link'
import { Game, MapName } from '../types/types'
import { useLiveMapBans } from '../utils/live'
import Input from './Input'
import MapBans from './MapBans'

const postMapBan = async (body: {
  map: MapName
  type: 'ban' | 'pick' | 'decider'
  team: 'team1' | 'team2'
}): Promise<void> => {
  await fetch('/api/mapbans', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  })
}

const deleteMapBan = async (map: MapName): Promise<void> => {
  await fetch(`/api/mapbans?map=${encodeURIComponent(map)}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  })
}

const resetAllBans = async (): Promise<void> => {
  await fetch('/api/mapbans', { method: 'DELETE', credentials: 'same-origin' })
}

const updateMapBanInfo = async (body: {
  team1?: string
  team2?: string
  game?: Game
}): Promise<void> => {
  await fetch('/api/mapban-info', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  })
}

const MapBanMangement = () => {
  const { mapBans, mapBanInfo, maps } = useLiveMapBans()

  const [host, setHost] = useState('')
  useEffect(() => {
    if (typeof window !== 'undefined') setHost(window.location.host)
  }, [])

  const { register, handleSubmit, control, setValue } = useForm()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onSubmit: SubmitHandler<any> = async (data) => {
    await updateMapBanInfo({ team1: data.team1, team2: data.team2 })
  }

  const handleResetBans = async () => {
    if (confirm('Are you sure you want to reset all bans?')) {
      await resetAllBans()
    }
  }

  const switchGame = async () => {
    const currentGame = mapBanInfo?.game
    const otherGame: Game = currentGame === 'CS 2' ? 'Valorant' : 'CS 2'
    if (confirm(`Are you sure you want to switch the game switch to ${otherGame}?`)) {
      await updateMapBanInfo({ game: otherGame })
    }
  }

  useEffect(() => {
    setValue('team1', mapBanInfo?.team1 ?? '')
    setValue('team2', mapBanInfo?.team2 ?? '')
  }, [mapBanInfo?.team1, mapBanInfo?.team2, setValue])

  return (
    <main className="flex flex-col">
      <div className="mb-4 text-lg text-left">
        <p>
          Map bans can be seen at{' '}
          <Link href="/mapban" className="text-red" target="_blank" rel="noopener noreferrer">
            {host}/mapban
          </Link>
        </p>
      </div>
      <h3 className="text-center">Current game is {mapBanInfo?.game}</h3>
      <div className="flex flex-row justify-between m-16">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-row gap-16">
          <div className="w-80">
            <Input
              register={register}
              name="team1"
              displayName="Team 1 name"
              placeHolder="Natus Vincere"
              type="text"
              required
              control={control}
            />
          </div>

          <div className="w-80">
            <Input
              register={register}
              name="team2"
              displayName="Team 2 name"
              placeHolder="Fnatic"
              type="text"
              required
              control={control}
            />
          </div>
          <button type="submit" className="mainbutton ml-4 h-16 mt-7">
            Update team names
          </button>
        </form>
        <button className="mainbutton h-16 mt-7" onClick={switchGame}>
          Switch game
        </button>
        <button className="mainbutton h-16 mt-7" onClick={handleResetBans}>
          Reset all bans
        </button>
      </div>
      <div className="text-white flex flex-row text-4xl gap-14 justify-center mx-14">
        {maps.map((mapName) => {
          return (
            <div
              className="flex  flex-col w-full text-center mb-8 text-[1.2rem] gap-4"
              key={mapName}
            >
              <button className=" bg-red p-2 rounded-sm" onClick={() => deleteMapBan(mapName)}>
                Reset
              </button>
              <button
                className=" bg-red p-2 rounded-sm"
                onClick={() => postMapBan({ map: mapName, type: 'ban', team: 'team1' })}
              >
                {mapBanInfo?.team1} BAN
              </button>
              <button
                className="bg-green-800 p-2 rounded-sm"
                onClick={() => postMapBan({ map: mapName, type: 'pick', team: 'team1' })}
              >
                {mapBanInfo?.team1} PICK
              </button>
              <button
                className="bg-red p-2 rounded-sm"
                onClick={() => postMapBan({ map: mapName, type: 'ban', team: 'team2' })}
              >
                {mapBanInfo?.team2} BAN
              </button>
              <button
                className="bg-green-800 p-2 rounded-sm"
                onClick={() => postMapBan({ map: mapName, type: 'pick', team: 'team2' })}
              >
                {mapBanInfo?.team2} PICK
              </button>
            </div>
          )
        })}
      </div>
      <MapBans mapBanInfo={mapBanInfo} mapBans={mapBans} maps={maps} />
    </main>
  )
}

export default MapBanMangement
