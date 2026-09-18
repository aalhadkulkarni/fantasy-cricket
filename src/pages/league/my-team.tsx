import { useEffect, useState } from 'react'

import { JoinLeagueDialog } from '@/components/join-league-dialog'
import { LineupSummary } from '@/components/leagues/lineup-summary'
import { PlayerPicker } from '@/components/leagues/player-picker'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import {
  getCurrentGameWeek,
  getCurrentMatch,
  getLineupRules,
  getMyTeamForGameWeek,
  getMyTeamForMatch,
  getSelectablePlayers,
  updateTeamForGameWeek,
  updateTeamForMatch,
} from '@/data-layer'
import { useLeague } from '@/hooks/use-league'
import type { GameWeek, LineupRules, Match, Player, PlayerId } from '@/types'

const XI = 11

/**
 * My Team — `/leagues/:leagueId/team`.
 *
 * **Eleven dropdowns, not a grid of player cards.** A grid works when you are
 * picking from one match's two squads, which is about thirty players and a
 * natural browsing set. Picking eleven from a whole tournament is searching, not
 * browsing, and dropdowns with type-ahead match that.
 *
 * **Slots are not pre-assigned by role.** Any player goes in any slot, and
 * composition is validated rather than structurally enforced — pre-slotting
 * cannot be done honestly when the rules are ranges rather than exact counts.
 *
 * **An illegal team cannot be submitted**, and the data layer refuses one
 * independently. That is consistent with the auction permitting illegal squads:
 * a manager who cannot field a legal XI scores zero, and refusing produces that
 * outcome while saying so.
 *
 * B7 builds first-time creation. Viewing a submitted team, navigating between
 * matches, editing and the impact sub are B8 to B11.
 */
