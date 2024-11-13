import { CS_ACTIVE_DUTY_MAPS, MapBanInfo, MapBanOrPick } from '../types/types'
import ImageThatWorksWithPreview from './ImageThatWorksWithPreview'

type Props = {
  mapBanInfo: MapBanInfo | null
  mapBans: MapBanOrPick[]
}

const MapBans = ({ mapBanInfo, mapBans }: Props) => {
  return (
    <div className="text-black flex flex-row text-4xl gap-14 justify-center mx-14 basis-1 flex-1 flex-grow-0">
      {CS_ACTIVE_DUTY_MAPS.map((mapName) => {
        const mapBan = mapBans.find((mapBan) => mapBan.map === mapName)
        const textColor = mapBan?.type === 'ban' ? 'red' : 'green-700'
        const teamWhoBanned = mapBan?.team === 'team1' ? mapBanInfo?.team1 : mapBanInfo?.team2
        const opacity = mapBan?.type === 'ban' ? 0.7 : 0.3

        return (
          <div className="flex flex-col justify-end text-center font-blockletter min-w-0 mb-8">
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
                className="h-40 object-cover"
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default MapBans
