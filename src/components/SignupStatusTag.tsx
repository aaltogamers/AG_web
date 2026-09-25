import moment, { Moment } from 'moment'
import { getSignupStatus } from '../utils/eventUtils'
import { SignupSummary } from '../utils/signupApi'
import { totalFill } from '../utils/signupPools'

type Props = {
  summary: SignupSummary
  now: Moment
}

/** Short status of a sign-up, e.g. "Open" or "Opens in 3 days" */
const SignupStatusTag = ({ summary, now }: Props) => {
  const status = getSignupStatus(summary, now)
  const base = 'inline-flex items-center gap-2 uppercase tracking-widest text-sm whitespace-nowrap'

  if (status === 'open') {
    const { isFull } = totalFill(summary.pools, summary.counts)
    return (
      <span className={`${base} text-white`}>
        <span className={`w-2 h-2 rounded-full ${isFull ? 'border border-red' : 'bg-red'}`} />
        {isFull ? 'Full · reserve' : 'Open'}
      </span>
    )
  }
  return (
    <span className={`${base} text-lightgray`}>
      {status === 'notOpen' ? `Opens ${moment(summary.openfrom).from(now)}` : 'Closed'}
    </span>
  )
}

export default SignupStatusTag
