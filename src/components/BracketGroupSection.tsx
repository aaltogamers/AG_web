import type { Id, Match, Participant, Round } from 'brackets-model'

import MatchResultRow from './BracketMatchResultRow'
import { BracketStyles } from '../types/types'
import { getFeederForSlot, getGroupHasFinal, roundToLabel } from '../utils/brackets'

type Props = {
  groupLabel: string
  roundsByGroup: Record<string, Round[]>
  matchesByRound: Record<Id, Match[]>
  participantsById: Record<Id, Participant>
  bracketStyles: BracketStyles
}

const GroupSection = ({
  groupLabel,
  roundsByGroup,
  matchesByRound,
  participantsById,
  bracketStyles,
}: Props) => {
  const matchHeight = bracketStyles.teamHeight * 2
  const baseGap = bracketStyles.teamGapY

  const groupHasFinal = getGroupHasFinal(groupLabel, roundsByGroup, matchesByRound)

  return (
    <div className="flex flex-row" style={{ color: bracketStyles.textColor }}>
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
        const connectorHalfGap = bracketStyles.teamGapX / 2
        const connectorFullGap = bracketStyles.teamGapX

        const matchCenter = matchHeight / 2
        const nextMatchCenterDistance = matchHeight + roundGap

        const gameNumberTextSpace = 12

        return (
          <div key={round.id} className="flex flex-col">
            <h3
              className="mb-4 text-xl font-bold text-center px-1 rounded-sm"
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

                const feeder1 =
                  match.opponent1?.id === null
                    ? getFeederForSlot(
                        groupLabel,
                        i,
                        matchIndex,
                        'opponent1',
                        roundsByGroup,
                        matchesByRound
                      )
                    : null
                const feeder2 =
                  match.opponent2?.id === null
                    ? getFeederForSlot(
                        groupLabel,
                        i,
                        matchIndex,
                        'opponent2',
                        roundsByGroup,
                        matchesByRound
                      )
                    : null

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
                        waitingForMatchId={feeder1?.feederMatchId}
                        waitingForMatchType={feeder1?.feederType}
                      />

                      <MatchResultRow
                        match={match}
                        participant="opponent2"
                        participantsById={participantsById}
                        bracketStyles={bracketStyles}
                        waitingForMatchId={feeder2?.feederMatchId}
                        waitingForMatchType={feeder2?.feederType}
                      />
                    </span>

                    <div
                      style={{
                        position: 'absolute',
                        lineHeight: `${bracketStyles.basicFontSize}px`,
                        fontSize: bracketStyles.basicFontSize * 0.75,
                        color: bracketStyles.connectorColor,
                        top: matchCenter - connectorThickness / 2 - bracketStyles.basicFontSize / 2,
                        textAlign: 'right',
                        left: '-22px',
                        width: '20px',
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
