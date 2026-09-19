import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'

import { EditorFooter, type SaveStatus } from '@/components/admin/editor-card'
import { PageContainer } from '@/components/layout/page-container'
import { RoleTag } from '@/components/leagues/role-tag'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getPlayersForMatch,
  getStandardPointsForMatch,
  getTeams,
  getTournament,
  markTournamentComplete,
  updateStandardPoints,
} from '@/data-layer'
import { tournamentPath } from '@/routes'
import type {
  Match,
  MatchId,
  MatchSide,
  PlayerId,
  PlayerPoints,
  Team,
  Tournament,
  TournamentId,
} from '@/types'

/** A match opened for entry. Values are held as typed and parsed on save. */
interface Opened {
  match: Match
  sides: MatchSide[]
  values: Record<PlayerId, string>
}

/**
 * Standard points entry — `/tournaments/:tournamentId/points`, system admins
 * only.
 *
 * **Entering and correcting are the same page.** Opening a match that already
 * has points shows them, and saving replaces them.
 *
 * **The form appears already filled in, never filled in late.** The players
 * and the stored points load together and nothing renders until both arrive.
 * The write is a full replace, so a form shown empty and filled a moment later
 * is worse than a slow one: save before the fill lands and every player is
 * zeroed.
 *
 * **Choosing a match and opening it are separate steps**, and changing the
 * choice closes what is open, so points can never be typed against one match
 * and saved to another.
 */
