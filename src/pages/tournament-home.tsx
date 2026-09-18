import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'

import { PageContainer } from '@/components/layout/page-container'
import { FixturesDialog } from '@/components/tournaments/fixtures-dialog'
import { LeagueRow } from '@/components/tournaments/league-row'
import { Button } from '@/components/ui/button'
import {
  getCompetitions,
  getFormats,
  getLeaguesForTournament,
  getTeams,
  getTournament,
} from '@/data-layer'
import { ROUTES } from '@/routes'
import type {
  Competition,
  FormatRecord,
  JoinableLeague,
  Team,
  Tournament,
  TournamentId,
} from '@/types'

/**
 * One tournament — `/tournaments/:tournamentId`.
 *
 * **Mostly a list of leagues.** That is what the page is for: somewhere to find
 * a league to join, or to start one. The fixtures are reference, behind a
 * button, as `08-pages/tournaments.md` specifies.
 *
 * **Fixtures is the only modal.** The page was specified with Teams and Players
 * beside it; players are cut because they do not help anyone decide whether to
 * join, and teams are deferred because the fixtures already name them.
 *
 * **Public and closed leagues both appear.** Only entry is restricted, never
 * visibility.
 *
 * Distinct from `/admin/tournaments/:tournamentId`, which is where a system
 * admin builds one. This page only ever shows a published tournament.
 */
export function TournamentHome() {
  const { tournamentId } = useParams<{ tournamentId: string }>()

  const [tournament, setTournament] = useState<Tournament | undefined>(
    undefined,
  )
  const [leagues, setLeagues] = useState<JoinableLeague[]>([])
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [formats, setFormats] = useState<FormatRecord[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [error, setError] = useState<string | undefined>(undefined)
  const [showingFixtures, setShowingFixtures] = useState(false)

  /* Bumped after a join, so the row it came from shows the new count. */
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (tournamentId === undefined) return

    // Guards against setting state after unmount.
    let cancelled = false

    void (async () => {
      try {
        const id = tournamentId as TournamentId
        const [
          loaded,
          loadedLeagues,
          loadedCompetitions,
          loadedFormats,
          loadedTeams,
        ] = await Promise.all([
          getTournament(id),
          getLeaguesForTournament(id),
          getCompetitions(),
          getFormats(),
          getTeams(),
        ])
        if (cancelled) return
        setTournament(loaded)
        setLeagues(loadedLeagues)
        setCompetitions(loadedCompetitions)
        setFormats(loadedFormats)
        setTeams(loadedTeams)
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
          to={ROUTES.tournaments}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Tournaments
        </Link>

        {error !== undefined ? (
          <div className="mt-6">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Tournament not available
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              It may not exist, or it may not be published yet.
            </p>
            <p className="mt-2 font-mono text-xs text-muted-foreground">
              {error}
            </p>
          </div>
        ) : tournament === undefined ? (
          <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <Header
              tournament={tournament}
              competitions={competitions}
              formats={formats}
              onShowFixtures={() => setShowingFixtures(true)}
            />

            <h2 className="mt-10 text-base font-semibold">Leagues</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Every league running on this tournament, public and closed alike.
            </p>

            {leagues.length === 0 ? (
              <p className="mt-5 text-sm text-subtle-foreground">
                No leagues yet. Be the first to start one.
              </p>
            ) : (
              <div className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))] gap-3.5">
                {leagues.map((league) => (
                  <LeagueRow
                    key={league.leagueId}
                    league={league}
                    onJoined={() => setReloadToken((n) => n + 1)}
                  />
                ))}
              </div>
            )}

            {showingFixtures && (
              <FixturesDialog
                tournament={tournament}
                teams={teams}
                onClose={() => setShowingFixtures(false)}
              />
            )}
          </>
        )}
      </PageContainer>
    </main>
  )
}

function Header({
  tournament,
  competitions,
  formats,
  onShowFixtures,
}: {
  tournament: Tournament
  competitions: Competition[]
  formats: FormatRecord[]
  onShowFixtures: () => void
}) {
  const formatId = competitions.find(
    (c) => c.competitionId === tournament.competitionId,
  )?.formatId

  const formatName =
    formats.find((f) => f.formatId === formatId)?.formatName ?? formatId

  const matches = Object.keys(tournament.matches ?? {}).length
  const rounds = Object.keys(tournament.rounds ?? {}).length

  return (
    <div className="mt-4">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
        {tournament.tournamentName}
      </h1>

      {/* Number of matches and rounds, as the page document asks for. */}
      <p className="mt-2 text-sm text-muted-foreground">
        {formatName !== undefined && `${formatName} · `}
        {matches} {matches === 1 ? 'match' : 'matches'} · {rounds}{' '}
        {rounds === 1 ? 'round' : 'rounds'} · {dates(tournament)}
      </p>

      <div className="mt-5 flex flex-wrap gap-2.5">
        <Button variant="outline" onClick={onShowFixtures}>
          Fixtures
        </Button>
        {/*
          The only modal on this page. **Players are cut**: someone here is
          deciding whether to join a league, and a list of cricketers does not
          help them decide. **Teams are deferred**, because the fixtures already
          name both teams in every match — see `09-future-exploration.md` for
          what makes that stop being true.
        */}
        <Button asChild>
          <Link to={ROUTES.createLeague}>Create a league</Link>
        </Button>
      </div>
    </div>
  )
}

/**
 * **Both are match start times**, and the end is absent while any match is
 * undated — the tournament simply shows no end date.
 */
function dates(tournament: Tournament): string {
  if (tournament.startDate === undefined) return 'dates to be announced'

  const from = day(tournament.startDate)
  if (tournament.endDate === undefined) return `from ${from}`

  return `${from} — ${day(tournament.endDate)}`
}

function day(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
