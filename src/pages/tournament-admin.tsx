import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'

import { TournamentMatches } from '@/components/admin/tournament-matches'
import { TournamentParticipants } from '@/components/admin/tournament-participants'
import { TournamentRounds } from '@/components/admin/tournament-rounds'
import { PageContainer } from '@/components/layout/page-container'
import {
  getCompetitions,
  getPlayers,
  getTeams,
  getTournament,
} from '@/data-layer'
import { ROUTES } from '@/routes'
import type {
  Competition,
  Player,
  Team,
  Tournament,
  TournamentId,
} from '@/types'

/**
 * One tournament, in the admin panel — `/admin/tournaments/:tournamentId`.
 *
 * **A page rather than a dialog**, because a tournament carries teams, players,
 * fixtures and rounds, which is more than a panel on a shared screen can hold.
 * `08-pages/system-admin.md` leaves how the admin groups into screens open.
 *
 * Publishing and the official leagues land here next.
 */
export function TournamentAdmin() {
  const { tournamentId } = useParams<{ tournamentId: string }>()

  const [tournament, setTournament] = useState<Tournament | undefined>(
    undefined,
  )
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [error, setError] = useState<string | undefined>(undefined)

  const [reloadToken, setReloadToken] = useState(0)
  const reload = useCallback(() => setReloadToken((n) => n + 1), [])

  useEffect(() => {
    if (tournamentId === undefined) return

    // Guards against setting state after unmount, and against a slow first
    // response landing on top of a faster reload.
    let cancelled = false

    void (async () => {
      try {
        const [loaded, loadedCompetitions, loadedTeams, loadedPlayers] =
          await Promise.all([
            getTournament(tournamentId as TournamentId),
            getCompetitions(),
            getTeams(),
            // Retired included, because retiring only sets a flag and leaves
            // every membership intact. Someone already in this tournament who
            // has since retired must not silently disappear from it.
            getPlayers({ includeRetired: true }),
          ])
        if (cancelled) return
        setTournament(loaded)
        setCompetitions(loadedCompetitions)
        setTeams(loadedTeams)
        setPlayers(loadedPlayers)
        setError(undefined)
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : String(e))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [tournamentId, reloadToken])

  return (
    <main className="py-10 sm:py-14">
      <PageContainer>
        <Link
          to={ROUTES.admin}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Admin panel
        </Link>

        <Body
          tournament={tournament}
          competitions={competitions}
          teams={teams}
          players={players}
          error={error}
          onSaved={reload}
        />
      </PageContainer>
    </main>
  )
}

function Body({
  tournament,
  competitions,
  teams,
  players,
  error,
  onSaved,
}: {
  tournament: Tournament | undefined
  competitions: Competition[]
  teams: Team[]
  players: Player[]
  error: string | undefined
  onSaved: () => void
}) {
  if (error !== undefined) {
    return (
      <div className="mt-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Tournament not available
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          It may not exist, or the read failed.
        </p>
        <p className="mt-2 font-mono text-xs text-muted-foreground">{error}</p>
      </div>
    )
  }

  if (tournament === undefined) {
    return <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
  }

  const competition = competitions.find(
    (c) => c.competitionId === tournament.competitionId,
  )
  const matchCount = Object.keys(tournament.matches ?? {}).length

  return (
    <>
      <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {tournament.tournamentName}
        </h1>
        {tournament.publishedAt === undefined && (
          <span className="font-mono text-[10px] tracking-wide text-subtle-foreground uppercase">
            Draft
          </span>
        )}
      </div>

      <p className="mt-2 text-sm text-muted-foreground">
        {competition?.competitionName ?? tournament.competitionId} ·{' '}
        {matchCount} {matchCount === 1 ? 'match' : 'matches'} ·{' '}
        {describeDates(tournament)}
      </p>

      <TournamentParticipants
        tournament={tournament}
        teams={teams}
        players={players}
        onSaved={onSaved}
      />

      {/*
        Keyed on what each editor derives its form state from, so a reload after
        a save rebuilds it. Without this, matches appended by one editor would
        not appear until a page refresh. Keyed narrowly rather than on a reload
        counter, so saving one card does not discard unsaved edits in another.
      */}
      <TournamentMatches
        key={matchKey(tournament)}
        tournament={tournament}
        teams={teams}
        onSaved={onSaved}
      />

      <TournamentRounds
        key={`${matchKey(tournament)}|${Object.keys(tournament.rounds ?? {})
          .sort()
          .join(',')}`}
        tournament={tournament}
        onSaved={onSaved}
      />
    </>
  )
}

/** Changes when a match is added, which is what the fixture editor rebuilds on. */
function matchKey(tournament: Tournament): string {
  return Object.keys(tournament.matches ?? {})
    .sort()
    .join(',')
}

/**
 * **Both are start times.** The end is the last match's start, not when
 * anything finishes, and it is absent while any match is undated.
 */
function describeDates(tournament: Tournament): string {
  if (tournament.startDate === undefined) return 'no dates yet'

  const from = new Date(tournament.startDate).toLocaleDateString()
  if (tournament.endDate === undefined) {
    return `from ${from}, some matches undated`
  }

  return `${from} to ${new Date(tournament.endDate).toLocaleDateString()}`
}
