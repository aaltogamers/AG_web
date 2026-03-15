import { useState, useCallback, useEffect } from 'react'
import type { Id, Match, Participant, Round } from 'brackets-model'
import { Status } from 'brackets-model'
import { useForm, SubmitHandler } from 'react-hook-form'

import MatchResultRow from './BracketMatchResultRow'
import { BracketData, BracketStyles } from '../types/types'
import {
  getGroupHasFinal,
  resetMatchResult,
  roundToLabel,
  updateMatchResult,
} from '../utils/brackets'
import { FaPen } from 'react-icons/fa'

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

  useEffect(() => {
    if (selectedMatch == null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDialog()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedMatch, closeDialog])

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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeDialog}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-match-title"
        >
          <div
            className="w-full max-w-sm rounded-lg bg-gray-800 shadow-xl border border-gray-600"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="edit-match-title" className="text-lg font-semibold text-white px-4 pt-4">
              Edit match {selectedMatch.id}
            </h2>

            <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  {participantsById[selectedMatch.opponent1?.id ?? -1]?.name ?? 'TBD'}
                </label>

                <input
                  type="number"
                  min={0}
                  {...register('score1')}
                  className="w-full rounded border border-gray-600 bg-gray-700 text-white px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  {participantsById[selectedMatch.opponent2?.id ?? -1]?.name ?? 'TBD'}
                </label>
                <input
                  type="number"
                  min={0}
                  {...register('score2')}
                  className="w-full rounded border border-gray-600 bg-gray-700 text-white px-3 py-2"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  {...register('inProgress')}
                  className="rounded border-gray-600 bg-gray-700 text-amber-500 focus:ring-amber-500"
                />
                <span className="text-sm text-gray-300">Match still in progress</span>
              </label>
              {errors.root?.message != null && (
                <p className="text-sm text-red-400" role="alert">
                  {errors.root.message}
                </p>
              )}

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={closeDialog}
                  className="rounded px-4 py-2 text-gray-300 hover:bg-gray-700 transition-colors"
                >
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
                    className="rounded px-4 py-2 text-gray-300 border border-gray-500 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {resetting ? 'Resetting…' : 'Reset'}
                  </button>
                )}
                <button
                  type="submit"
                  disabled={saving || resetting}
                  className="rounded px-4 py-2 bg-amber-600 text-white font-medium hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {roundsByGroup[groupLabel]?.map((round, i) => {
        const roundMatches = matchesByRound[round.id] ?? []

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
              {roundToLabel(round, matchesByRound, groupHasFinal)}
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
                        opacity: isBye ? 0.75 : 1,
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

                    <div
                      style={{
                        position: 'absolute',
                        lineHeight: `${bracketStyles.basicFontSize}px`,
                        fontSize: bracketStyles.basicFontSize * 0.75,
                        color: bracketStyles.connectorColor,
                        top: matchCenter - connectorThickness / 2 - bracketStyles.basicFontSize / 2,
                        textAlign: 'center',
                        left: -bracketStyles.basicFontSize * 0.75,
                        width: bracketStyles.basicFontSize * 0.75,
                      }}
                    >
                      {match.id}
                    </div>

                    {hasNextRound && shouldMergePairs && (
                      <>
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

                        {matchIndex % 2 === 0 && matchIndex + 1 < roundMatches.length && (
                          <>
                            <div
                              style={{
                                position: 'absolute',
                                left:
                                  bracketStyles.teamWidth +
                                  connectorHalfGap -
                                  connectorThickness / 2,
                                top: matchCenter,
                                width: connectorThickness,
                                height: nextMatchCenterDistance,
                                backgroundColor: bracketStyles.connectorColor,
                              }}
                            />

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

                    {hasNextRound && !shouldMergePairs && (
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
