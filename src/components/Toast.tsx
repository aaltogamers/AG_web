import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'

type Toast = { id: number; text: string; isError?: boolean }
type ShowToast = (text: string, options?: { isError?: boolean }) => void

const ToastContext = createContext<ShowToast>(() => undefined)

// Shows a short notice, e.g. "Saved.", in the corner of the admin pages
export const useToast = () => useContext(ToastContext)

// Notices go away by themselves; errors stay until closed
const TOAST_MS = 4000

const ToastItem = ({ toast, onClose }: { toast: Toast; onClose: (id: number) => void }) => {
  useEffect(() => {
    if (toast.isError) return
    const timer = setTimeout(() => onClose(toast.id), TOAST_MS)
    return () => clearTimeout(timer)
  }, [toast, onClose])

  return (
    <div
      role={toast.isError ? 'alert' : 'status'}
      className={`pointer-events-auto flex items-start gap-3 rounded-md px-4 py-3 text-base text-white shadow-lg ${
        // Darker than the theme red and green-400 so white text stays readable
        toast.isError ? 'bg-[#C41E1E]' : 'bg-green-700'
      }`}
    >
      <span className="flex-1 break-words">{toast.text}</span>
      <button
        type="button"
        aria-label="Close"
        className="text-white/80 hover:text-white"
        onClick={() => onClose(toast.id)}
      >
        ✕
      </button>
    </div>
  )
}

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)

  const show = useCallback<ShowToast>((text, options) => {
    const id = nextId.current++
    setToasts((old) => [...old, { id, text, isError: options?.isError }])
  }, [])
  const close = useCallback((id: number) => setToasts((old) => old.filter((t) => t.id !== id)), [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-96 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={close} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}
