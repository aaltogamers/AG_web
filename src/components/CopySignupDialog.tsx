import { useEffect, useState } from 'react'
import Select from 'react-select'
import { getSignupEvent, listSignupEvents, listSignups, saveSignupEvent } from '../utils/signupApi'
import Dialog from './Dialog'

type Option = { value: string; label: string }

type Props = {
  // Sign-up key and label of the event whose sign-up gets overwritten
  targetKey: string
  targetLabel: string
  // Labels of the sign-up keys, newest event first. Forms not listed here are shown by key.
  labels: Option[]
  // Copying is blocked while the overwritten sign-up has sign-ups
  participantCount: number
  onClose: () => void
  onCopied: () => Promise<void>
}

// Copies the fields, pools and times of another event's sign-up onto this one.
// Sign-ups themselves are not copied.
const CopySignupDialog = ({
  targetKey,
  targetLabel,
  labels,
  participantCount,
  onClose,
  onCopied,
}: Props) => {
  const [keys, setKeys] = useState<string[] | null>(null)
  const [selected, setSelected] = useState<Option | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listSignupEvents().then((events) => setKeys(events.map((e) => e.key)))
  }, [])

  const sources = keys?.filter((key) => key !== targetKey) ?? []
  const options: Option[] = [
    ...labels.filter((o) => sources.includes(o.value)),
    ...sources
      .filter((key) => !labels.some((o) => o.value === key))
      .map((key) => ({ value: key, label: key })),
  ]

  const copy = async () => {
    if (!selected) return
    setBusy(true)
    setError(null)
    try {
      // Re-check, since someone may have signed up after the editor loaded
      const { signups } = await listSignups(targetKey)
      if (signups.length) throw new Error(`${targetLabel} already has sign-ups`)
      const source = await getSignupEvent(selected.value)
      if (!source) throw new Error('Sign-up to copy was not found')
      await saveSignupEvent({ ...source, key: targetKey })
      await onCopied()
      onClose()
    } catch (e) {
      setError(`Error: ${e instanceof Error ? e.message : e}`)
      setBusy(false)
    }
  }

  return (
    <Dialog
      onClose={onClose}
      title="Copy sign-up from existing event"
      busy={busy}
      maxWidthClass="max-w-xl"
    >
      <p className="text-base">
        This overwrites the sign-up of <strong>{targetLabel}</strong> with an exact copy of the
        selected event&apos;s sign-up: all fields, pools (including passwords) and open times.
        Sign-ups of the selected event are not copied.
      </p>

      <p className="text-base">This cannot be undone.</p>

      {participantCount > 0 && (
        <p className="text-base text-red">
          {targetLabel} already has {participantCount} sign-up(s), so its sign-up can&apos;t be
          overwritten. Remove the sign-ups first to copy another one over it.
        </p>
      )}
      <Select
        value={selected}
        onChange={setSelected}
        options={options}
        isLoading={!keys}
        placeholder="Choose an event…"
        className="text-black"
        theme={(theme) => ({
          ...theme,
          colors: { ...theme.colors, primary25: 'lightgray', primary: 'red' },
        })}
      />
      {error && <div className="text-red text-base">{error}</div>}
      <div className="flex justify-end gap-4">
        <button type="button" className="borderbutton" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          className="mainbutton"
          onClick={copy}
          disabled={!selected || busy || participantCount > 0}
        >
          {busy ? 'Copying…' : 'Copy'}
        </button>
      </div>
    </Dialog>
  )
}

export default CopySignupDialog
