type Props = {
  taken: number
  size: number
  reserve?: number
  // Text before the numbers, e.g. a pool name
  label?: string
  // Shows the label as a heading, e.g. above a participant list
  largeLabel?: boolean
  // A thin bar without numbers, for compact rows
  compact?: boolean
}

/** How many of a sign-up's places are taken, with the reserve list as extra text */
const CapacityBar = ({
  taken,
  size,
  reserve = 0,
  label,
  largeLabel = false,
  compact = false,
}: Props) => {
  const percent = size > 0 ? Math.min(100, (taken / size) * 100) : 100
  const bar = (
    <div
      className={`w-full bg-gray-600 overflow-hidden ${compact ? 'h-1' : 'h-1.5'}`}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={size}
      aria-valuenow={taken}
      aria-label={label ?? 'Places taken'}
    >
      <div
        className="h-full bg-red transition-[width] duration-500"
        style={{ width: `${percent}%` }}
      />
    </div>
  )
  if (compact) return bar
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-4 text-base">
        {largeLabel ? (
          <h4 className="truncate">{label}</h4>
        ) : (
          <span className="text-lightgray truncate">{label}</span>
        )}
        <span className="shrink-0 tabular-nums">
          {taken} / {size}
          {reserve > 0 && <span className="text-lightgray"> · +{reserve} reserve</span>}
        </span>
      </div>
      {bar}
    </div>
  )
}

export default CapacityBar
