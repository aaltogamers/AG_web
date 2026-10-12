import { FaDownload, FaTrash } from 'react-icons/fa'
import { DataValue, SignupInput, SignupPool, SignupRow } from '../types/types'
import { deleteSignup } from '../utils/signupApi'
import {
  answerInputs,
  formatAnswer,
  formatSimple,
  groupItemLabel,
  groupItems,
  imageUrl,
  isPublicInput,
  signupsToCsv,
} from '../utils/signupAnswers'
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
  // Shows an "Export CSV" button, and the name of the file
  csvName?: string
}

const Answer = ({ input, value }: { input: SignupInput; value: DataValue | undefined }) => {
  if (input.type === 'image') {
    const url = imageUrl(value)
    return url ? (
      <a href={url} target="_blank" rel="noopener noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="w-12 h-12 object-contain" loading="lazy" />
      </a>
    ) : null
  }
  if (input.type !== 'group') return <>{formatSimple(value)}</>
  const subs = input.fields ?? []
  return (
    <table className="text-base">
      <tbody>
        {groupItems(value).map((item, i) => (
          <tr key={i} className="align-top">
            <td className="pr-3 text-lightgray whitespace-nowrap">{groupItemLabel(input, i)}</td>
            {subs.map((f) => (
              <td key={f.id} className="pr-3 whitespace-nowrap">
                {formatSimple(item[f.id])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const downloadCsv = (name: string, csv: string) => {
  // The byte order mark makes Excel read it as UTF-8
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${name}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const ParticipantTable = ({
  participants,
  signupData,
  showPrivateData,
  allowEdit,
  ownSignupId,
  onChange,
  csvName,
}: Props) => {
  const visibleInputs = answerInputs(signupData.inputs).filter(
    (input) => showPrivateData || isPublicInput(input)
  )

  const sorted = [...participants].sort((a, b) => {
    const ta = new Date(a.created_at).getTime()
    const tb = new Date(b.created_at).getTime()
    return ta - tb
  })

  const { pools } = signupData
  const isMultiPool = pools.length > 1

  const deleteParticipant = async (p: SignupRow) => {
    const first = visibleInputs.find((input) => input.type !== 'image')
    const label = (first && formatAnswer(first, p.answers[String(first.id)])) || 'this sign-up'
    if (!window.confirm(`Are you sure you want to delete ${label}?`)) return
    await deleteSignup(p.id)
    onChange?.()
  }

  const columns = visibleInputs.length + 2 + (allowEdit ? 1 : 0)
  const cell = 'py-2 pr-4 align-top'

  const rowFor = (p: SignupRow, place: number) => {
    const isOwn = ownSignupId && ownSignupId === p.id
    return (
      <tr key={p.id} className={`border-b border-lightgray/30 ${isOwn ? 'text-red' : ''}`}>
        <td className={`${cell} text-lightgray`}>{place}</td>
        {visibleInputs.map((input) => (
          <td className={cell} key={input.id}>
            <Answer input={input} value={p.answers[String(input.id)]} />
          </td>
        ))}
        <td className={`${cell} text-sm text-lightgray whitespace-nowrap`}>
          {new Date(p.created_at).toLocaleString('en-GB')}
        </td>
        {allowEdit && (
          <td className="py-2 align-top text-right">
            <button
              type="button"
              className="p-1 text-lightgray hover:text-red"
              onClick={() => deleteParticipant(p)}
              title="Delete sign-up"
              aria-label="Delete sign-up"
            >
              <FaTrash size={14} />
            </button>
          </td>
        )}
      </tr>
    )
  }

  const header = (
    <thead>
      <tr className="border-b border-lightgray text-sm text-lightgray">
        <th className="text-left font-normal py-2 pr-4">#</th>
        {visibleInputs.map((input) => (
          <th className="text-left font-normal py-2 pr-4" key={input.id}>
            {input.title}
          </th>
        ))}
        <th className="text-left font-normal py-2 pr-4">Signed up at</th>
        {allowEdit && <th />}
      </tr>
    </thead>
  )

  const poolSection = (pool: SignupPool) => {
    const inPool = sorted.filter((p) => resolvePoolId(pools, p.pool_id) === pool.id)
    const madeIt = inPool.slice(0, pool.size)
    const reserve = inPool.slice(pool.size)
    return (
      <div key={pool.id} className="flex flex-col gap-2">
        <h3 className="text-xl font-normal">
          {isMultiPool ? pool.name : 'Signed up'}{' '}
          <span className="text-lightgray">
            {madeIt.length} / {pool.size}
          </span>
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-base">
            {header}
            <tbody>
              {madeIt.map((p, i) => rowFor(p, i + 1))}
              {reserve.length > 0 && (
                <>
                  <tr>
                    <td colSpan={columns} className="pt-6 pb-2 text-sm text-lightgray">
                      Reserve list ({reserve.length})
                    </td>
                  </tr>
                  {reserve.map((p, i) => rowFor(p, madeIt.length + i + 1))}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {csvName && participants.length > 0 && (
        <button
          type="button"
          className="borderbutton flex items-center gap-2 self-end"
          onClick={() =>
            downloadCsv(
              csvName,
              signupsToCsv(signupData.inputs, pools, participants, window.location.origin)
            )
          }
        >
          <FaDownload size={12} />
          Export CSV
        </button>
      )}
      {pools.map(poolSection)}
    </div>
  )
}

export default ParticipantTable
