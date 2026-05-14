'use client'
import { useEffect, useState } from 'react'
import { useForm, SubmitHandler } from 'react-hook-form'
import Link from 'next/link'

import Input from './Input'
import {
  BracketType,
  TOURNAMENT_BRACKET_TYPES,
  TOURNAMENT_TEAM_COUNTS,
  TournamentSummary,
  TournamentTeamCount,
  getBracketTypeLabel,
} from '../types/types'
import { createTournament, deleteTournament, listTournaments } from '../utils/tournamentApi'

type Inputs = {
  name: string
  bracketType: BracketType
  teamCount: string
}

const TournamentList = () => {
  const { register, handleSubmit, control, reset } = useForm<Inputs>({
    defaultValues: {
      name: '',
      bracketType: TOURNAMENT_BRACKET_TYPES[0],
      teamCount: String(TOURNAMENT_TEAM_COUNTS[0]),
    },
  })
  const [tournaments, setTournaments] = useState<TournamentSummary[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    const list = await listTournaments()
    setTournaments(list)
    setLoading(false)
  }

  useEffect(() => {
    refresh()
  }, [])

  const onSubmit: SubmitHandler<Inputs> = async (data) => {
    setMessage(null)
    try {
      const teamCount = Number(data.teamCount) as TournamentTeamCount
      const created = await createTournament({
        name: data.name,
        bracketType: data.bracketType,
        teamCount,
        teams: [],
      })
      setMessage(`Created "${created.name}"`)
      reset({
        name: '',
        bracketType: TOURNAMENT_BRACKET_TYPES[0],
        teamCount: String(TOURNAMENT_TEAM_COUNTS[0]),
      })
      await refresh()
      setTimeout(() => setMessage(null), 2000)
    } catch (e) {
      setMessage(`Error: ${e instanceof Error ? e.message : e}`)
    }
  }

  const onDelete = async (tournament: TournamentSummary) => {
    if (!confirm(`Delete tournament "${tournament.name}"? This cannot be undone.`)) return
    try {
      await deleteTournament(tournament.slug)
      await refresh()
    } catch (e) {
      setMessage(`Error: ${e instanceof Error ? e.message : e}`)
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col items-center text-xl mb-12">
        <h3 className="text-2xl mb-4">Create a new tournament</h3>
        <div className="grid grid-cols-input w-full md:w-2/3">
          <Input
            register={register}
            name="name"
            displayName="Tournament name"
            placeHolder="ex. AG Spring Cup 2026"
            control={control}
            required
          />
          <label className="flex items-center" htmlFor="bracketType">
            Bracket type
          </label>
          <select
            id="bracketType"
            {...register('bracketType')}
            className="p-2 rounded-md mt-2 mb-8 md:m-4 w-full bg-white text-black"
          >
            {TOURNAMENT_BRACKET_TYPES.map((t) => (
              <option key={t} value={t}>
                {getBracketTypeLabel(t)}
              </option>
            ))}
          </select>
          <label className="flex items-center" htmlFor="teamCount">
            Number of teams
          </label>
          <select
            id="teamCount"
            {...register('teamCount')}
            className="p-2 rounded-md mt-2 mb-8 md:m-4 w-full bg-white text-black"
          >
            {TOURNAMENT_TEAM_COUNTS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="text-center h-4 mt-2 mb-6">{message}</div>

        <button type="submit" className="mainbutton">
          Create tournament
        </button>
      </form>

      <h3 className="text-2xl mb-4 text-center">All tournaments</h3>
      {loading ? (
        <div className="text-center opacity-75">Loading…</div>
      ) : tournaments.length === 0 ? (
        <div className="text-center opacity-75">No tournaments yet.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {tournaments.map((t) => (
            <div
              key={t.slug}
              className="flex flex-col md:flex-row md:items-center justify-between gap-2 p-4 border-2"
            >
              <div className="flex flex-col">
                <Link
                  href={`/tournaments/${encodeURIComponent(t.slug)}`}
                  className="text-2xl text-red hover:underline"
                >
                  {t.name}
                </Link>
                <span className="text-sm opacity-75">
                  /{t.slug} — {getBracketTypeLabel(t.bracketType)} — {t.teamCount} teams —{' '}
                  {t.isStarted ? 'started (locked)' : 'not started'}
                </span>
              </div>
              <div className="flex gap-2">
                <Link href={`/tournaments/${encodeURIComponent(t.slug)}`} className="borderbutton">
                  Open
                </Link>
                <button type="button" className="borderbutton" onClick={() => onDelete(t)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default TournamentList
