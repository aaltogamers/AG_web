'use client'
import { useEffect, useMemo, useState } from 'react'
import { BracketsManager } from 'brackets-manager'
import { InMemoryDatabase } from 'brackets-memory-db'

type ImportDelimiter = 'newline' | 'comma' | 'semicolon'

const DELIMITER_PATTERNS: Record<ImportDelimiter, RegExp> = {
  newline: /\r?\n/,
  comma: /,/,
  semicolon: /;/,
}

import {
  BracketDatabaseSnapshot,
  BracketType,
  TOURNAMENT_BRACKET_TYPES,
  TOURNAMENT_TEAM_COUNTS,
  Tournament,
  TournamentTeamCount,
  getBracketTypeLabel,
} from '../types/types'
import { createBracket } from '../utils/brackets'
import { updateTournament } from '../utils/tournamentApi'

type Props = {
  tournament: Tournament
  // Receives the updated tournament so the parent can navigate when the slug
  // changes (e.g. after a rename).
  onChanged: (updated?: Tournament | null) => Promise<void> | void
}

const placeholderForIndex = (i: number) => `Team ${i + 1}`

// Settings + seeded team editor used by admins before the tournament starts.
// Everything here is gated on `!tournament.isStarted` by the parent.
const TournamentSetup = ({ tournament, onChanged }: Props) => {
  const [name, setName] = useState(tournament.name)
  const [bracketType, setBracketType] = useState<BracketType>(tournament.bracketType)
  const [teamCount, setTeamCount] = useState<TournamentTeamCount>(tournament.teamCount)
  const [teams, setTeams] = useState<string[]>(tournament.teams ?? [])
  const [message, setMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [building, setBuilding] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [importDelimiter, setImportDelimiter] = useState<ImportDelimiter>('newline')
  const [importError, setImportError] = useState<string | null>(null)

  // Keep state in sync if parent re-fetches.
  useEffect(() => {
    setName(tournament.name)
    setBracketType(tournament.bracketType)
    setTeamCount(tournament.teamCount)
    setTeams(tournament.teams ?? [])
  }, [tournament])

  const slotCount = teamCount
  const paddedTeams = useMemo(() => {
    const out = teams.slice(0, slotCount)
    while (out.length < slotCount) out.push('')
    return out
  }, [teams, slotCount])

  const updateTeamAt = (index: number, value: string) => {
    setTeams((prev) => {
      const next = prev.slice(0, slotCount)
      while (next.length < slotCount) next.push('')
      next[index] = value
      return next
    })
  }

  const moveTeam = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= slotCount) return
    setTeams((prev) => {
      const next = prev.slice(0, slotCount)
      while (next.length < slotCount) next.push('')
      const tmp = next[index]
      next[index] = next[target]
      next[target] = tmp
      return next
    })
  }

  const removeTeam = (index: number) => {
    setTeams((prev) => {
      const next = prev.slice(0, slotCount)
      while (next.length < slotCount) next.push('')
      // Shift everything below up; pad the end.
      const filtered = [...next.slice(0, index), ...next.slice(index + 1), '']
      return filtered
    })
  }

  const filledCount = paddedTeams.filter((t) => t.trim() !== '').length

  const openImportDialog = () => {
    setImportText('')
    setImportDelimiter('newline')
    setImportError(null)
    setImportOpen(true)
  }

  const closeImportDialog = () => {
    setImportOpen(false)
    setImportError(null)
  }

  useEffect(() => {
    if (!importOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeImportDialog()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [importOpen])

  const onConfirmImport = () => {
    const parsed = importText
      .split(DELIMITER_PATTERNS[importDelimiter])
      .map((t) => t.trim())
      .filter((t) => t !== '')

    if (parsed.length === 0) {
      setImportError('Enter at least one team name.')
      return
    }
    if (parsed.length > slotCount) {
      setImportError(
        `Too many teams: got ${parsed.length} but only ${slotCount} slots are available.`
      )
      return
    }

    const next = parsed.slice()
    while (next.length < slotCount) next.push('')
    setTeams(next)
    setImportOpen(false)
    setImportError(null)
  }

  const onSaveSettings = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const payload = {
        name: name.trim(),
        bracketType,
        teamCount,
        teams: paddedTeams,
        // Settings change before start: drop any previously built bracket data
        // so the next "Build bracket" produces a clean snapshot.
        data: null as BracketDatabaseSnapshot | null,
      }
      const updated = await updateTournament(tournament.slug, payload)
      setMessage('Saved.')
      // Keep local UI in sync from the response, then let the parent decide
      // whether to refresh (same slug) or navigate (renamed → new slug).
      setName(updated.name)
      setTeams(updated.teams)
      await onChanged(updated)
      setTimeout(() => setMessage(null), 2000)
    } catch (e) {
      setMessage(`Error: ${e instanceof Error ? e.message : e}`)
    } finally {
      setSaving(false)
    }
  }

  const onBuildBracket = async () => {
    if (filledCount !== slotCount) {
      setMessage(`Fill in all ${slotCount} team names first.`)
      return
    }
    setBuilding(true)
    setMessage(null)
    try {
      const storage = new InMemoryDatabase()
      const manager = new BracketsManager(storage)
      await createBracket(manager, bracketType, teamCount, paddedTeams)
      const snapshot = (await manager.export()) as unknown as BracketDatabaseSnapshot
      const updated = await updateTournament(tournament.slug, {
        name: name.trim(),
        bracketType,
        teamCount,
        teams: paddedTeams,
        data: snapshot,
      })
      await onChanged(updated)
    } catch (e) {
      setMessage(`Error: ${e instanceof Error ? e.message : e}`)
    } finally {
      setBuilding(false)
    }
  }

  const onClearBracket = async () => {
    if (!confirm('Clear the built bracket? Settings stay; the bracket is rebuilt next time.')) {
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      const updated = await updateTournament(tournament.slug, { data: null })
      await onChanged(updated)
    } catch (e) {
      setMessage(`Error: ${e instanceof Error ? e.message : e}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1">
          <span>Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="p-2 rounded-md bg-white text-black"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span>Bracket type</span>
          <select
            value={bracketType}
            onChange={(e) => setBracketType(e.target.value as BracketType)}
            className="p-2 rounded-md bg-white text-black"
          >
            {TOURNAMENT_BRACKET_TYPES.map((t) => (
              <option key={t} value={t}>
                {getBracketTypeLabel(t)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span>Number of teams</span>
          <select
            value={String(teamCount)}
            onChange={(e) => setTeamCount(Number(e.target.value) as TournamentTeamCount)}
            className="p-2 rounded-md bg-white text-black"
          >
            {TOURNAMENT_TEAM_COUNTS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
          <h3 className="text-2xl">Teams &amp; seeds</h3>
          <button type="button" className="borderbutton" onClick={openImportDialog}>
            Import teams
          </button>
        </div>
        <p className="text-sm opacity-75 mb-4">
          Seed 1 plays seed {slotCount}. Order matters: drag teams up/down to change seeding.
          Once any score is added the tournament is locked.
        </p>
        <div className="flex flex-col gap-2">
          {paddedTeams.map((team, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-10 text-right opacity-75">#{i + 1}</span>
              <input
                type="text"
                value={team}
                placeholder={placeholderForIndex(i)}
                onChange={(e) => updateTeamAt(i, e.target.value)}
                className="flex-1 p-2 rounded-md bg-white text-black"
              />
              <button
                type="button"
                className="borderbutton"
                onClick={() => moveTeam(i, -1)}
                disabled={i === 0}
                aria-label="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                className="borderbutton"
                onClick={() => moveTeam(i, 1)}
                disabled={i === slotCount - 1}
                aria-label="Move down"
              >
                ↓
              </button>
              <button
                type="button"
                className="borderbutton"
                onClick={() => removeTeam(i)}
                aria-label="Clear team"
              >
                ✖
              </button>
            </div>
          ))}
        </div>
        <p className="text-sm mt-2 opacity-75">
          {filledCount} / {slotCount} teams filled in.
        </p>
      </div>

      {message && <div className="text-center">{message}</div>}

      <div className="flex flex-wrap gap-3 justify-center">
        <button
          type="button"
          className="borderbutton"
          onClick={onSaveSettings}
          disabled={saving || building}
        >
          {saving ? 'Saving…' : 'Save settings'}
        </button>
        <button
          type="button"
          className="mainbutton"
          onClick={onBuildBracket}
          disabled={saving || building || filledCount !== slotCount}
        >
          {building ? 'Building…' : tournament.data ? 'Rebuild bracket' : 'Build bracket'}
        </button>
        {tournament.data && (
          <button
            type="button"
            className="borderbutton"
            onClick={onClearBracket}
            disabled={saving || building}
          >
            Clear built bracket
          </button>
        )}
      </div>

      {importOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-transparentBlack p-4"
          onClick={closeImportDialog}
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-teams-title"
        >
          <div
            className="w-full max-w-md bg-darkgray border border-lightgray p-6 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="import-teams-title">Import teams</h3>

            <p className="text-sm text-lightgray">
              Paste team names below. Imported teams replace the current list. Up to{' '}
              {slotCount} teams are allowed.
            </p>

            <label className="flex flex-col gap-1">
              <span>Delimiter</span>
              <select
                value={importDelimiter}
                onChange={(e) => setImportDelimiter(e.target.value as ImportDelimiter)}
                className="p-2 rounded-md bg-white text-black"
              >
                <option value="newline">Newline</option>
                <option value="comma">Comma (,)</option>
                <option value="semicolon">Semicolon (;)</option>
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span>Team names</span>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                rows={8}
                placeholder={
                  importDelimiter === 'newline'
                    ? 'Team A\nTeam B\nTeam C'
                    : importDelimiter === 'comma'
                      ? 'Team A, Team B, Team C'
                      : 'Team A; Team B; Team C'
                }
                className="p-2 rounded-md bg-white text-black"
              />
            </label>

            {importError != null && (
              <p className="text-red text-center" role="alert">
                {importError}
              </p>
            )}

            <div className="flex flex-wrap gap-3 justify-center pt-2">
              <button type="button" className="borderbutton" onClick={closeImportDialog}>
                Cancel
              </button>
              <button type="button" className="mainbutton" onClick={onConfirmImport}>
                Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TournamentSetup
