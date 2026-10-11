import moment, { type Moment } from 'moment'
import { FaBolt, FaCalendarAlt, FaFlagCheckered, FaRegClock, FaSun } from 'react-icons/fa'
import TimePicker, { type TimePreset } from '../TimePicker'

type Props = {
  value: string
  onChange: (value: string) => void
  // Start of the post's event; most presets are relative to it
  eventStart: Moment | null
  // Presets before the default ones, e.g. relative to a session's start
  extraPresets?: TimePreset[]
  // Leaves out the presets relative to now and the event, e.g. for session times
  eventPresets?: boolean
  // The time a picked day gets when nothing is chosen yet; noon by default
  defaultTime?: Moment
  placeholder?: string
  clearable?: boolean
  disabled?: boolean
}

// Posts go out in the daytime: days before the event at noon
const atNoon = (day: Moment) => day.clone().hour(12).minute(0)

const defaultPresets = (eventStart: Moment | null): TimePreset[] => {
  const now = moment()
  const relative: TimePreset[] = eventStart
    ? [
        { label: '1 week before event', icon: <FaCalendarAlt />, time: atNoon(eventStart.clone().subtract(1, 'week')) },
        { label: '3 days before event', icon: <FaCalendarAlt />, time: atNoon(eventStart.clone().subtract(3, 'days')) },
        { label: 'Day before event', icon: <FaRegClock />, time: atNoon(eventStart.clone().subtract(1, 'day')) },
        { label: 'Morning of event day', icon: <FaSun />, time: eventStart.clone().hour(10).minute(0) },
        { label: '1 hour before event', icon: <FaFlagCheckered />, time: eventStart.clone().subtract(1, 'hour') },
      ]
    : []
  return [
    ...relative.filter((p) => p.time.isAfter(now)),
    { label: 'In 45 minutes', icon: <FaBolt />, time: now.clone().add(45, 'minutes').startOf('minute') },
    { label: 'Tomorrow at noon', icon: <FaSun />, time: atNoon(now.clone().add(1, 'day')) },
  ]
}

const PostTimePicker = ({
  value,
  onChange,
  eventStart,
  extraPresets = [],
  eventPresets = true,
  defaultTime,
  placeholder,
  clearable,
  disabled,
}: Props) => (
  <TimePicker
    value={value}
    onChange={onChange}
    presets={[...extraPresets, ...(eventPresets ? defaultPresets(eventStart) : [])]}
    markedDay={eventStart}
    defaultTime={defaultTime ?? atNoon(moment())}
    placeholder={placeholder}
    clearable={clearable}
    disabled={disabled}
  />
)

export default PostTimePicker
