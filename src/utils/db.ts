import { collection, Firestore, getDocs, query, where } from 'firebase/firestore'

export const getParticipants = async (db: Firestore, eventName: string) => {
  const q = query(collection(db, 'signups'), where('event', '==', eventName))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
}
