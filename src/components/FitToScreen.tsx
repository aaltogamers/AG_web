import { ReactNode, useEffect, useRef, useState } from 'react'

const FitToScreen = ({ children }: { children: ReactNode }) => {
  const contentRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const content = contentRef.current
    if (!content) return
    const update = () => {
      const width = content.scrollWidth
      const height = content.scrollHeight
      if (!width || !height) return
      setScale(Math.min(window.innerWidth / width, window.innerHeight / height))
    }
    const observer = new ResizeObserver(update)
    observer.observe(content)
    window.addEventListener('resize', update)
    update()
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [])

  return (
    <div className="fixed inset-0 overflow-hidden">
      <div
        ref={contentRef}
        style={{ width: 'max-content', transform: `scale(${scale})`, transformOrigin: 'top left' }}
      >
        {children}
      </div>
    </div>
  )
}

export default FitToScreen