export function TournamentPoints() {
  const { tournamentId } = useParams<{ tournamentId: string }>()

  const [tournament, setTournament] = useState<Tournament | undefined>(
    undefined,
  )
  const [teams, setTeams] = useState<Team[]>([])
  const [error, setError] = useState<string | undefined>(undefined)
  /* Bumped after a save, so "entered till" catches up. */
  const [reloadToken, setReloadToken] = useState(0)

  const [choice, setChoice] = useState<MatchId | undefined>(undefined)
  const [opened, setOpened] = useState<Opened | undefined>(undefined)
  const [opening, setOpening] = useState(false)
  const [openError, setOpenError] = useState<string | undefined>(undefined)

  const [status, setStatus] = useState<SaveStatus>('idle')
  const [message, setMessage] = useState<string | undefined>(undefined)
  const [finishing, setFinishing] = useState<'idle' | 'saving' | 'failed'>(
    'idle',
  )

  // The match most recently asked for, so a slow answer for an earlier choice
  // cannot land on top of a later one.
  const requested = useRef<MatchId | undefined>(undefined)

  useEffect(() => {
    if (tournamentId === undefined) return
    let cancelled = false

    void (async () => {
      try {
        const [loaded, allTeams] = await Promise.all([
          getTournament(tournamentId as TournamentId),
          getTeams(),
        ])
        if (cancelled) return

        setTournament(loaded)
        setTeams(allTeams)
        setError(undefined)
        // Only the first time. After a save the admin stays where they are.
        setChoice((current) => current ?? nextToScore(loaded))
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [tournamentId, reloadToken])

  const matches = ordered(tournament)
  const shortName = (teamId: string | undefined) =>
    teamId === undefined
      ? 'TBD'
      : (teams.find((t) => t.teamId === teamId)?.teamShortName ?? 'TBD')
  const label = (m: Match) =>
    `Match ${m.matchNumber} · ${shortName(m.team1Id)} v ${shortName(m.team2Id)}`

  const till = matches.find(
    (m) => m.matchId === tournament?.pointsUpdatedTillMatchId,
  )

  function choose(next: string) {
    setChoice(next as MatchId)
    setOpened(undefined)
    setOpenError(undefined)
    setStatus('idle')
    setOpening(false)
    requested.current = undefined
  }

  async function open() {
    if (tournament === undefined || choice === undefined) return
    const matchId = choice

    requested.current = matchId
    setOpened(undefined)
    setOpenError(undefined)
    setStatus('idle')
    setOpening(true)

    try {
      const [players, points] = await Promise.all([
        getPlayersForMatch(tournament.tournamentId, matchId),
        getStandardPointsForMatch(tournament.tournamentId, matchId),
      ])
      if (requested.current !== matchId) return

      setOpened({
        match: players.match,
        sides: players.sides,
        values: Object.fromEntries(
          players.sides
            .flatMap((side) => side.players)
            .map((p) => [p.playerId, String(points[p.playerId] ?? '')]),
        ),
      })
    } catch (e) {
      if (requested.current === matchId) {
        setOpenError(e instanceof Error ? e.message : String(e))
      }
    } finally {
      if (requested.current === matchId) setOpening(false)
    }
  }

  function edit(playerId: PlayerId, value: string) {
    if (opened === undefined) return
    setOpened({ ...opened, values: { ...opened.values, [playerId]: value } })
    setStatus('idle')
  }

  const invalid = new Set(
    Object.entries(opened?.values ?? {})
      .filter(([, value]) => parse(value) === undefined)
      .map(([playerId]) => playerId),
  )

  async function save() {
    if (tournament === undefined || opened === undefined) return

    // Every player, so the full replace is explicit. Blank reads as zero.
    const points: PlayerPoints = {}
    for (const [playerId, value] of Object.entries(opened.values)) {
      points[playerId as PlayerId] = parse(value) ?? 0
    }

    setStatus('saving')
    setMessage(undefined)
    try {
      await updateStandardPoints(
        tournament.tournamentId,
        opened.match.matchId,
        points,
      )
      setStatus('saved')
      setReloadToken((n) => n + 1)
    } catch (e) {
      setStatus('failed')
      setMessage(e instanceof Error ? e.message : String(e))
    }
  }

  async function finish() {
    if (tournament === undefined) return
    setFinishing('saving')
    try {
      await markTournamentComplete(tournament.tournamentId)
      setFinishing('idle')
      // The reread carries `completedAt`, which retires the prompt.
      setReloadToken((n) => n + 1)
    } catch {
      setFinishing('failed')
    }
  }

  return (
    <main className="py-10 sm:py-14">
      <PageContainer>
        {tournament !== undefined && (
          <Link
            to={tournamentPath(tournament.tournamentId)}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← {tournament.tournamentName}
          </Link>
        )}

        {error !== undefined ? (
          <div className="mt-6">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Tournament not available
            </h1>
            <p className="mt-2 font-mono text-xs text-muted-foreground">
              {error}
            </p>
          </div>
        ) : tournament === undefined ? (
          <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
              Update points
            </h1>
            <p className="mt-2 font-mono text-sm font-medium text-muted-foreground">
              {till === undefined
                ? 'No points entered yet'
                : `Points entered till ${label(till)}`}
            </p>

            {matches.length === 0 ? (
              <p className="mt-6 text-sm text-subtle-foreground">
                This tournament has no matches yet.
              </p>
            ) : (
              <section className="floodlit mt-6 rounded-xl border bg-card p-5 text-card-foreground sm:p-7">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="grid min-w-0 flex-1 gap-1.5 sm:max-w-sm">
                    <Label
                      htmlFor="points-match"
                      className="text-xs font-normal text-muted-foreground"
                    >
                      Match
                    </Label>
                    <Select value={choice} onValueChange={choose}>
                      <SelectTrigger id="points-match" className="w-full">
                        <SelectValue placeholder="Choose a match" />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        {matches.map((m) => (
                          <SelectItem key={m.matchId} value={m.matchId}>
                            {label(m)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => void open()}
                    disabled={choice === undefined || opening}
                  >
                    {opening ? 'Loading…' : 'Select match'}
                  </Button>
                </div>

                {openError !== undefined && (
                  <p className="mt-5 text-sm text-destructive">{openError}</p>
                )}

                {opened !== undefined && (
                  <Form
                    opened={opened}
                    invalid={invalid}
                    onEdit={edit}
                    footer={
                      <EditorFooter
                        status={status}
                        message={message}
                        savedLabel="Points saved."
                        onSave={() => void save()}
                        disabled={invalid.size > 0}
                      />
                    }
                  />
                )}

                {/*
                  **Prompted, never done automatically.** The last match's
                  points being in is the natural moment to ask, but the admin
                  may still have corrections or forgotten matches to add.
                */}
                {opened !== undefined &&
                  status === 'saved' &&
                  opened.match.matchId ===
                    matches[matches.length - 1]?.matchId &&
                  tournament.completedAt === undefined && (
                    <div className="mt-5 flex flex-wrap items-center gap-3 border-t pt-5">
                      <p className="text-sm">
                        That was the last match. Mark the tournament finished?
                      </p>
                      <Button
                        variant="outline"
                        disabled={finishing === 'saving'}
                        onClick={() => void finish()}
                      >
                        {finishing === 'saving'
                          ? 'Saving…'
                          : 'Mark tournament finished'}
                      </Button>
                      {finishing === 'failed' && (
                        <span className="font-mono text-xs text-destructive">
                          Could not mark it finished. Try again, or use the
                          admin page.
                        </span>
                      )}
                    </div>
                  )}
              </section>
            )}
          </>
        )}
      </PageContainer>
    </main>
  )
}

/**
 * **One block per team, stacked rather than tabled**, so it fits a phone. Side
 * by side from `lg`, where there is room.
 */
function Form({
  opened,
  invalid,
  onEdit,
  footer,
}: {
  opened: Opened
  invalid: ReadonlySet<string>
  onEdit: (playerId: PlayerId, value: string) => void
  footer: ReactNode
}) {
  const empty = opened.sides.every((side) => side.players.length === 0)

  if (empty) {
    return (
      <p className="mt-6 text-sm text-subtle-foreground">
        Neither team has any players in this tournament, so there is nobody to
        score.
      </p>
    )
  }

  return (
    <div className="mt-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {opened.sides.map((side) => (
          <div key={side.team.teamId}>
            <h2 className="font-mono text-[10px] tracking-[0.14em] text-subtle-foreground uppercase">
              {side.team.teamName}
            </h2>

            {side.players.length === 0 ? (
              <p className="mt-3 text-sm text-subtle-foreground">
                No players in this tournament.
              </p>
            ) : (
              <ul className="mt-3 grid gap-2">
                {side.players.map((player) => {
                  const id = `points-${player.playerId}`
                  const bad = invalid.has(player.playerId)
                  return (
                    <li
                      key={player.playerId}
                      className="lit flex items-center gap-3 rounded-lg border bg-secondary/30 px-3 py-2"
                    >
                      <Label
                        htmlFor={id}
                        className="flex min-w-0 flex-1 items-center gap-2 font-normal"
                      >
                        <span className="truncate">{player.playerName}</span>
                        <RoleTag role={player.playerRole} />
                      </Label>
                      <Input
                        id={id}
                        type="text"
                        inputMode="decimal"
                        value={opened.values[player.playerId] ?? ''}
                        onChange={(e) =>
                          onEdit(player.playerId, e.target.value)
                        }
                        aria-invalid={bad}
                        className="w-24 text-right font-mono"
                      />
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        ))}
      </div>

      {invalid.size > 0 && (
        <p className="mt-4 text-sm text-destructive">
          Some values are not numbers. Fix them to save.
        </p>
      )}

      {footer}
    </div>
  )
}

/** **In `matchNumber` order, never by id.** Push keys sort by creation time. */
function ordered(tournament: Tournament | undefined): Match[] {
  return Object.values(tournament?.matches ?? {}).sort(
    (a, b) => a.matchNumber - b.matchNumber,
  )
}

/**
 * The match after the last one scored, or the first if nothing is, or the last
 * if everything is — correcting it is the likeliest reason to be here then.
 */
function nextToScore(tournament: Tournament): MatchId | undefined {
  const matches = ordered(tournament)
  const till = matches.find(
    (m) => m.matchId === tournament.pointsUpdatedTillMatchId,
  )
  if (till === undefined) return matches[0]?.matchId

  return (
    matches.find((m) => m.matchNumber > till.matchNumber) ??
    matches[matches.length - 1]
  )?.matchId
}

/** Blank is zero. Anything else must be a finite number, negatives included. */
function parse(value: string): number | undefined {
  const trimmed = value.trim()
  if (trimmed === '') return 0
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : undefined
}
