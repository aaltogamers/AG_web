'use client'

import Link from 'next/link'
import { useState } from 'react'

interface Recording {
  name: string
  url: string
}

interface Props {
  recordings: Recording[]
}

const RecordingsDropdown = ({ recordings }: Props) => {
  const [isOpen, setIsOpen] = useState(false)

  if (recordings.length === 1) {
    return (
      <Link href={recordings[0].url} className="borderbutton" target="_blank" rel="noopener">
        View Recording
      </Link>
    )
  }

  return (
    <div className="relative">
      <button className="borderbutton" onClick={() => setIsOpen(!isOpen)}>
        View Recordings
      </button>
      {isOpen && (
        <div className="absolute bg-gray-800 border border-gray-700 shadow-lg z-10">
          {recordings.map((recording) => (
            <Link
              key={recording.name}
              href={recording.url}
              className="block px-4 py-2 hover:bg-gray-700"
              target="_blank"
              rel="noopener"
            >
              {recording.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default RecordingsDropdown
