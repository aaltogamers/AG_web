import { useState } from 'react'
import moment from 'moment'
import type { DailyVisitors } from '../utils/taggedLinks'

const SLOT = 5
const BAR = 3
const HEIGHT = 28
const COLOR = '#f32929'
const HOVER_COLOR = '#b81d1d'

const bar = (x: number, h: number) => {
  const r = Math.min(BAR / 2, h)
  const y = HEIGHT - h
  return `M${x},${HEIGHT}V${y + r}Q${x},${y} ${x + r},${y}H${x + BAR - r}Q${x + BAR},${y} ${x + BAR},${y + r}V${HEIGHT}Z`
}

const dayLabel = (date: string) => moment(date).format('ddd D MMM')

// Visitors per day of the last 30 days, with the day under the pointer in a tooltip.
// `max` is the busiest day of all the charts on the page, so they share a scale.
const VisitorsSparkline = ({ daily, max }: { daily: DailyVisitors[]; max: number }) => {
  const [hovered, setHovered] = useState<number | null>(null)
  const width = daily.length * SLOT
  const peak = daily.reduce((a, b) => (b.visitors > a.visitors ? b : a), daily[0])
  const day = hovered === null ? null : daily[hovered]

  return (
    <div className="relative inline-block" onMouseLeave={() => setHovered(null)}>
      <svg
        width={width}
        height={HEIGHT}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        role="img"
        aria-label={
          peak?.visitors
            ? `Visitors per day, last 30 days. Most: ${peak.visitors} on ${dayLabel(peak.date)}`
            : 'No visitors in the last 30 days'
        }
        className="block"
      >
        <line x1={0} x2={width} y1={HEIGHT - 0.5} y2={HEIGHT - 0.5} stroke="#cfd0d6" />
        {daily.map((d, i) =>
          d.visitors > 0 ? (
            <path
              key={d.date}
              d={bar(i * SLOT + 1, Math.max(2, (d.visitors / Math.max(1, max)) * HEIGHT))}
              fill={hovered === i ? HOVER_COLOR : COLOR}
            />
          ) : null
        )}
        {daily.map((d, i) => (
          <rect
            key={d.date}
            x={i * SLOT}
            y={0}
            width={SLOT}
            height={HEIGHT}
            fill="transparent"
            onMouseEnter={() => setHovered(i)}
          />
        ))}
      </svg>
      {day && hovered !== null && (
        <div
          className="absolute bottom-full mb-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-white border border-gray-300 px-2 py-1 text-xs text-black shadow pointer-events-none z-10"
          style={{ left: hovered * SLOT + SLOT / 2 }}
        >
          <span className="text-lightgray">{dayLabel(day.date)}</span>{' '}
          <span className="font-normal">
            {day.visitors} {day.visitors === 1 ? 'visitor' : 'visitors'}
          </span>
        </div>
      )}
    </div>
  )
}

export default VisitorsSparkline
