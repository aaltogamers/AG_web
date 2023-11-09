import { collection, Firestore, getDocs, query, where } from 'firebase/firestore'
import { Poll, Vote } from '../types/types'

export const getParticipants = async (db: Firestore, eventName: string) => {
  const q = query(collection(db, 'signups'), where('event', '==', eventName))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
}

export const getPolls = async (db: Firestore) => {
  const q = query(collection(db, 'polls'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as Poll[]
}

export const getVisiblePoll = async (db: Firestore) => {
  const q = query(collection(db, 'polls'), where('isVisible', '==', true))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))[0] as Poll | undefined
}

export const getVotesForPoll = async (db: Firestore, pollId: string) => {
  const q = query(collection(db, 'votes'), where('poll', '==', pollId))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as unknown as Vote[]
}

export const firebaseConfig = {
  apiKey: 'AIzaSyAWhfwD5GSsgZ8qzNyvn2kmNn3yVu0QaHY',
  authDomain: 'ag-web-ab4d9.firebaseapp.com',
  projectId: 'ag-web-ab4d9',
  storageBucket: 'ag-web-ab4d9.appspot.com',
  messagingSenderId: '477042062646',
  appId: '1:477042062646:web:ceb714216dc980f72b2f97',
}
