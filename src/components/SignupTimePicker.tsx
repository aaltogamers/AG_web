import moment, { Moment } from 'moment'
import { useEffect, useRef, useState } from 'react'
import {
  FaBolt,
  FaCalendarAlt,
  FaChevronLeft,
  FaChevronRight,
  FaFlagCheckered,
  FaRegClock,
} from 'react-icons/fa'

// Values use the datetime-local format, in the browser's local time
const VALUE_FORMAT = 'YYYY-MM-DDTHH:mm'

type Props = {
  value: string
  onChange: (value: string) => void
  // Start of the event the sign-up is for; presets are relative to it
  eventStart: Moment | null
  commonMargins?: string
}

type Preset = {
  label: string
  icon: React.ReactNode
  time: (eventStart: Moment) => Moment
}

const PRESETS: Preset[] = [
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

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

const SignupTimePicker = ({ value, onChange, eventStart, commonMargins }: Props) => {
  const selected = value ? moment(value, VALUE_FORMAT) : null
  const [isOpen, setIsOpen] = useState(false)
  const [month, setMonth] = useState<Moment>(() => (selected ?? moment()).clone().startOf('month'))
  const containerRef = useRef<HTMLDivElement>(null)

  const open = () => {
    setMonth((selected ?? eventStart ?? moment()).clone().startOf('month'))
    setIsOpen(true)
  }

  useEffect(() => {
    if (!isOpen) return undefined
    const onPointerDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setIsOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen])

  const set = (time: Moment) => onChange(time.format(VALUE_FORMAT))

  const pickPreset = (time: Moment) => {
    set(time)
    setIsOpen(false)
  }

  const pickDay = (day: Moment) => {
    const time = selected ?? eventStart ?? moment().startOf('hour')
    set(day.clone().hour(time.hour()).minute(time.minute()))
  }

  const pickTime = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number)
    if (!Number.isFinite(h) || !Number.isFinite(m)) return
    set((selected ?? moment()).clone().hour(h).minute(m))
  }

  const gridStart = month.clone().startOf('isoWeek')
  const gridEnd = month.clone().endOf('month').endOf('isoWeek')
  const days = Array.from({ length: gridEnd.diff(gridStart, 'days') + 1 }, (_, i) =>
    gridStart.clone().add(i, 'days')
  )
  const today = moment()

  return (
    <div className={`relative w-full ${commonMargins ?? ''}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => (isOpen ? setIsOpen(false) : open())}
        className="p-2 rounded-md w-full bg-white text-black text-left flex items-center gap-2"
      >
        <FaCalendarAlt className="text-lightgray" size={16} />
        {selected ? (
          selected.format('ddd D.M.YYYY HH:mm')
        ) : (
          <span className="text-lightgray">Choose a time</span>
        )}
      </button>

      {isOpen && (
        <div className="absolute z-20 mt-1 w-72 bg-white text-black text-base rounded-lg shadow-xl border border-lightgray">
          {eventStart && (
            <ul className="py-2 border-b border-lightgray">
              {PRESETS.map((preset) => {
                const time = preset.time(eventStart)
                return (
                  <li key={preset.label}>
                    <button
                      type="button"
                      onClick={() => pickPreset(time)}
                      className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-100 text-left"
                    >
                      <span className="text-lightgray">{preset.icon}</span>
                      <span className="flex-1">{preset.label}</span>
                      <span className="text-lightgray text-sm">{time.format('ddd D MMM')}</span>
                    </button>
                  </li>
                )
              })}
              <li>
                <button
                  type="button"
                  onClick={() => pickPreset(moment())}
                  className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-100 text-left"
                >
                  <span className="text-lightgray">
                    <FaBolt />
                  </span>
                  <span className="flex-1">Now</span>
                  <span className="text-lightgray text-sm">{today.format('ddd D MMM')}</span>
                </button>
              </li>
            </ul>
          )}

          <div className="px-4 py-3 border-b border-lightgray">
            <div className="flex items-center justify-between mb-2">
              <b>{month.format('MMM YYYY')}</b>
              <div className="flex gap-4 text-lightgray">
                <button
                  type="button"
                  aria-label="Previous month"
                  onClick={() => setMonth(month.clone().subtract(1, 'month'))}
                >
                  <FaChevronLeft size={12} />
                </button>
                <button
                  type="button"
                  aria-label="Next month"
                  onClick={() => setMonth(month.clone().add(1, 'month'))}
                >
                  <FaChevronRight size={12} />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 text-center text-sm">
              {WEEKDAYS.map((d, i) => (
                <div key={i} className="text-lightgray py-1">
                  {d}
                </div>
              ))}
              {days.map((day) => {
                const isSelected = selected?.isSame(day, 'day')
                const isEventDay = eventStart?.isSame(day, 'day')
                let color = ''
                if (!day.isSame(month, 'month')) color = 'text-lightgray'
                if (day.isSame(today, 'day')) color = 'text-red font-bold'
                return (
                  <button
                    type="button"
                    key={day.format('YYYY-MM-DD')}
                    onClick={() => pickDay(day)}
                    title={isEventDay ? 'Event day' : undefined}
                    className={`py-1 rounded-full ${
                      isSelected ? 'bg-red text-white' : `${color} hover:bg-gray-100`
                    } ${isEventDay && !isSelected ? 'underline decoration-red decoration-2' : ''}`}
                  >
                    {day.date()}
                  </button>
                )
              })}
            </div>
          </div>

          <label className="flex items-center gap-3 px-4 py-2">
            <FaRegClock className="text-lightgray" />
            <input
              type="time"
              value={selected ? selected.format('HH:mm') : ''}
              onChange={(e) => pickTime(e.target.value)}
              className="flex-1 p-1 border-b-2 border-black"
            />
          </label>
        </div>
      )}
    </div>
  )
}

export default SignupTimePicker
