import { useState, useCallback } from 'react'
import type { Id, Match, Participant, Round } from 'brackets-model'
import { Status } from 'brackets-model'
import { BracketsManager } from 'brackets-manager'
import { useForm, SubmitHandler } from 'react-hook-form'

import MatchResultRow from './BracketMatchResultRow'
import Dialog from './Dialog'
import { BracketData, BracketStyles } from '../types/types'
import {
  getGroupHasFinal,
  isRoundAllBye,
  resetMatchResult,
  roundToLabel,
  updateMatchResult,
} from '../utils/brackets'
import { FaPen } from 'react-icons/fa'

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
          <button
            type="button"
            className="borderbutton"
            onClick={onClose}
            disabled={busy}
          >
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

type Props = {
  groupLabel: string
  roundsByGroup: Record<string, Round[]>
  matchesByRound: Record<Id, Match[]>
  participantsById: Record<Id, Participant>
  bracketStyles: BracketStyles
  bracketData: BracketData
  isEditingMode: boolean
  onMatchResultSaved?: () => Promise<void>
}

const GroupSection = ({
  groupLabel,
  roundsByGroup,
  matchesByRound,
  participantsById,
  bracketStyles,
  bracketData,
  isEditingMode,
  onMatchResultSaved,
}: Props) => {
  const matchHeight = bracketStyles.teamHeight * 2
  const baseGap = bracketStyles.teamGapY

  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<EditMatchFormValues>({
    defaultValues: { score1: '', score2: '', inProgress: false },
  })

  const openEditDialog = useCallback(
    (match: Match) => {
      setSelectedMatch(match)

      const hasScores = match.opponent1?.score != null || match.opponent2?.score != null

      const isCompleted = match.status === Status.Completed || Status.Archived

      reset({
        score1: String(match.opponent1?.score ?? ''),
        score2: String(match.opponent2?.score ?? ''),
        inProgress: hasScores ? !isCompleted : false,
      })
    },
    [reset]
  )

  const closeDialog = useCallback(() => {
    setSelectedMatch(null)
  }, [])

  const onSubmit: SubmitHandler<EditMatchFormValues> = useCallback(
    async (data) => {
      if (!selectedMatch) return

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
        await updateMatchResult(bracketData.manager, {
          matchId: selectedMatch.id,
          score1: data.inProgress ? Number(data.score1) || 0 : Number(data.score1),
          score2: data.inProgress ? Number(data.score2) || 0 : Number(data.score2),
          inProgress: data.inProgress,
        })

        await onMatchResultSaved?.()
        closeDialog()
      } catch (err) {
        setError('root', {
          message: err instanceof Error ? err.message : 'Failed to save match result.',
        })
      } finally {
        setSaving(false)
      }
    },
    [selectedMatch, bracketData.manager, onMatchResultSaved, closeDialog, setError]
  )

  const handleReset = useCallback(async () => {
    if (!selectedMatch) return
    setResetting(true)
    try {
      await resetMatchResult(bracketData.manager, selectedMatch.id)
      await onMatchResultSaved?.()
      closeDialog()
    } catch (err) {
      setError('root', {
        message: err instanceof Error ? err.message : 'Failed to reset match result.',
      })
    } finally {
      setResetting(false)
    }
  }, [selectedMatch, bracketData.manager, onMatchResultSaved, closeDialog, setError])

  const groupHasFinal = getGroupHasFinal(groupLabel, roundsByGroup, matchesByRound)

  return (
    <div className="flex flex-row" style={{ color: bracketStyles.textColor }}>
      {selectedMatch != null && (
        <Dialog
          title={`Edit match ${selectedMatch.id}`}
          onClose={closeDialog}
          busy={saving || resetting}
        >
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1">
              <ParticipantNameEditor
                participantId={selectedMatch.opponent1?.id ?? null}
                participantName={
                  participantsById[selectedMatch.opponent1?.id ?? -1]?.name
                }
                manager={bracketData.manager}
                onRenamed={async () => {
                  await onMatchResultSaved?.()
                }}
              />
              <input
                type="number"
                min={0}
                {...register('score1')}
                className="p-2 rounded-md bg-white text-black"
              />
            </label>

            <label className="flex flex-col gap-1">
              <ParticipantNameEditor
                participantId={selectedMatch.opponent2?.id ?? null}
                participantName={
                  participantsById[selectedMatch.opponent2?.id ?? -1]?.name
                }
                manager={bracketData.manager}
                onRenamed={async () => {
                  await onMatchResultSaved?.()
                }}
              />
              <input
                type="number"
                min={0}
                {...register('score2')}
                className="p-2 rounded-md bg-white text-black"
              />
            </label>

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
              <button type="button" className="borderbutton" onClick={closeDialog}>
                Cancel
              </button>
              {(selectedMatch.status === Status.Completed ||
                (selectedMatch.status === Status.Running &&
                  (selectedMatch.opponent1?.score != null ||
                    selectedMatch.opponent2?.score != null))) && (
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={saving || resetting}
                  className="borderbutton"
                >
                  {resetting ? 'Resetting…' : 'Reset'}
                </button>
              )}
              <button type="submit" disabled={saving || resetting} className="mainbutton">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {roundsByGroup[groupLabel]?.map((round, i) => {
        if (isRoundAllBye(round, matchesByRound)) return null

        const roundMatches = matchesByRound[round.id] ?? []

        const visibleRoundNumber =
          (roundsByGroup[groupLabel] ?? [])
            .slice(0, i + 1)
            .filter((r) => !isRoundAllBye(r, matchesByRound)).length

        const roundDepth = groupLabel === 'Lower' ? Math.floor(i / 2) : i
        const roundMultiplier = 2 ** roundDepth
        const roundGap = baseGap * roundMultiplier + matchHeight * (roundMultiplier - 1)
        const roundOffset = roundGap / 2

        const nextRound = roundsByGroup[groupLabel]?.[i + 1]
        const nextRoundMatches = nextRound ? (matchesByRound[nextRound.id] ?? []) : []
        const hasNextRound = nextRound != null
        const shouldMergePairs = hasNextRound && roundMatches.length === nextRoundMatches.length * 2

        const connectorThickness = 2
        const connectorFullGap = bracketStyles.teamGapX - bracketStyles.basicFontSize * 0.2
        const connectorHalfGap = connectorFullGap / 2

        const matchCenter = matchHeight / 2
        const nextMatchCenterDistance = matchHeight + roundGap

        const gameNumberTextSpace = 12

        return (
          <div key={round.id} className="flex flex-col">
            <h3
              className="mb-4 text-xl text-center px-1 rounded-sm "
              style={{
                backgroundColor: bracketStyles.roundColor,
                marginRight: 1,
                marginLeft: 1,
                fontSize: bracketStyles.titleFontSize,
              }}
            >
              {roundToLabel(round, matchesByRound, groupHasFinal, visibleRoundNumber)}
            </h3>
            <div
              className="flex flex-col"
              style={{
                gap: roundGap,
                marginTop: roundOffset,
                marginBottom: roundOffset,
                marginRight: bracketStyles.teamGapX,
              }}
            >
              {roundMatches.map((match, matchIndex) => {
                const isBye = match.opponent1 === null || match.opponent2 === null

                const isLocked =
                  isBye ||
                  match.opponent1?.id == null ||
                  match.opponent2?.id == null ||
                  match.status === Status.Archived

                const prevMatches = bracketData.prevMatches[match.id]
                const siblingMatch = bracketData.siblingMatches[match.id]

                const isSiblingMatchBye =
                  siblingMatch?.opponent1 === null || siblingMatch?.opponent2 === null

                const isBothBye = isBye && isSiblingMatchBye

                return (
                  <div
                    key={match.id}
                    className="relative flex flex-col "
                    style={{
                      width: bracketStyles.teamWidth,
                      marginLeft: gameNumberTextSpace,
                    }}
                  >
                    <span
                      className="rounded-sm"
                      style={{
                        backgroundColor: bracketStyles.teamNameColor,
                        opacity: isBye ? 0.0 : 1,
                      }}
                    >
                      <MatchResultRow
                        match={match}
                        participant="opponent1"
                        participantsById={participantsById}
                        bracketStyles={bracketStyles}
                        feedInfo={prevMatches?.opponent1From}
                      />

                      <MatchResultRow
                        match={match}
                        participant="opponent2"
                        participantsById={participantsById}
                        bracketStyles={bracketStyles}
                        feedInfo={prevMatches?.opponent2From}
                      />
                    </span>

                    {isEditingMode && !isLocked && (
                      <div
                        className="absolute w-full h-full bg-darkgray opacity-10 hover:opacity-80 cursor-pointer rounded-sm flex justify-end items-center pr-8"
                        onClick={() => openEditDialog(match)}
                        onKeyDown={(e) => e.key === 'Enter' && openEditDialog(match)}
                        role="button"
                        tabIndex={0}
                        aria-label="Edit match score"
                      >
                        <FaPen />
                      </div>
                    )}

                    {!isBye && (
                      <div
                        style={{
                          position: 'absolute',
                          lineHeight: `${bracketStyles.basicFontSize}px`,
                          fontSize: bracketStyles.basicFontSize * 0.75,
                          color: bracketStyles.connectorColor,
                          top:
                            matchCenter - connectorThickness / 2 - bracketStyles.basicFontSize / 2,
                          textAlign: 'center',
                          left: -bracketStyles.basicFontSize * 0.75,
                          width: bracketStyles.basicFontSize * 0.75,
                        }}
                      >
                        {match.id}
                      </div>
                    )}

                    {/* Connecting matches with a form ⑂ */}
                    {!isBothBye && hasNextRound && shouldMergePairs && (
                      <>
                        {/* Starting connecting - */}
                        {!isBye && (
                          <div
                            style={{
                              position: 'absolute',
                              left: bracketStyles.teamWidth,
                              top: matchCenter - connectorThickness / 2,
                              width: connectorHalfGap,
                              height: connectorThickness,
                              backgroundColor: bracketStyles.connectorColor,
                            }}
                          />
                        )}

                        {matchIndex % 2 === 0 && matchIndex + 1 < roundMatches.length && (
                          <>
                            {/* Vertical line | */}
                            <div
                              style={{
                                position: 'absolute',
                                left:
                                  bracketStyles.teamWidth +
                                  connectorHalfGap -
                                  connectorThickness / 2,
                                top: isBye
                                  ? matchCenter + nextMatchCenterDistance / 2
                                  : matchCenter,
                                width: connectorThickness,
                                height: isSiblingMatchBye
                                  ? nextMatchCenterDistance / 2 + connectorThickness / 2
                                  : nextMatchCenterDistance,
                                backgroundColor: bracketStyles.connectorColor,
                              }}
                            />

                            {/* Final connecting piece to next row - */}
                            <div
                              style={{
                                position: 'absolute',
                                left: bracketStyles.teamWidth + connectorHalfGap,
                                top:
                                  matchCenter +
                                  nextMatchCenterDistance / 2 -
                                  connectorThickness / 2,
                                width: connectorHalfGap,
                                height: connectorThickness,
                                backgroundColor: bracketStyles.connectorColor,
                              }}
                            />
                          </>
                        )}
                      </>
                    )}

                    {/* Connecting matches linearly -- */}
                    {!isBye && hasNextRound && !shouldMergePairs && (
                      <div
                        style={{
                          position: 'absolute',
                          left: bracketStyles.teamWidth,
                          top: matchCenter - connectorThickness / 2,
                          width: connectorFullGap,
                          height: connectorThickness,
                          backgroundColor: bracketStyles.connectorColor,
                        }}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default GroupSection
