import React, { useEffect, useState } from 'react'

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: string // YYYY-MM-DD or empty
  onChange: (e: { target: { value: string } }) => void
}

const isoToDdMmYyyy = (iso: string): string => {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return ''
  return `${d}/${m}/${y}`
}

const ddMmYyyyToIso = (display: string): string => {
  const match = display.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return ''
  return `${match[3]}-${match[2]}-${match[1]}`
}

export default function DateInput({ value, onChange, className, ...rest }: Props) {
  const [display, setDisplay] = useState(() => isoToDdMmYyyy(value))

  useEffect(() => {
    setDisplay(isoToDdMmYyyy(value))
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/[^\d/]/g, '')

    const digits = raw.replace(/\//g, '')
    if (digits.length <= 8) {
      const parts: string[] = []
      if (digits.length > 0) parts.push(digits.slice(0, 2))
      if (digits.length > 2) parts.push(digits.slice(2, 4))
      if (digits.length > 4) parts.push(digits.slice(4, 8))
      raw = parts.join('/')
    }

    setDisplay(raw)

    const iso = ddMmYyyyToIso(raw)
    if (iso) {
      const d = new Date(iso)
      if (!isNaN(d.getTime())) {
        onChange({ target: { value: iso } })
      }
    } else if (raw === '') {
      onChange({ target: { value: '' } })
    }
  }

  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      placeholder="DD/MM/YYYY"
      value={display}
      onChange={handleChange}
      className={className}
    />
  )
}
