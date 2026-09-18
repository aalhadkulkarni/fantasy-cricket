import { useEffect, useState } from 'react'

import { useAuth } from '@/auth/auth-context'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getFixtures,
  getGameWeeks,
  getLeaderboard,
  getLeaderboardForGameWeek,
  getLeaderboardForMatch,
  getScoringWatermark,
  getTeams,
} from '@/data-layer'
import { useLeague } from '@/hooks/use-league'
import type {
  GameWeekId,
  LeaderboardRow,
  LeagueGameWeek,
  Match,
  MatchId,
  ScoringWatermark,
  Team,
} from '@/types'

const OVERALL = 'overall'

/**
 * Leaderboard — `/leagues/:leagueId/leaderboard`.
 *
 * **Opens on the overall standings**, with a filter for any single match or
 * gameweek whose deadline has passed. Later ones are not offered: nobody's team
 * for them is final, and the layer refuses them anyway.
 *
 * **"Points calculated till" is always a match**, whichever kind of league
 * this is, because points are entered per match either way.
 *
 * **The page keeps only the rows it is showing.** Totals are computed in the
 * layer from a read it does not keep, and a new filter replaces the rows
 * rather than adding to them.
 */
export function Leaderboard() {
  const { league } = useLeague()
  const { state } = useAuth()
  const me = state.status === 'signedIn' ? state.userId : undefined

  // Pinned once, like My Team. A deadline passing while the page is open shows
  // on the next visit.
  const [now] = useState(() => Date.now())

  const [matches, setMatches] = useState<Match[]>([])
  const [weeks, setWeeks] = useState<LeagueGameWeek[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [watermark, setWatermark] = useState<ScoringWatermark>(undefined)
  // Absent means "no points yet" only once it has loaded; before that it is
  // unknown, and the subline says loading rather than something wrong.
  const [scheduleLoaded, setScheduleLoaded] = useState(false)

  const [filter, setFilter] = useState(OVERALL)
  const [rows, setRows] = useState<LeaderboardRow[] | undefined>(undefined)
  const [isScored, setIsScored] = useState(true)
  const [error, setError] = useState<string | undefined>(undefined)

  // The schedule and the watermark, which do not change with the filter.
  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const [fixtures, gameWeeks, allTeams, mark] = await Promise.all([
          getFixtures(league.tournamentId),
          league.isGameWeeksEnabled
            ? getGameWeeks(league.leagueId)
            : Promise.resolve([]),
          getTeams(),
          getScoringWatermark(league.leagueId),
        ])
        if (cancelled) return

        setMatches(fixtures)
        setWeeks(gameWeeks)
        setTeams(allTeams)
        setWatermark(mark)
        setScheduleLoaded(true)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [league.leagueId, league.tournamentId, league.isGameWeeksEnabled])

  // The standings for whatever is selected.
  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        if (filter === OVERALL) {
          const overall = await getLeaderboard(league.leagueId)
          if (cancelled) return
          setRows(overall)
          setIsScored(true)
          return
        }

        const [kind, id] = split(filter)
        const period =
          kind === 'week'
            ? await getLeaderboardForGameWeek(league.leagueId, id as GameWeekId)
            : await getLeaderboardForMatch(league.leagueId, id as MatchId)
        if (cancelled) return

        setRows(period.rows)
        setIsScored(period.isScored)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [league.leagueId, filter])

  // The old rows go with the old filter, so a slow answer never shows under
  // the new label.
  function choose(next: string) {
    setFilter(next)
    setRows(undefined)
    setError(undefined)
  }

  const locked = (match: Match | undefined) =>
    match?.startTimestamp !== undefined &&
    match.startTimestamp - league.deadlineOffset <= now

  const lockedMatches = matches.filter(locked)
  const lockedWeeks = weeks.filter((w) =>
    locked(matches.find((m) => m.matchId === w.matchIds[0])),
  )

  const shortName = (teamId: string | undefined) =>
    teamId === undefined
      ? 'TBD'
      : (teams.find((t) => t.teamId === teamId)?.teamShortName ?? 'TBD')
  const label = (m: Match) =>
    `Match ${m.matchNumber} · ${shortName(m.team1Id)} v ${shortName(m.team2Id)}`

  return (
    <section className="floodlit rounded-xl border bg-card p-5 text-card-foreground sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
            Leaderboard
          </h2>
          <p className="mt-2 font-mono text-sm font-medium text-muted-foreground">
            {!scheduleLoaded
              ? 'Loading…'
              : watermark === undefined
                ? 'No points calculated yet'
                : `Points calculated till ${label(watermark)}`}
          </p>
        </div>

        <Select value={filter} onValueChange={choose}>
          <SelectTrigger
            className="w-full sm:w-64"
            aria-label="Show standings for"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value={OVERALL}>Overall</SelectItem>

            {lockedWeeks.length > 0 && (
              <SelectGroup>
                <SelectLabel>Game weeks</SelectLabel>
                {lockedWeeks.map((w) => (
                  <SelectItem
                    key={w.gameWeek.gameWeekId}
                    value={`week:${w.gameWeek.gameWeekId}`}
                  >
                    Game week {w.gameWeek.gameWeekNumber}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}

            {lockedMatches.length > 0 && (
              <SelectGroup>
                <SelectLabel>Matches</SelectLabel>
                {lockedMatches.map((m) => (
                  <SelectItem key={m.matchId} value={`match:${m.matchId}`}>
                    {label(m)}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-6">
        {error !== undefined ? (
          <div className="text-sm">
            <p className="font-semibold text-destructive">
              Could not load the leaderboard
            </p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {error}
            </p>
          </div>
        ) : rows === undefined ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-subtle-foreground">
            Nobody is playing in this league yet.
          </p>
        ) : !isScored ? (
          <p className="text-sm text-subtle-foreground">
            Points not calculated yet.
          </p>
        ) : (
          <Standings rows={rows} me={me} />
        )}
      </div>
    </section>
  )
}

/**
 * **Three columns on a phone, four from `sm`.** The team name drops under the
 * manager's name rather than taking a column, so nothing scrolls sideways at
 * 390px.
 */
function Standings({
  rows,
  me,
}: {
  rows: readonly LeaderboardRow[]
  me: string | undefined
}) {
  const head =
    'px-3 pb-2 font-mono text-[10px] font-normal tracking-[0.14em] text-subtle-foreground uppercase'

  return (
    <div className="lit rounded-xl border bg-secondary/30 p-5">
      <table className="w-full text-[15px]">
        <thead>
          <tr className="border-b text-left">
            <th scope="col" className={`${head} w-14`}>
              Rank
            </th>
            <th scope="col" className={head}>
              Manager
            </th>
            <th scope="col" className={`${head} hidden sm:table-cell`}>
              Team
            </th>
            <th scope="col" className={`${head} text-right`}>
              Points
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => {
            const mine = row.managerId === me
            return (
              <tr
                key={row.managerId}
                className={mine ? 'bg-secondary/60' : undefined}
                aria-current={mine ? 'true' : undefined}
              >
                <td className="rounded-l-lg px-3 py-3.5 font-mono text-sm text-muted-foreground">
                  {row.rank}
                </td>
                <td className="max-w-0 px-3 py-3.5">
                  <p className="truncate font-medium">
                    {row.managerName}
                    {mine && (
                      <span className="ml-2 font-mono text-[10px] tracking-[0.08em] text-subtle-foreground uppercase">
                        You
                      </span>
                    )}
                  </p>
                  {row.fantasyTeamName !== undefined && (
                    <p className="truncate text-sm text-muted-foreground sm:hidden">
                      {row.fantasyTeamName}
                    </p>
                  )}
                </td>
                <td className="hidden max-w-0 truncate px-3 py-3.5 text-muted-foreground sm:table-cell">
                  {row.fantasyTeamName ?? '—'}
                </td>
                <td className="rounded-r-lg px-3 py-3.5 text-right font-semibold">
                  {format(row.points)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function split(value: string): ['week' | 'match', string] {
  const at = value.indexOf(':')
  return [value.slice(0, at) === 'week' ? 'week' : 'match', value.slice(at + 1)]
}

/** A vice-captain on 45 scores 67.5, so halves have to survive. */
function format(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}
