import { Fragment, useCallback, useMemo, useState } from 'react'
import type { Id, Match, Participant } from 'brackets-model'
import { Status } from 'brackets-model'
import { FaPen } from 'react-icons/fa'

import MatchResultRow from './BracketMatchResultRow'
import BracketMatchEditDialog, { type MatchResultInput } from './BracketMatchEditDialog'
import TwitchLogo from './TwitchLogo'
import type { BracketStyles, Tournament } from '../types/types'
import {
  SwissData,
  isSwissBye,
  resetSwissMatchResult,
  updateSwissMatchResult,
} from '../utils/swiss'

type Props = {
  data: SwissData
  bracketStyles: BracketStyles
  isEditingMode: boolean
  onMatchResultSaved?: () => Promise<void>
  tournamentSlug: string
  onStreamMatchSaved?: (tournament: Tournament) => void
}

type Pool = { label: string | null; matches: Match[] }

const getPools = (data: SwissData, roundIndex: number): Pool[] => {
  const round = data.rounds[roundIndex]
  const matches = data.matchesByRound[round.id] ?? []
  const isPaired = matches.some((m) => m.opponent1?.id != null)
  if (!isPaired) return [{ label: null, matches }]

  const records = data.recordsBeforeRound[round.id] ?? {}
  const pools: Pool[] = []
  for (const match of matches) {
    const record = match.opponent1?.id != null ? records[match.opponent1.id] : undefined
    const label = isSwissBye(match) ? 'Bye' : record ? `${record.wins}–${record.losses}` : null
    const last = pools[pools.length - 1]
    if (last && last.label === label) last.matches.push(match)
    else pools.push({ label, matches: [match] })
  }
  return pools
}

