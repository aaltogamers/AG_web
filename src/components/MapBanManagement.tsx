import { FirebaseApp } from 'firebase/app'
import { getFirestore, doc, updateDoc, deleteDoc, addDoc, collection } from 'firebase/firestore'
import { useEffect } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'
import { CS_ACTIVE_DUTY_MAPS, MapBanOrPick, MapName } from '../types/types'
import { useMapBanStatus } from '../utils/db'
import Input from './Input'
import MapBans from './MapBans'
type Props = {
  app: FirebaseApp
}

const MapBanMangement = ({ app }: Props) => {
  const db = getFirestore(app)
  const { mapBans, mapBanInfo } = useMapBanStatus(app)

  const { register, handleSubmit, control, setValue } = useForm()

  const onSubmit: SubmitHandler<any> = async (data) => {
    await updateDoc(doc(db, 'mapbaninfo', 'mapbaninfo'), {
      team1: data.team1,
      team2: data.team2,
    })
  }

  const addPickOrBan = async (
    map: MapName,
    type: 'pick' | 'ban' | 'decider',
    team: 'team1' | 'team2'
  ) => {
    const existingBan = mapBans.find((mapBan) => mapBan.map === map)
    const newContent: Omit<MapBanOrPick, 'id'> = {
      map,
      type,
      team,
      index: mapBans.length,
    }

    if (existingBan) {
      await updateDoc(doc(db, 'mapbans', existingBan.id), newContent)
    } else {
      await addDoc(collection(db, 'mapbans'), newContent)

      const isLastBan = mapBans.length === 5
      if (isLastBan) {
        const remainingMap = CS_ACTIVE_DUTY_MAPS.filter(
          (map) => !mapBans.map((mapBan) => mapBan.map).includes(map)
        )
        const remainingMapName = remainingMap[0]
        await addDoc(collection(db, 'mapbans'), {
          map: remainingMapName,
          type: 'decider',
          team: 'team1',
          index: 6,
        })
      }
    }
  }

  const deleteBan = async (map: string) => {
    const banToDelete = mapBans.find((mapBan) => mapBan.map === map)
    if (banToDelete) {
      await deleteDoc(doc(db, 'mapbans', banToDelete.id))
    }
  }

  const resetBans = async () => {
    const shouldReset = confirm(`Are you sure you want to reset all bans?`)
    if (shouldReset) {
      for await (const mapBan of mapBans) {
        await deleteDoc(doc(db, 'mapbans', mapBan.id))
      }
    }
  }

  useEffect(() => {
    setValue('team1', mapBanInfo?.team1)
    setValue('team2', mapBanInfo?.team2)
  }, [mapBanInfo?.team1, mapBanInfo?.team2])

  return (
    <main className="flex flex-col">
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
          <button type="submit" className="mainbutton ml-4 h-16 mt-4">
            Update team names
          </button>
        </form>
        <button className="mainbutton ml-16 h-16 mt-4" onClick={resetBans}>
          Reset all bans
        </button>
      </div>
      <div className="text-white flex flex-row text-4xl gap-14 justify-center mx-14">
        {CS_ACTIVE_DUTY_MAPS.map((mapName) => {
          return (
            <div className="flex  flex-col w-full text-center mb-8 text-[1.2rem] gap-4">
              <button className=" bg-red p-2 rounded-sm" onClick={() => deleteBan(mapName)}>
                Reset
              </button>
              <button
                className=" bg-red p-2 rounded-sm"
                onClick={() => addPickOrBan(mapName, 'ban', 'team1')}
              >
                {mapBanInfo?.team1} BAN
              </button>
              <button
                className="bg-green-800 p-2 rounded-sm"
                onClick={() => addPickOrBan(mapName, 'pick', 'team1')}
              >
                {mapBanInfo?.team1} PICK
              </button>
              <button
                className="bg-red p-2 rounded-sm"
                onClick={() => addPickOrBan(mapName, 'ban', 'team2')}
              >
                {mapBanInfo?.team2} BAN
              </button>
              <button
                className="bg-green-800 p-2 rounded-sm"
                onClick={() => addPickOrBan(mapName, 'pick', 'team2')}
              >
                {mapBanInfo?.team2} PICK
              </button>
            </div>
          )
        })}
      </div>
      <MapBans mapBanInfo={mapBanInfo} mapBans={mapBans} />
    </main>
  )
}

export default MapBanMangement
