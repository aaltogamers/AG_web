import { useState, useCallback } from 'react'
import type { Id, Match, Participant, Round } from 'brackets-model'
import { Status } from 'brackets-model'

import MatchResultRow from './BracketMatchResultRow'
import BracketMatchEditDialog, { type MatchResultInput } from './BracketMatchEditDialog'
import type { BracketData, BracketStyles, Tournament } from '../types/types'
import {
  getGroupHasFinal,
  isRoundAllBye,
  resetMatchResult,
  roundToLabel,
  updateMatchResult,
} from '../utils/brackets'
import { FaPen } from 'react-icons/fa'
import TwitchLogo from './TwitchLogo'

type Props = {
  groupLabel: string
  roundsByGroup: Record<string, Round[]>
  matchesByRound: Record<Id, Match[]>
  participantsById: Record<Id, Participant>
  bracketStyles: BracketStyles
  bracketData: BracketData
  isEditingMode: boolean
  onMatchResultSaved?: () => Promise<void>
  tournamentSlug: string
  onStreamMatchSaved?: (tournament: Tournament) => void
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
  tournamentSlug,
  onStreamMatchSaved,
}: Props) => {
  const matchHeight = bracketStyles.teamHeight * 2
  const baseGap = bracketStyles.teamGapY

  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null)

  const openEditDialog = useCallback((match: Match) => setSelectedMatch(match), [])

  const closeDialog = useCallback(() => {
    setSelectedMatch(null)
  }, [])

  const saveResult = useCallback(
    async (result: MatchResultInput) => {
      if (!selectedMatch) return
      await updateMatchResult(bracketData.manager, { matchId: selectedMatch.id, ...result })
      await onMatchResultSaved?.()
    },
    [selectedMatch, bracketData.manager, onMatchResultSaved]
  )

  const resetResult = useCallback(async () => {
    if (!selectedMatch) return
    await resetMatchResult(bracketData.manager, selectedMatch.id)
    await onMatchResultSaved?.()
  }, [selectedMatch, bracketData.manager, onMatchResultSaved])

  const groupHasFinal = getGroupHasFinal(groupLabel, roundsByGroup, matchesByRound)

  const isResettable =
    selectedMatch &&
    (selectedMatch.status === Status.Completed ||
      bracketData.matchIds.gold?.has(selectedMatch.id) ||
      (selectedMatch.status === Status.Running &&
        (selectedMatch.opponent1?.score != null || selectedMatch.opponent2?.score != null)))

  return (
    <div className="flex flex-row " style={{ color: bracketStyles.textColor }}>
      {selectedMatch != null && (
        <BracketMatchEditDialog
          match={selectedMatch}
          participantsById={participantsById}
          manager={bracketData.manager}
          streamMatchId={bracketData.streamMatchId}
          tournamentSlug={tournamentSlug}
          isResettable={!!isResettable}
          onClose={closeDialog}
          saveResult={saveResult}
          resetResult={resetResult}
          onRenamed={async () => {
            await onMatchResultSaved?.()
          }}
          onStreamMatchSaved={onStreamMatchSaved}
        />
      )}
      {roundsByGroup[groupLabel]?.map((round, i) => {
        if (isRoundAllBye(round, matchesByRound)) return null

        const roundMatches = matchesByRound[round.id] ?? []

        const visibleRoundNumber = (roundsByGroup[groupLabel] ?? [])
          .slice(0, i + 1)
          .filter((r) => !isRoundAllBye(r, matchesByRound)).length

        const firstRoundInGroup = roundsByGroup[groupLabel].find(
          (r) => !isRoundAllBye(r, matchesByRound)
        )

        const allFirstRoundMatchPairsHaveOneBye =
          firstRoundInGroup &&
          matchesByRound[firstRoundInGroup.id]?.every((match) => {
            const siblingMatch = bracketData.siblingMatches[match.id]
            const isSiblingBye =
              siblingMatch?.opponent1 === null || siblingMatch?.opponent2 === null
            const isMatchBye = match.opponent1 === null || match.opponent2 === null
            return isSiblingBye || isMatchBye
          })

        const shouldCollapseFirstRound = allFirstRoundMatchPairsHaveOneBye

        const shouldCollapseThisRound =
          shouldCollapseFirstRound && round.id === firstRoundInGroup.id

        const roundDepth = groupLabel === 'Lower' ? Math.floor(i / 2) : i
        const roundMultiplier =
          2 ** (roundDepth - (shouldCollapseFirstRound && !shouldCollapseThisRound ? 1 : 0))

        const roundGap = baseGap * roundMultiplier + matchHeight * (roundMultiplier - 1)
        const roundOffset = roundGap / 2

        const nextRound = roundsByGroup[groupLabel]?.[i + 1]
        const nextRoundMatches = nextRound ? (matchesByRound[nextRound.id] ?? []) : []
        const hasNextRound = nextRound != null
        const shouldMergePairs =
          hasNextRound &&
          roundMatches.length === nextRoundMatches.length * 2 &&
          !shouldCollapseThisRound

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
              {roundToLabel(round, groupLabel, matchesByRound, groupHasFinal, visibleRoundNumber)}
              {(bracketData.bestOfByRoundId?.[round.id] ?? 1) > 1 && (
                <span style={{ fontSize: '0.6em', opacity: 0.75 }}>
                  {' '}
                  Bo{bracketData.bestOfByRoundId?.[round.id]}
                </span>
              )}
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
                  !!bracketData.placeholderParticipantIds?.has(match.opponent1.id) ||
                  !!bracketData.placeholderParticipantIds?.has(match.opponent2.id) ||
                  (match.status === Status.Archived && !bracketData.matchIds.gold?.has(match.id))

                const prevMatches = bracketData.prevMatches[match.id]
                const siblingMatch = bracketData.siblingMatches[match.id]

                const isSiblingMatchBye =
                  siblingMatch?.opponent1 === null || siblingMatch?.opponent2 === null

                const isBothBye = isBye && isSiblingMatchBye

                if (
                  shouldCollapseThisRound &&
                  ((matchIndex % 2 === 1 && isBothBye) || (!isSiblingMatchBye && isBye))
                ) {
                  return null
                }

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
                        outline:
                          match.id === bracketData.streamMatchId ? `2px solid #9344fe` : undefined,
                      }}
                    >
                      {match.id === bracketData.streamMatchId && (
                        <TwitchLogo
                          size={16}
                          className="absolute left-1/2 transform -translate-x-1/2 top-[-20px]"
                        />
                      )}

                      <MatchResultRow
                        match={match}
                        participant="opponent1"
                        participantsById={participantsById}
                        bracketStyles={bracketStyles}
                        feedInfo={prevMatches?.opponent1From}
                        bracketData={bracketData}
                      />

                      <MatchResultRow
                        match={match}
                        participant="opponent2"
                        participantsById={participantsById}
                        bracketStyles={bracketStyles}
                        feedInfo={prevMatches?.opponent2From}
                        bracketData={bracketData}
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
                        className="match-number"
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
                                height:
                                  isSiblingMatchBye || isBye
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
