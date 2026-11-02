import { useState, useCallback } from 'react'
import type { Id, Match, Participant } from 'brackets-model'
import { Status } from 'brackets-model'
import { BracketsManager } from 'brackets-manager'
import { useForm, SubmitHandler } from 'react-hook-form'
import { FaPen } from 'react-icons/fa'

import Dialog from './Dialog'
import ThreeDotMenu from './ThreeDotMenu'
import TwitchLogo from './TwitchLogo'
import type { Tournament } from '../types/types'
import { updateTournament } from '../utils/tournamentApi'

type RenameTeamDialogProps = {
  participantId: Id
  participantName: string
  manager: BracketsManager
  onClose: () => void
  onRenamed: () => Promise<void> | void
}

const RenameTeamDialog = ({
  participantId,
  participantName,
  manager,
  onClose,
  onRenamed,
}: RenameTeamDialogProps) => {
  const [draft, setDraft] = useState(participantName)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    const trimmed = draft.trim()
    if (!trimmed) {
      setError('Name cannot be empty.')
      return
    }
    if (trimmed === participantName) {
      onClose()
      return
    }
    setBusy(true)
    setError(null)
    try {
      const existing = (await manager.storage.select(
        'participant',
        participantId
      )) as Participant | null
      if (!existing) {
        setError('Participant not found.')
        return
      }
      await manager.storage.update('participant', participantId, {
        ...existing,
        name: trimmed,
      })
      await onRenamed()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to rename.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog title="Rename team" onClose={onClose} busy={busy} zClass="z-[60]">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
        className="flex flex-col gap-4"
      >
        <label className="flex flex-col gap-1">
          <span>Team name</span>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="p-2 rounded-md bg-white text-black"
            autoFocus
            disabled={busy}
          />
        </label>

        {error != null && (
          <p className="text-red text-center" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-3 justify-center pt-2">
          <button type="button" className="borderbutton" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="mainbutton" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

type ParticipantNameEditorProps = {
  participantId: Id | null | undefined
  participantName: string | undefined
  manager: BracketsManager
  onRenamed: () => Promise<void> | void
}

const ParticipantNameEditor = ({
  participantId,
  participantName,
  manager,
  onRenamed,
}: ParticipantNameEditorProps) => {
  const [dialogOpen, setDialogOpen] = useState(false)

  if (participantId == null) {
    return <span>{participantName ?? 'TBD'}</span>
  }

  return (
    <>
      <span className="flex items-center gap-2">
        <span>{participantName ?? 'TBD'}</span>
        <button
          type="button"
          className="opacity-60 hover:opacity-100"
          onClick={() => setDialogOpen(true)}
          aria-label="Rename team"
          title="Rename team"
        >
          <FaPen />
        </button>
      </span>
      {dialogOpen && (
        <RenameTeamDialog
          participantId={participantId}
          participantName={participantName ?? ''}
          manager={manager}
          onClose={() => setDialogOpen(false)}
          onRenamed={onRenamed}
        />
      )}
    </>
  )
}

type EditMatchFormValues = {
  score1: string
  score2: string
  inProgress: boolean
}

export type MatchResultInput = { score1: number; score2: number; inProgress: boolean }

type Props = {
  match: Match
  matchNumber?: number
  participantsById: Record<Id, Participant>
  // Without a manager the match is display-only and only the stream game can be changed
  manager?: BracketsManager
  streamMatchId: Id | null
  tournamentSlug: string
  isResettable: boolean
  onClose: () => void
  saveResult: (result: MatchResultInput) => Promise<void>
  resetResult: () => Promise<void>
  onRenamed: () => Promise<void>
  onStreamMatchSaved?: (tournament: Tournament) => void
}

const getDefaultValues = (match: Match): EditMatchFormValues => {
  const hasScores = match.opponent1?.score != null || match.opponent2?.score != null
  const isCompleted = match.status === Status.Completed || match.status === Status.Archived
  return {
    score1: String(match.opponent1?.score ?? ''),
    score2: String(match.opponent2?.score ?? ''),
    inProgress: hasScores ? !isCompleted : false,
  }
}

const BracketMatchEditDialog = ({
  match,
  matchNumber = Number(match.id),
  participantsById,
  manager,
  streamMatchId,
  tournamentSlug,
  isResettable,
  onClose,
  saveResult,
  resetResult,
  onRenamed,
  onStreamMatchSaved,
}: Props) => {
  const [saving, setSaving] = useState(false)
  const [streamSaving, setStreamSaving] = useState(false)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<EditMatchFormValues>({ defaultValues: getDefaultValues(match) })

  const onSubmit: SubmitHandler<EditMatchFormValues> = useCallback(
    async (data) => {
      if (!data.inProgress) {
        const s1 = data.score1.trim() === '' ? NaN : Number(data.score1)
        const s2 = data.score2.trim() === '' ? NaN : Number(data.score2)
        if (Number.isNaN(s1) || Number.isNaN(s2)) {
          setError('root', { message: 'Please enter valid numbers for both scores.' })
          return
        }
        if (s1 < 0 || s2 < 0) {
          setError('root', { message: 'Scores cannot be negative.' })
          return
        }
      }

      setSaving(true)
      try {
        await saveResult({
          score1: data.inProgress ? Number(data.score1) || 0 : Number(data.score1),
          score2: data.inProgress ? Number(data.score2) || 0 : Number(data.score2),
          inProgress: data.inProgress,
        })
        onClose()
      } catch (err) {
        setError('root', {
          message: err instanceof Error ? err.message : 'Failed to save match result.',
        })
      } finally {
        setSaving(false)
      }
    },
    [saveResult, onClose, setError]
  )

  const handleReset = useCallback(async () => {
    try {
      await resetResult()
      onClose()
    } catch (err) {
      setError('root', {
        message: err instanceof Error ? err.message : 'Failed to reset match result.',
      })
    }
  }, [resetResult, onClose, setError])

  const handleStreamGameToggle = useCallback(async () => {
    const matchNum = Number(match.id)
    if (!Number.isInteger(matchNum) || matchNum < 0) {
      setError('root', { message: 'Invalid match id.' })
      return
    }

    const isCurrentStream = streamMatchId != null && Number(streamMatchId) === matchNum

    setStreamSaving(true)
    try {
      const updated = await updateTournament(tournamentSlug, {
        streamMatchId: isCurrentStream ? null : matchNum,
      })
      onStreamMatchSaved?.(updated)
      onClose()
    } catch (err) {
      setError('root', {
        message: err instanceof Error ? err.message : 'Failed to update stream game.',
      })
    } finally {
      setStreamSaving(false)
    }
  }, [match.id, streamMatchId, tournamentSlug, onStreamMatchSaved, onClose, setError])

  const possibleActions = [
    ...(isResettable ? [{ label: 'Reset match', onClick: () => handleReset() }] : []),
    {
      label: match.id === streamMatchId ? 'Unmark as stream game' : 'Mark as stream game',
      onClick: () => handleStreamGameToggle(),
    },
  ]

  const dialogTitle = (
    <div className="flex items-center gap-2">
      {manager ? 'Edit match' : 'Match'} {matchNumber}
      {match.id === streamMatchId && <TwitchLogo size={24} />}
    </div>
  )

  if (!manager) {
    return (
      <Dialog title={dialogTitle} onClose={onClose} busy={streamSaving}>
        <div className="flex flex-col gap-4">
          {(['opponent1', 'opponent2'] as const).map((side) => (
            <div key={side} className="flex justify-between gap-4">
              <span>
                {match[side] === null
                  ? 'BYE'
                  : (participantsById[match[side]?.id ?? -1]?.name ?? 'TBD')}
              </span>
              <span>{match[side]?.score ?? ''}</span>
            </div>
          ))}

          {errors.root?.message != null && (
            <p className="text-red text-center" role="alert">
              {errors.root.message}
            </p>
          )}

          <div className="flex flex-wrap gap-3 justify-center pt-2">
            <button type="button" className="borderbutton" onClick={onClose}>
              Close
            </button>
            <button
              type="button"
              className="mainbutton"
              disabled={streamSaving}
              onClick={() => void handleStreamGameToggle()}
            >
              {match.id === streamMatchId ? 'Unmark as stream game' : 'Mark as stream game'}
            </button>
          </div>
        </div>
      </Dialog>
    )
  }

  return (
    <Dialog title={dialogTitle} onClose={onClose} busy={saving || streamSaving}>
      <ThreeDotMenu items={possibleActions}></ThreeDotMenu>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {(['opponent1', 'opponent2'] as const).map((side, i) => (
          <label key={side} className="flex flex-col gap-1">
            <ParticipantNameEditor
              participantId={match[side]?.id ?? null}
              participantName={participantsById[match[side]?.id ?? -1]?.name}
              manager={manager}
              onRenamed={onRenamed}
            />
            <input
              type="number"
              min={0}
              {...register(i === 0 ? 'score1' : 'score2')}
              className="p-2 rounded-md bg-white text-black"
            />
          </label>
        ))}

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" {...register('inProgress')} />
          <span>Match still in progress</span>
        </label>

        {errors.root?.message != null && (
          <p className="text-red text-center" role="alert">
            {errors.root.message}
          </p>
        )}

        <div className="flex flex-wrap gap-3 justify-center pt-2">
          <button type="button" className="borderbutton" onClick={onClose}>
            Cancel
          </button>

          <button type="submit" disabled={saving || streamSaving} className="mainbutton">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

export default BracketMatchEditDialog