const SwissSection = ({
  data,
  bracketStyles,
  isEditingMode,
  onMatchResultSaved,
  tournamentSlug,
  onStreamMatchSaved,
}: Props) => {
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null)

  const participantsById = useMemo(() => {
    const byId: Record<Id, Participant> = {}
    for (const p of data.participants) byId[p.id] = p
    return byId
  }, [data.participants])

  const closeDialog = useCallback(() => setSelectedMatch(null), [])

  const saveResult = useCallback(
    async (result: MatchResultInput) => {
      if (!selectedMatch) return
      await updateSwissMatchResult(data.manager, { matchId: selectedMatch.id, ...result })
      await onMatchResultSaved?.()
    },
    [selectedMatch, data.manager, onMatchResultSaved]
  )

  const resetResult = useCallback(async () => {
    if (!selectedMatch) return
    await resetSwissMatchResult(data.manager, selectedMatch.id)
    await onMatchResultSaved?.()
  }, [selectedMatch, data.manager, onMatchResultSaved])

  const isResettable =
    selectedMatch != null &&
    (selectedMatch.status === Status.Completed ||
      (selectedMatch.status === Status.Running &&
        (selectedMatch.opponent1?.score != null || selectedMatch.opponent2?.score != null)))

  const gameNumberTextSpace = 12
  const poolLabelWidth = bracketStyles.basicFontSize * 2.7
  const poolBracketWidth = 5

  const headerStyle = {
    backgroundColor: bracketStyles.roundColor,
    marginRight: 1,
    marginLeft: 1,
    fontSize: bracketStyles.titleFontSize,
  }

  const renderMatch = (match: Match) => {
    const isBye = isSwissBye(match)
    const isLocked = isBye || match.opponent1?.id == null || match.opponent2?.id == null
    const isStreamMatch = match.id === data.streamMatchId

    return (
      <div
        key={match.id}
        className="relative flex flex-col"
        style={{ width: bracketStyles.teamWidth, marginLeft: gameNumberTextSpace }}
      >
        <span
          className="rounded-sm"
          style={{
            backgroundColor: bracketStyles.teamNameColor,
            opacity: isBye ? 0.6 : 1,
            outline: isStreamMatch ? `2px solid #9344fe` : undefined,
          }}
        >
          {isStreamMatch && (
            <TwitchLogo
              size={16}
              className="absolute left-1/2 transform -translate-x-1/2 top-[-20px]"
            />
          )}
          {(['opponent1', 'opponent2'] as const).map((side) => (
            <MatchResultRow
              key={side}
              match={match}
              participant={side}
              participantsById={participantsById}
              bracketStyles={bracketStyles}
              bracketData={data}
            />
          ))}
        </span>

        {isEditingMode && !isLocked && (
          <div
            className="absolute w-full h-full bg-darkgray opacity-10 hover:opacity-80 cursor-pointer rounded-sm flex justify-end items-center pr-8"
            onClick={() => setSelectedMatch(match)}
            onKeyDown={(e) => e.key === 'Enter' && setSelectedMatch(match)}
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
              top: bracketStyles.teamHeight - bracketStyles.basicFontSize / 2,
              textAlign: 'center',
              left: -bracketStyles.basicFontSize * 0.75,
              width: bracketStyles.basicFontSize * 0.75,
            }}
          >
            {match.id}
          </div>
        )}
      </div>
    )
  }

  const standingWidth = bracketStyles.teamWidth + bracketStyles.teamHeight * 2

  return (
    <div className="flex flex-row" style={{ color: bracketStyles.textColor }}>
      {selectedMatch != null && (
        <BracketMatchEditDialog
          match={selectedMatch}
          participantsById={participantsById}
          manager={data.manager}
          streamMatchId={data.streamMatchId}
          tournamentSlug={tournamentSlug}
          isResettable={isResettable}
          onClose={closeDialog}
          saveResult={saveResult}
          resetResult={resetResult}
          onRenamed={async () => {
            await onMatchResultSaved?.()
          }}
          onStreamMatchSaved={onStreamMatchSaved}
        />
      )}

      {data.rounds.map((round, roundIndex) => (
        <div key={round.id} className="flex flex-col">
          <h3 className="mb-4 text-xl text-center px-1 rounded-sm" style={headerStyle}>
            Round {round.number}
          </h3>
          <div
            className="flex flex-col"
            style={{ gap: bracketStyles.teamGapY, marginRight: bracketStyles.teamGapX }}
          >
            {getPools(data, roundIndex).map((pool, poolIndex) => (
              <div key={poolIndex} className="flex flex-row">
                <div
                  className="relative flex items-center shrink-0"
                  style={{ width: poolLabelWidth }}
                >
                  {pool.label != null && (
                    <>
                      <span
                        className="rounded-sm text-center whitespace-nowrap"
                        style={{
                          width: poolLabelWidth - poolBracketWidth - 5,
                          fontSize: bracketStyles.basicFontSize * 0.75,
                          lineHeight: `${bracketStyles.basicFontSize * 1.2}px`,
                          backgroundColor: bracketStyles.connectorColor,
                          color: bracketStyles.textColor,
                        }}
                      >
                        {pool.label}
                      </span>
                      <div
                        className="absolute"
                        style={{
                          right: 0,
                          top: 0,
                          bottom: 0,
                          width: poolBracketWidth,
                          border: `2px solid ${bracketStyles.connectorColor}`,
                          borderRight: 'none',
                        }}
                      />
                    </>
                  )}
                </div>
                <div className="flex flex-col" style={{ gap: bracketStyles.teamGapY }}>
                  {pool.matches.map(renderMatch)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="flex flex-col" style={{ marginRight: bracketStyles.teamGapX }}>
        <h3 className="mb-4 text-xl text-center px-1 rounded-sm" style={headerStyle}>
          Standings
        </h3>
        <div className="flex flex-col" style={{ gap: 2, width: standingWidth }}>
          {data.standings.map((standing) => {
            const advances = standing.rank <= data.advanceCount
            const isCutLine = standing.rank === data.advanceCount
            return (
              <Fragment key={standing.participantId}>
                <div
                  className="flex flex-row items-stretch rounded-sm overflow-hidden"
                  title={`Buchholz ${standing.buchholz}, round difference ${standing.roundDiff > 0 ? '+' : ''}${standing.roundDiff}`}
                  style={{
                    height: bracketStyles.teamHeight,
                    lineHeight: `${bracketStyles.teamHeight}px`,
                    backgroundColor: bracketStyles.teamNameColor,
                    opacity: data.isComplete && !advances ? 0.5 : 1,
                  }}
                >
                  <div
                    className="text-center shrink-0"
                    style={{
                      width: bracketStyles.teamHeight,
                      fontSize: '0.8em',
                      backgroundColor: advances ? bracketStyles.winScoreColor : undefined,
                    }}
                  >
                    {standing.rank}
                  </div>
                  <div className="truncate px-1 grow">
                    {participantsById[standing.participantId]?.name}
                  </div>
                  <div
                    className="text-center shrink-0"
                    style={{
                      width: bracketStyles.teamHeight * 1.5,
                      backgroundColor: bracketStyles.loseScoreColor,
                    }}
                  >
                    {standing.wins}–{standing.losses}
                  </div>
                </div>
                {isCutLine && data.standings.length > data.advanceCount && (
                  <div
                    style={{
                      height: 2,
                      margin: `${bracketStyles.teamGapY / 2}px 0`,
                      backgroundColor: bracketStyles.connectorColor,
                    }}
                  />
                )}
              </Fragment>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default SwissSection
