import {
  collection,
  Firestore,
  getDocs,
  onSnapshot,
  query,
  QueryFieldFilterConstraint,
  where,
} from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { Poll, Vote } from '../types/types'

export const getParticipants = async (db: Firestore, eventName: string) => {
  const q = query(collection(db, 'signups'), where('event', '==', eventName))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
}

export const useFirestore = (
  db: Firestore,
  collectionName: 'polls' | 'votes',
  constraint?: QueryFieldFilterConstraint
) => {
  const [items, setItems] = useState<Object[]>([])
  useEffect(() => {
    const q = constraint
      ? query(collection(db, collectionName), constraint)
      : collection(db, collectionName)
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newItems = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
      setItems(newItems)
      //console.log(new Date())
    })
    return () => unsubscribe()
  }, [])
  return items
}

export const useVisiblePollAndVotes = (db: Firestore) => {
  const [visiblePoll, setVisiblePoll] = useState<Poll | undefined>(undefined)
  const [votesForPoll, setVotesForPoll] = useState<Vote[]>([])

  useEffect(() => {
    const q = query(collection(db, 'polls'), where('isVisible', '==', true))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const visiblePoll = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))[0] as Poll
      setVisiblePoll(visiblePoll)
      //console.log(new Date())
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (visiblePoll) {
      const q = query(collection(db, 'votes'), where('poll', '==', visiblePoll.id))
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const votes = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as Vote[]
        setVotesForPoll(votes)
        //console.log(new Date())
      })
      return () => unsubscribe()
    } else {
      return
    }
  }, [visiblePoll])
  return { visiblePoll, votesForPoll }
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
