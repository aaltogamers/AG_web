import moment, { Moment } from 'moment'
import { FaBolt, FaCalendarAlt, FaFlagCheckered, FaRegClock } from 'react-icons/fa'
import TimePicker, { type TimePreset } from './TimePicker'

type Props = {
  value: string
  onChange: (value: string) => void
  // Start of the event the sign-up is for; presets are relative to it
  eventStart: Moment | null
  commonMargins?: string
}

const PRESETS: { label: string; icon: React.ReactNode; time: (eventStart: Moment) => Moment }[] = [
  {
    label: '2 weeks before event',
    icon: <FaCalendarAlt />,
    time: (s) => s.clone().subtract(2, 'weeks'),
  },
  {
    label: '1 week before event',
    icon: <FaCalendarAlt />,
    time: (s) => s.clone().subtract(1, 'week'),
  },
  {
    label: '3 days before event',
    icon: <FaRegClock />,
    time: (s) => s.clone().subtract(3, 'days'),
  },
  { label: '1 day before event', icon: <FaRegClock />, time: (s) => s.clone().subtract(1, 'day') },
  {
    label: '1 hour before event',
    icon: <FaRegClock />,
    time: (s) => s.clone().subtract(1, 'hour'),
  },
  { label: 'At event start', icon: <FaFlagCheckered />, time: (s) => s.clone() },
]

const SignupTimePicker = ({ value, onChange, eventStart, commonMargins }: Props) => {
  const presets: TimePreset[] = eventStart
    ? [
        ...PRESETS.map((p) => ({ label: p.label, icon: p.icon, time: p.time(eventStart) })),
        { label: 'Now', icon: <FaBolt />, time: moment() },
      ]
    : []
  return (
    <TimePicker
      value={value}
      onChange={onChange}
      presets={presets}
      markedDay={eventStart}
      className={commonMargins}
    />
  )
}

export default SignupTimePicker
