import Head from 'next/head'
import { useEffect } from 'react'
import { useLiveMapBans } from '../utils/live'
import makeBackgroundInvisible from '../utils/makeBackgroundInvisible'
import MapBans from '../components/MapBans'

const MapBan = () => {
  const { mapBanInfo, mapBans, maps } = useLiveMapBans()

  useEffect(() => {
    makeBackgroundInvisible()
  }, [])

  return (
    <>
      <Head>
        <title>Map Bans - Aalto Gamers</title>
      </Head>
      <main className="flex flex-col justify-end h-[100vh]">
        <MapBans mapBanInfo={mapBanInfo} mapBans={mapBans} maps={maps} showAll={false} />
      </main>
    </>
  )
}

export default MapBan
