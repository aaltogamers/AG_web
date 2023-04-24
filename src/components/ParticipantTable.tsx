import { deleteDoc, doc, Firestore, Timestamp } from 'firebase/firestore'
import { Data, DataValue, SignUpData } from '../types/types'

type Props = {
  participants: Data[]
  signupData: SignUpData
  showPrivateData?: boolean
  allowEdit?: boolean
  db?: Firestore
  setParticipants?: (participants: Data[]) => void
}

const ParticipantTable = ({
  participants,
  signupData,
  showPrivateData,
  allowEdit,
  db,
  setParticipants,
}: Props) => {
  const participantHeaders = Object.keys(participants[0] || [])
    .filter((key) => {
      const isPublic = signupData?.inputs.find((item) => item.title === key)?.public
      return (showPrivateData || isPublic) && key !== 'event' && key !== 'id'
    })
    .sort(
      (a, b) =>
        (signupData?.inputs.findIndex((item) => item.title === a) || 0) -
        (signupData?.inputs.findIndex((item) => item.title === b) || 0)
    )
  const parseParticipantData = (dataValue: DataValue, header: string) => {
    switch (header) {
      case 'creationTime': {
        const date = dataValue as Timestamp
        return date.toDate().toLocaleString()
      }
      default:
        if (Array.isArray(dataValue)) {
          return dataValue.join(', ')
        }
        return dataValue.toString()
    }
  }

  const participantsSortedByCreationTime = participants.sort((a, b) => {
    const dateA = a.creationTime as Timestamp
    const dateB = b.creationTime as Timestamp
    return dateA && dateB && dateA.toMillis() > dateB.toMillis() ? 1 : -1
  })

  const deleteParticipant = async (participant: Data) => {
    if (
      participant.id &&
      db &&
      setParticipants &&
      // eslint-disable-next-line no-alert
      window.confirm(
        `Are you sure you want to delete ${participant[participantHeaders[1]] || 'this sign-up'}?`
      )
    ) {
      await deleteDoc(doc(db, 'signups', participant.id as string))
      setParticipants(participants.filter((item) => item.id !== participant.id))
    }
  }

  const participantToRow = (participant: Data) => (
    <tr key={participant[participantHeaders[0]].toString()}>
      {participantHeaders.map((header) => (
        <td className="p-4 pl-0" key={participant[header].toString()}>
          {parseParticipantData(participant[header], header)}
        </td>
      ))}
      {allowEdit && (
        <td>
          <button
            type="button"
            className="mainbutton"
            onClick={() => deleteParticipant(participant)}
          >
            Delete
          </button>
        </td>
      )}
    </tr>
  )

  const participantsThatMadeIt = participantsSortedByCreationTime.slice(
    0,
    signupData.maxParticipants
  )

  const participantsThatDidntMakeIt = participantsSortedByCreationTime.slice(
    signupData.maxParticipants
  )

  const parseHeader = (header: string) => {
    if (header === 'creationTime') {
      return 'Signed up at'
    }
    return header
  }

  return (
    <div>
      <h3 className="mt-4">
        Signed up ({participantsThatMadeIt.length} / {signupData.maxParticipants})
      </h3>
      <table className="table-auto">
        <thead>
          <tr>
            {participantHeaders.map((header) => (
              <th className="text-left p-2 pl-0" key={header}>
                {parseHeader(header)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {participantsThatMadeIt.map((participant) => participantToRow(participant))}
          {participantsThatDidntMakeIt.length > 0 && (
            <>
              <tr>
                <td colSpan={participantHeaders.length}>
                  <h5 className="mt-4">On reserve list ({participantsThatDidntMakeIt.length})</h5>
                  <hr className="bg-gray w-full mt-2 mb-0" />
                </td>
              </tr>
              {participantsThatDidntMakeIt.map((participant) => participantToRow(participant))}
            </>
          )}
        </tbody>
      </table>
    </div>
  )
}

export default ParticipantTable
