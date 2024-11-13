import Head from 'next/head'
import { useEffect } from 'react'
import { firebaseConfig, useMapBanStatus } from '../utils/db'
import { initializeApp } from 'firebase/app'
import makeBackgroundInvisible from '../utils/makeBackgroundInvisible'
import MapBans from '../components/MapBans'

const MapBan = () => {
  const app = initializeApp(firebaseConfig)
  const { mapBanInfo, mapBans } = useMapBanStatus(app)

  useEffect(() => {
    makeBackgroundInvisible()
  }, [])

  return (
    <>
      <Head>
        <title>Map Bans - Aalto Gamers</title>
      </Head>
      <main className="flex flex-col justify-end h-[100vh]">
        <MapBans mapBanInfo={mapBanInfo} mapBans={mapBans} showAll={false} />
      </main>
    </>
  )
}

export default MapBan
