import { useEffect, useRef, useState, type ReactNode } from 'react'
import { FaEllipsisV } from 'react-icons/fa'

export type ThreeDotMenuItem = {
  label: string
  onClick: () => void
}

type Props = {
  className?: string
  menuClassName?: string
  items?: ThreeDotMenuItem[]
  children?: ReactNode
}

const ThreeDotMenu = ({ className, items, children, menuClassName }: Props) => {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const onMouseDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }

    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  const panel =
    items != null ? (
      <>
        {items.map((item, i) => (
          <button
            key={`${i}-${item.label}`}
            type="button"
            className="w-full px-3 py-2 text-left hover:bg-white/10"
            onClick={() => {
              item.onClick()
              setOpen(false)
            }}
          >
            {item.label}
          </button>
        ))}
      </>
    ) : (
      children
    )

  return (
    <div ref={rootRef} className={className ?? 'absolute right-3 top-4'}>
      <div className="relative inline-flex">
        <button
          type="button"
          className="p-1 rounded hover:bg-white/10"
          onClick={() => setOpen((o) => !o)}
        >
          <FaEllipsisV size={28} className="block" />
        </button>

        {open && (
          <div
            className={
              menuClassName ??
              'absolute right-0 top-full z-[70] mt-1 min-w-[10rem] rounded border border-lightgray bg-darkgray py-1 shadow-lg'
            }
          >
            {panel}
          </div>
        )}
      </div>
    </div>
  )
}

export default ThreeDotMenu
