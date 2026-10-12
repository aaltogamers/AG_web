import { CSSProperties } from 'react'
import { SignupInput, SignupPool, SignupRow } from '../types/types'
import { answerInputs, formatAnswer, imageUrl, isPublicInput } from '../utils/signupAnswers'
import { poolFill, resolvePoolId } from '../utils/signupPools'
import CapacityBar from './CapacityBar'

type Props = {
  participants: SignupRow[]
  pools: SignupPool[]
  inputs: SignupInput[]
  ownSignupId: string | null
}

/** Public list of who has signed up, by pool, as shown on event pages */
const ParticipantList = ({ participants, pools, inputs, ownSignupId }: Props) => {
  const publicInputs = answerInputs(inputs).filter(isPublicInput)
  const sorted = [...participants].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  // On wider screens the answers line up in columns under their titles
  const gridStyle = {
    '--cols': `2.5rem ${publicInputs
      .map((input) => (input.type === 'image' ? '3rem' : 'minmax(0, 1fr)'))
      .join(' ')}`,
  } as CSSProperties
  const rowClass =
    'flex flex-wrap items-baseline gap-x-3 md:grid md:[grid-template-columns:var(--cols)]'

  const row = (p: SignupRow, index: number) => {
    const isOwn = p.id === ownSignupId
    const values = publicInputs.map((input) => {
      const value = p.answers[String(input.id)]
      // The own sign-up comes with all answers, but this list only shows public ones
      if (input.type !== 'image') return formatAnswer(input, value, true)
      const url = imageUrl(value)
      return url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="w-10 h-10 object-contain" loading="lazy" />
      ) : (
        ''
      )
    })
    return (
      <li
        key={p.id}
        className={`${rowClass} py-2 border-b border-gray-600 ${isOwn ? 'text-red' : ''}`}
      >
        <span className="text-lightgray tabular-nums">{index + 1}.</span>
        {values.map((value, i) => {
          // No separator after a logo, or before the first text
          const hasSeparator =
            i > 0 && publicInputs[i - 1].type !== 'image' && publicInputs[i].type !== 'image'
          return (
            <span
              key={publicInputs[i].id}
              className={`break-words ${i > 0 && !isOwn ? 'text-lightgray md:text-white' : ''}`}
            >
              {hasSeparator && <span className="md:hidden text-lightgray">· </span>}
              {value || <span className="text-lightgray">–</span>}
            </span>
          )
        })}
        {isOwn && <span className="uppercase tracking-widest text-sm md:hidden">You</span>}
      </li>
    )
  }

  const list = (rows: SignupRow[]) => (
    <ol style={gridStyle} className="text-lg">
      <li
        className={`${rowClass} !hidden md:!grid pb-2 border-b border-gray-600 text-sm uppercase tracking-widest text-lightgray`}
      >
        <span>#</span>
        {publicInputs.map((input) => (
          <span key={input.id}>{input.type === 'image' ? '' : input.title}</span>
        ))}
      </li>
      {rows.map(row)}
    </ol>
  )

  return (
    <div className="flex flex-col gap-10">
      {pools.map((pool) => {
        const inPool = sorted.filter((p) => resolvePoolId(pools, p.pool_id) === pool.id)
        const inPlaces = inPool.slice(0, pool.size)
        const reserve = inPool.slice(pool.size)
        const { taken } = poolFill(pool, inPool.length)
        return (
          <div key={pool.id} className="flex flex-col gap-4">
            <CapacityBar
              taken={taken}
              size={pool.size}
              reserve={reserve.length}
              label={pools.length > 1 ? pool.name : undefined}
              largeLabel
            />
            {!inPool.length && <div className="text-lightgray">No one has signed up yet.</div>}
            {/* Without public fields there's nothing to list besides the count */}
            {publicInputs.length > 0 && inPlaces.length > 0 && list(inPlaces)}
            {publicInputs.length > 0 && reserve.length > 0 && (
              <details>
                <summary className="cursor-pointer uppercase tracking-widest text-sm text-lightgray hover:text-red py-2">
                  Reserve list ({reserve.length})
                </summary>
                <div className="mt-2">{list(reserve)}</div>
              </details>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default ParticipantList
