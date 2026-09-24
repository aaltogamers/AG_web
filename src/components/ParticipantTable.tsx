import { DataValue, SignupInput, SignupPool, SignupRow } from '../types/types'
import { deleteSignup } from '../utils/signupApi'
import { resolvePoolId } from '../utils/signupPools'

type Props = {
  participants: SignupRow[]
  signupData: {
    pools: SignupPool[]
    inputs: SignupInput[]
  }
  showPrivateData?: boolean
  allowEdit?: boolean
  ownSignupId?: string | null
  onChange?: () => void
}

const formatValue = (v: DataValue | undefined): string => {
  if (v === undefined || v === null) return ''
  if (Array.isArray(v)) return v.join(', ')
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  return String(v)
}

const ParticipantTable = ({
  participants,
  signupData,
  showPrivateData,
  allowEdit,
  ownSignupId,
  onChange,
}: Props) => {
  const inputsOrdered = [...signupData.inputs]
    .filter((input) => input.type !== 'info')
    .sort((a, b) => a.number - b.number)

  const visibleInputs = inputsOrdered.filter((input) => showPrivateData || input.public)

  const sorted = [...participants].sort((a, b) => {
    const ta = new Date(a.created_at).getTime()
    const tb = new Date(b.created_at).getTime()
    return ta - tb
  })

  const { pools } = signupData
  const isMultiPool = pools.length > 1

  const deleteParticipant = async (p: SignupRow) => {
    const firstAnswer = visibleInputs.length ? p.answers[String(visibleInputs[0].id)] : undefined
    const label = formatValue(firstAnswer) || 'this sign-up'
    if (!window.confirm(`Are you sure you want to delete ${label}?`)) return
    await deleteSignup(p.id)
    onChange?.()
  }

  const rowFor = (p: SignupRow) => {
    const isOwn = ownSignupId && ownSignupId === p.id
    return (
      <tr key={p.id} className={isOwn ? 'text-red' : ''}>
        {visibleInputs.map((input) => (
          <td className="p-4 pl-0" key={input.id}>
            {formatValue(p.answers[String(input.id)] as DataValue | undefined)}
          </td>
        ))}
        <td className="p-4 pl-0 text-sm text-lightgray">
          {new Date(p.created_at).toLocaleString('en-GB')}
        </td>
        {allowEdit && (
          <td>
            <button type="button" className="mainbutton" onClick={() => deleteParticipant(p)}>
              Delete
            </button>
          </td>
        )}
      </tr>
    )
  }

  const header = (
    <thead>
      <tr>
        {visibleInputs.map((input) => (
          <th className="text-left p-2 pl-0" key={input.id}>
            {input.title}
          </th>
        ))}
        <th className="text-left p-2 pl-0">Signed up at</th>
        {allowEdit && <th />}
      </tr>
    </thead>
  )

  const poolSection = (pool: SignupPool) => {
    const inPool = sorted.filter((p) => resolvePoolId(pools, p.pool_id) === pool.id)
    const madeIt = inPool.slice(0, pool.size)
    const reserve = inPool.slice(pool.size)
    return (
      <div key={pool.id}>
        <h3 className="mt-4">
          {isMultiPool ? pool.name : 'Signed up'} ({madeIt.length} / {pool.size})
        </h3>

        <div className="overflow-x-auto max-w-[90vw]">
          <table className="table-auto">
            {header}

            <tbody>
              {madeIt.map((p) => rowFor(p))}
              {reserve.length > 0 && (
                <>
                  <tr>
                    <td colSpan={visibleInputs.length + 1}>
                      <h5 className="mt-4">On reserve list ({reserve.length})</h5>
                      <hr className="bg-gray w-full mt-2 mb-0" />
                    </td>
                  </tr>
                  {reserve.map((p) => rowFor(p))}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return <div>{pools.map(poolSection)}</div>
}

export default ParticipantTable
