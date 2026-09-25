'use client'
import { ReactNode, useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import { FaTimes } from 'react-icons/fa'

export type DialogProps = {
  // Called when the user requests dismissal (backdrop click or Escape key).
  // Suppressed while `busy` is true so async work can't be interrupted.
  onClose: () => void
  title: string | ReactNode
  children: ReactNode
  busy?: boolean
  // Tailwind max-width class for the inner container. Defaults to `max-w-sm`.
  maxWidthClass?: string
  // Tailwind z-index class for the backdrop. Defaults to `z-50`. Stacked
  // dialogs (a dialog opened from inside another) should use a higher value.
  zClass?: string
  // Fill the whole screen on phones, with a close button in the corner
  fullScreenOnMobile?: boolean
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
  fullScreenOnMobile = false,
}: DialogProps) => {
  const titleId = useId()

  // Keep the page behind from scrolling along with the dialog
  useEffect(() => {
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflow
    }
  }, [])

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
      className={`fixed inset-0 ${zClass} flex items-center justify-center bg-black/60 ${
        fullScreenOnMobile ? 'md:p-4' : 'p-4'
      }`}
      onClick={busy ? undefined : onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className={`w-full ${maxWidthClass} max-h-full overflow-y-auto bg-darkgray text-white relative ${
          fullScreenOnMobile
            ? 'h-full md:h-auto md:border md:border-lightgray'
            : 'border border-lightgray'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <h3 id={titleId}>{title}</h3>
            {fullScreenOnMobile && (
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                disabled={busy}
                className="p-2 -m-2 mt-0 text-lightgray hover:text-red"
              >
                <FaTimes size={20} />
              </button>
            )}
          </div>
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default Dialog
