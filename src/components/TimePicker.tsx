import moment, { Moment } from 'moment'
import { useEffect, useRef, useState } from 'react'
import { FaCalendarAlt, FaChevronLeft, FaChevronRight, FaRegClock, FaTimes } from 'react-icons/fa'

// Values use the datetime-local format, in the browser's local time
export const VALUE_FORMAT = 'YYYY-MM-DDTHH:mm'

export type TimePreset = {
  label: string
  icon: React.ReactNode
  time: Moment
}

type Props = {
  value: string
  onChange: (value: string) => void
  // Quick choices above the calendar
  presets?: TimePreset[]
  // A day underlined in the calendar, e.g. the event's day
  markedDay?: Moment | null
  markedDayLabel?: string
  // The time a picked day gets when nothing is chosen yet
  defaultTime?: Moment | null
  placeholder?: string
  // Shows a button that empties the value
  clearable?: boolean
  disabled?: boolean
  className?: string
}

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

const TimePicker = ({
  value,
  onChange,
  presets = [],
  markedDay = null,
  markedDayLabel = 'Event day',
  defaultTime = null,
  placeholder = 'Choose a time',
  clearable = false,
  disabled = false,
  className = '',
}: Props) => {
  const selected = value ? moment(value, VALUE_FORMAT) : null
  const [isOpen, setIsOpen] = useState(false)
  const [month, setMonth] = useState<Moment>(() => (selected ?? moment()).clone().startOf('month'))
  const containerRef = useRef<HTMLDivElement>(null)

  const open = () => {
    setMonth((selected ?? markedDay ?? moment()).clone().startOf('month'))
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
    const time = selected ?? defaultTime ?? markedDay ?? moment().startOf('hour')
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
    <div className={`relative w-full ${className}`} ref={containerRef}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => (isOpen ? setIsOpen(false) : open())}
          className="p-2 rounded-md w-full bg-white text-black text-left flex items-center gap-2 border border-gray-300 disabled:opacity-60"
        >
          <FaCalendarAlt className="text-lightgray shrink-0" size={16} />
          {selected ? (
            selected.format('ddd D.M.YYYY HH:mm')
          ) : (
            <span className="text-lightgray">{placeholder}</span>
          )}
        </button>
        {clearable && selected && !disabled && (
          <button
            type="button"
            aria-label="Clear the time"
            title="Clear the time"
            onClick={() => onChange('')}
            className="text-lightgray hover:text-red"
          >
            <FaTimes />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-20 mt-1 w-80 max-w-[calc(100vw-2rem)] bg-white text-black text-base rounded-lg shadow-xl border border-lightgray">
          {presets.length > 0 && (
            <ul className="py-2 border-b border-lightgray">
              {presets.map((preset) => (
                <li key={preset.label}>
                  <button
                    type="button"
                    onClick={() => pickPreset(preset.time)}
                    className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-100 text-left"
                  >
                    <span className="text-lightgray">{preset.icon}</span>
                    <span className="flex-1">{preset.label}</span>
                    <span className="text-lightgray text-sm whitespace-nowrap">
                      {preset.time.format('ddd D MMM HH:mm')}
                    </span>
                  </button>
                </li>
              ))}
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
                const isMarked = markedDay?.isSame(day, 'day')
                let color = ''
                if (!day.isSame(month, 'month')) color = 'text-lightgray'
                if (day.isSame(today, 'day')) color = 'text-red font-bold'
                return (
                  <button
                    type="button"
                    key={day.format('YYYY-MM-DD')}
                    onClick={() => pickDay(day)}
                    title={isMarked ? markedDayLabel : undefined}
                    className={`py-1 rounded-full ${
                      isSelected ? 'bg-red text-white' : `${color} hover:bg-gray-100`
                    } ${isMarked && !isSelected ? 'underline decoration-red decoration-2' : ''}`}
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

export default TimePicker
