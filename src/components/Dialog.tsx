'use client'
import { ReactNode, useEffect, useId } from 'react'
import { createPortal } from 'react-dom'

export type DialogProps = {
  // Called when the user requests dismissal (backdrop click or Escape key).
  // Suppressed while `busy` is true so async work can't be interrupted.
  onClose: () => void
  title: string
  children: ReactNode
  busy?: boolean
  // Tailwind max-width class for the inner container. Defaults to `max-w-sm`.
  maxWidthClass?: string
  // Tailwind z-index class for the backdrop. Defaults to `z-50`. Stacked
  // dialogs (a dialog opened from inside another) should use a higher value.
  zClass?: string
}

// A reusable modal dialog. Renders via a portal into `document.body` so its
// contents (including any `<form>` element) are never nested inside another
// form on the page; nested forms are invalid HTML and cause the inner form's
// submit button to fall back to submitting the outer form.
const Dialog = ({
  onClose,
  title,
  children,
  busy = false,
  maxWidthClass = 'max-w-sm',
  zClass = 'z-50',
}: DialogProps) => {
  const titleId = useId()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, busy])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className={`fixed inset-0 ${zClass} flex items-center justify-center bg-black/60 p-4`}
      onClick={busy ? undefined : onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className={`w-full ${maxWidthClass} bg-darkgray border border-lightgray text-white`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 flex flex-col gap-4">
          <h3 id={titleId}>{title}</h3>
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default Dialog