export function MyTeam() {
  const { league, reload } = useLeague()
  const [joining, setJoining] = useState(false)

  // Roles are additive, and running a league is not playing in it. Whoever
  // published the tournament owns its official leagues without a team.
  const playing = league.myRoles.manager === true

  const [pool, setPool] = useState<Player[]>([])
  const [rules, setRules] = useState<LineupRules>({})
  const [match, setMatch] = useState<Match | undefined>(undefined)
  const [gameWeek, setGameWeek] = useState<GameWeek | undefined>(undefined)
  const [existing, setExisting] = useState<Player[] | undefined>(undefined)

  const [picks, setPicks] = useState<(PlayerId | undefined)[]>(
    Array.from({ length: XI }, () => undefined),
  )
  const [captainId, setCaptainId] = useState<PlayerId | undefined>(undefined)
  const [viceCaptainId, setViceCaptainId] = useState<PlayerId | undefined>(
    undefined,
  )

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      setLoading(true)
      try {
        const current = await getCurrentMatch(league.leagueId)
        const week = league.isGameWeeksEnabled
          ? await getCurrentGameWeek(league.leagueId)
          : undefined

        const [players, lineupRules, mine] = await Promise.all([
          getSelectablePlayers(league.leagueId, current.matchId),
          getLineupRules(league.leagueId),
          week === undefined
            ? getMyTeamForMatch(league.leagueId, current.matchId)
            : getMyTeamForGameWeek(league.leagueId, week.gameWeekId),
        ])

        if (cancelled) return

        setMatch(current)
        setGameWeek(week)
        setPool(players)
        setRules(lineupRules)

        const eleven =
          mine === undefined
            ? undefined
            : 'startingLineup' in mine
              ? mine.startingLineup
              : mine.lineup

        setExisting(eleven)
        if (mine !== undefined && eleven !== undefined) {
          setPicks([
            ...eleven.map((p) => p.playerId),
            ...Array.from({ length: XI - eleven.length }, () => undefined),
          ])
          setCaptainId(mine.captainId)
          setViceCaptainId(mine.viceCaptainId)
        }
        setError(undefined)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [league.leagueId, league.isGameWeeksEnabled])

  const chosen = picks.filter((id): id is PlayerId => id !== undefined)
  const selected = chosen
    .map((id) => pool.find((p) => p.playerId === id))
    .filter((p): p is Player => p !== undefined)

  const complete = chosen.length === XI
  const captaincyOk =
    captainId !== undefined &&
    viceCaptainId !== undefined &&
    captainId !== viceCaptainId

  const canSubmit = complete && captaincyOk && !saving

  async function submit() {
    if (captainId === undefined || viceCaptainId === undefined) return
    setSaving(true)
    setError(undefined)
    setSaved(false)
    try {
      const submission = { lineup: selected, captainId, viceCaptainId }

      if (gameWeek !== undefined) {
        await updateTeamForGameWeek(
          league.leagueId,
          gameWeek.gameWeekId,
          submission,
        )
      } else if (match !== undefined) {
        await updateTeamForMatch(league.leagueId, match.matchId, submission)
      }
      setSaved(true)
      setExisting(selected)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  if (!playing) {
    return (
      <section className="rounded-xl border bg-card p-5 text-card-foreground sm:p-7">
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
          You are not playing in this league
        </h2>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          {league.myRoles.leagueOwner === true ||
          league.myRoles.leagueAdmin === true
            ? 'You run this league, which is not the same as playing in it. Join as a manager to pick a team.'
            : 'Join as a manager to pick a team.'}
        </p>

        <div className="mt-6">
          <Button onClick={() => setJoining(true)}>Join as a manager</Button>
        </div>

        <JoinLeagueDialog
          open={joining}
          onOpenChange={setJoining}
          league={{
            leagueId: league.leagueId,
            leagueName: league.leagueName,
            tournamentName: league.tournamentName,
          }}
          onJoined={reload}
        />
      </section>
    )
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }

  if (error !== undefined && pool.length === 0) {
    return (
      <div className="text-sm">
        <p className="font-semibold text-destructive">Could not load My Team</p>
        <p className="mt-1 font-mono text-xs text-muted-foreground">{error}</p>
      </div>
    )
  }

  if (pool.length === 0) {
    return (
      <section>
        <h2 className="text-base font-semibold">My Team</h2>
        <p className="mt-5 text-sm text-subtle-foreground">
          This tournament has no players yet, so there is nothing to pick from.
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-xl border bg-card p-5 text-card-foreground sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
            {existing === undefined ? 'Pick your eleven' : 'Your eleven'}
          </h2>
          <p className="mt-1.5 font-mono text-xs text-subtle-foreground">
            {picking(match, gameWeek)}
          </p>
        </div>

        <Button onClick={() => void submit()} disabled={!canSubmit}>
          {saving
            ? 'Submitting…'
            : existing === undefined
              ? 'Submit team'
              : 'Save team'}
        </Button>
      </div>

      <div className="mt-6 gap-5 lg:flex">
        <div className="min-w-0 flex-1">
          <div className="grid gap-2.5">
            {picks.map((pick, index) => (
              <PlayerPicker
                key={index}
                index={index}
                pool={pool}
                value={pick}
                taken={chosen}
                onChange={(next) =>
                  setPicks(picks.map((p, i) => (i === index ? next : p)))
                }
              />
            ))}
          </div>

          {/*
            Populated from the current eleven, and they cannot be the same
            player. The captain scores double and the vice captain one and a
            half, and neither is promoted if the other does not play.
          */}
          <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
            <Captaincy
              badge="C"
              label="Captain"
              selected={selected}
              value={captainId}
              exclude={viceCaptainId}
              onChange={setCaptainId}
            />
            <Captaincy
              badge="VC"
              label="Vice captain"
              selected={selected}
              value={viceCaptainId}
              exclude={captainId}
              onChange={setViceCaptainId}
            />
          </div>
        </div>

        <div className="mt-5 lg:mt-0 lg:w-[19rem] lg:shrink-0">
          <LineupSummary
            selected={selected}
            rules={rules}
            captainId={captainId}
            viceCaptainId={viceCaptainId}
          />

          {saved && <p className="mt-3 text-sm text-settled">Team saved.</p>}
          {error !== undefined && (
            <p className="mt-3 text-sm text-destructive">{error}</p>
          )}

          {/*
            Said out loud because a team applies forward until changed again, so
            this covers every match from here to the end.
          */}
          <p className="mt-3 text-xs text-subtle-foreground">
            {gameWeek === undefined
              ? 'This team applies to every match from here onward, until you change it.'
              : 'This team applies to every match in the gameweek, until you change it.'}
          </p>
        </div>
      </div>
    </section>
  )
}

/**
 * **The gameweek number, not its stored name.** A league created before the
 * naming was fixed carries its round's name on the gameweek, and reading the
 * number instead makes those read correctly without being rebuilt.
 */
function picking(
  match: Match | undefined,
  gameWeek: GameWeek | undefined,
): string {
  if (gameWeek !== undefined) return `Game week ${gameWeek.gameWeekNumber}`
  if (match !== undefined) return `From match ${match.matchNumber} onward`
  return ''
}

function Captaincy({
  badge,
  label,
  selected,
  value,
  exclude,
  onChange,
}: {
  badge: string
  label: string
  selected: Player[]
  value: PlayerId | undefined
  exclude: PlayerId | undefined
  onChange: (id: PlayerId) => void
}) {
  const player = selected.find((p) => p.playerId === value)

  return (
    <Select
      value={value ?? ''}
      onValueChange={(next) => onChange(next as PlayerId)}
    >
      <SelectTrigger
        aria-label={label}
        className="h-auto w-full justify-between gap-3 rounded-xl border bg-secondary/40 px-4 py-3.5 hover:bg-secondary/70 data-[size=default]:h-auto"
      >
        <span className="flex min-w-0 items-center gap-3.5">
          <span className="shrink-0 rounded-[4px] border px-1.5 py-0.5 font-mono text-[9.5px] tracking-[0.08em] text-subtle-foreground uppercase">
            {badge}
          </span>
          <span
            className={`truncate text-[15px] ${
              player === undefined ? 'text-subtle-foreground' : 'font-medium'
            }`}
          >
            {player?.playerName ?? label}
          </span>
        </span>
      </SelectTrigger>

      {/*
          **`popper`, not the default `item-aligned`.** Item-aligned positions
          the panel so the selected option sits over the trigger, which needs a
          `SelectValue` to anchor to and assumes a trigger one line tall. These
          rows are neither, and the panel ends up off screen — open, invisible,
          and holding the body scroll lock.
        */}
      <SelectContent
        position="popper"
        className="max-h-72 w-(--radix-select-trigger-width)"
      >
        {selected
          .filter((p) => p.playerId !== exclude)
          .map((p) => (
            <SelectItem key={p.playerId} value={p.playerId}>
              {p.playerName}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  )
}
