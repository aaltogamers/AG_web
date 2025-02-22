/* eslint-disable react-hooks/exhaustive-deps */
import { FirebaseApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import {
  collection,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  QueryFieldFilterConstraint,
  where,
  Firestore,
  doc,
} from 'firebase/firestore'
import { useEffect, useState } from 'react'
import {
  CS_ACTIVE_DUTY_MAPS,
  MapBanInfo,
  MapBanOrPick,
  Poll,
  VALORANT_ACTIVE_DUTY_MAPS,
  Vote,
} from '../types/types'

export const getParticipants = async (db: Firestore, eventName: string) => {
  const q = query(collection(db, 'signups'), where('event', '==', eventName))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
}

const loginIfNotLoggedIn = async (app: FirebaseApp) => {
  const db = getFirestore(app)
  const auth = getAuth(app)
  if (!auth.currentUser) {
    await signInWithEmailAndPassword(auth, 'guest@aaltogamers.fi', 'aaltogamerpassword')
  }
  return { db }
}

export const useFirestore = (
  app: FirebaseApp,
  collectionName: 'polls' | 'votes' | 'mapbans' | 'analytics',
  constraint?: QueryFieldFilterConstraint
) => {
  const [items, setItems] = useState<object[]>([])
  useEffect(() => {
    const inner = async () => {
      const { db } = await loginIfNotLoggedIn(app)
      const q = constraint
        ? query(collection(db, collectionName), constraint)
        : collection(db, collectionName)
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const newItems = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
        setItems(newItems)
      })
      return () => unsubscribe()
    }
    inner()
  }, [])
  return items
}

export const useVisiblePollAndVotes = (app: FirebaseApp) => {
  const [visiblePoll, setVisiblePoll] = useState<Poll | undefined>(undefined)
  const [votesForPoll, setVotesForPoll] = useState<Vote[]>([])

  useEffect(() => {
    const inner = async () => {
      const { db } = await loginIfNotLoggedIn(app)
      const q = query(collection(db, 'polls'), where('isVisible', '==', true))
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const visiblePoll = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }))[0] as Poll
        setVisiblePoll(visiblePoll)
        //console.log(new Date())
      })
      return () => unsubscribe()
    }
    inner()
  }, [])

  useEffect(() => {
    const inner = async () => {
      if (visiblePoll) {
        const { db } = await loginIfNotLoggedIn(app)
        const q = query(collection(db, 'votes'), where('poll', '==', visiblePoll.id))
        const unsubscribe = onSnapshot(q, (snapshot) => {
          const votes = snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          })) as Vote[]
          setVotesForPoll(votes)
          // console.log(new Date())
        })
        return () => unsubscribe()
      } else {
        return
      }
    }
    inner()
  }, [visiblePoll])
  return { visiblePoll, votesForPoll }
}

export const useMapBanStatus = (app: FirebaseApp) => {
  const [mapBans, setMapBans] = useState<MapBanOrPick[]>([])
  const [mapBanInfo, setMapBanInfo] = useState<MapBanInfo | null>(null)

  useEffect(() => {
    const inner = async () => {
      const { db } = await loginIfNotLoggedIn(app)
      const q = query(collection(db, 'mapbans'))
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const mapBans = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as MapBanOrPick[]

        setMapBans(mapBans)
      })
      return () => unsubscribe()
    }
    inner()
  }, [])

  useEffect(() => {
    const inner = async () => {
      const { db } = await loginIfNotLoggedIn(app)
      const q = doc(db, 'mapbaninfo', 'mapbaninfo')
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const newMapBanInfo = snapshot.data() as MapBanInfo

        setMapBanInfo(newMapBanInfo)
      })
      return () => unsubscribe()
    }
    inner()
  }, [])

  const maps =
    mapBanInfo?.game === 'Valorant' ? [...VALORANT_ACTIVE_DUTY_MAPS] : [...CS_ACTIVE_DUTY_MAPS]

  console.log(maps)

  return { mapBans, mapBanInfo, maps }
}

export const getVotesForPoll = async (db: Firestore, pollId: string) => {
  const q = query(collection(db, 'votes'), where('poll', '==', pollId))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as Vote[]
}

export const firebaseConfig = {
  apiKey: 'AIzaSyAWhfwD5GSsgZ8qzNyvn2kmNn3yVu0QaHY',
  authDomain: 'ag-web-ab4d9.firebaseapp.com',
  projectId: 'ag-web-ab4d9',
  storageBucket: 'ag-web-ab4d9.appspot.com',
  messagingSenderId: '477042062646',
  appId: '1:477042062646:web:ceb714216dc980f72b2f97',
}
