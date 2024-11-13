import { useEffect, useState } from 'react'
import { CS_ACTIVE_DUTY_MAPS, MapBanInfo, MapBanOrPick, MapName } from '../types/types'
import ImageThatWorksWithPreview from './ImageThatWorksWithPreview'

type Props = {
  mapBanInfo: MapBanInfo | null
  mapBans: MapBanOrPick[]
  showAll?: boolean
}

const MapBans = ({ mapBanInfo, mapBans, showAll = true }: Props) => {
  const [maps, setMaps] = useState<MapName[]>([...CS_ACTIVE_DUTY_MAPS])

  useEffect(() => {
    if (!showAll) {
      const bannedMaps = mapBans.sort((a, b) => a.index - b.index).map((mapBan) => mapBan.map)
      const remainingMaps = CS_ACTIVE_DUTY_MAPS.filter((map) => !bannedMaps.includes(map))
      setMaps([...bannedMaps, ...remainingMaps])
    }
  }, [mapBans, showAll, mapBanInfo])

  return (
    <div className="text-black flex flex-row text-4xl gap-14 justify-center mx-14 basis-1 flex-1 flex-grow-0">
      {maps.map((mapName) => {
        const mapBan = mapBans.find((mapBan) => mapBan.map === mapName)
        const textColor = mapBan?.type === 'ban' ? 'red' : 'green-700'
        const teamWhoBanned = mapBan?.team === 'team1' ? mapBanInfo?.team1 : mapBanInfo?.team2
        const opacity = mapBan?.type === 'ban' ? 0.7 : 0.3
        const visibility = showAll || mapBan ? 'visible' : 'hidden'

        return (
          <div
            className="flex flex-col justify-end text-center font-blockletter min-w-0 mb-8 fade-in"
            style={{ visibility }}
            key={mapName + visibility}
          >
            {mapBan && <h2 className={`py-1 bg-black text-${textColor}`}>{mapBan.type}</h2>}
            <h2 className="py-1 bg-white">{mapName}</h2>
            <div className="relative">
              {mapBan && (
                <div
                  className={`absolute text-white w-full h-full flex flex-col justify-center`}
                  style={{ backgroundColor: `rgba(28,29,38,${opacity})` }}
                >
                  <h2>{mapBan.type !== 'decider' ? teamWhoBanned : ''} </h2>
                </div>
              )}
              <ImageThatWorksWithPreview
                src={`/images/${mapName}.jpg`}
                alt={mapName}
                isPreview={false}
                className="h-40 object-cover text-green-700 "
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default MapBans
