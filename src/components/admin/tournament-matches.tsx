import { useState } from 'react'

import {
  EditorCard,
  EditorFooter,
  type SaveStatus,
} from '@/components/admin/editor-card'
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
import { addMatches, removeMatches, updateMatches } from '@/data-layer'
import type { Match, MatchConfig, Team, TeamId, Tournament } from '@/types'

/** A team dropdown holds this when the fixture is not yet decided. */
const NOT_DECIDED = '__tbd__'

interface MatchRow {
  matchId: string
  matchNumber: number
  team1Id: string
  team2Id: string
  /** As a `datetime-local` value, so the empty string means undated. */
  startsAt: string
  venue: string
}

/**
 * The fixture list.
 *
 * **A stack of blocks, not a table.** Five columns across sixty matches cannot
 * fit a phone, and this screen has to work on one — the same reason the player
 * entry matrix was abandoned.
 *
 * **One Save for the whole list**, because the tournament's start and end are
 * recomputed from every match at once. Saving match by match would recompute
 * from a half-changed picture each time.
 */
export function TournamentMatches({
  tournament,
  teams,
  onSaved,
}: {
  tournament: Tournament
  /** Every team, unfiltered — filtered here to the ones playing. */
  teams: Team[]
  onSaved: () => void
}) {
  const participating = teams
    .filter((team) => tournament.participatingTeams?.[team.teamId] === true)
    .sort((a, b) => a.teamName.localeCompare(b.teamName))

  const [rows, setRows] = useState<MatchRow[]>(() =>
    rowsFromTournament(tournament),
  )
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [message, setMessage] = useState<string | undefined>(undefined)
  const [adding, setAdding] = useState('1')
  const [confirmingRemove, setConfirmingRemove] = useState(false)

  const lastNumber = rows[rows.length - 1]?.matchNumber ?? 0

  const update = (matchId: string, next: Partial<MatchRow>) => {
    setRows((current) =>
      current.map((row) =>
        row.matchId === matchId ? { ...row, ...next } : row,
      ),
    )
    setStatus('idle')
  }

  async function save() {
    setStatus('saving')
    setMessage(undefined)
    try {
      await updateMatches(tournament.tournamentId, rows.map(toConfig))
      setStatus('saved')
      onSaved()
    } catch (e) {
      setStatus('failed')
      setMessage(e instanceof Error ? e.message : String(e))
    }
  }

  async function append() {
    const count = Number(adding)
    if (!Number.isInteger(count) || count < 1) return

    setStatus('saving')
    setMessage(undefined)
    try {
      await addMatches(tournament.tournamentId, count)
      setAdding('1')
      onSaved()
    } catch (e) {
      setStatus('failed')
      setMessage(e instanceof Error ? e.message : String(e))
    }
  }

  async function drop() {
    setStatus('saving')
    setMessage(undefined)
    try {
      await removeMatches(tournament.tournamentId, 1)
      setConfirmingRemove(false)
      onSaved()
    } catch (e) {
      setStatus('failed')
      setMessage(e instanceof Error ? e.message : String(e))
    }
  }

  if (rows.length === 0) {
    return (
      <EditorCard title="Fixtures">
        <p className="text-sm text-subtle-foreground">
          This tournament has no matches, which should not be possible. Add one
          below.
        </p>
        <AddMatches
          value={adding}
          onChange={setAdding}
          onAdd={() => void append()}
        />
      </EditorCard>
    )
  }

  return (
    <EditorCard title="Fixtures">
      <p className="text-sm text-muted-foreground">
        Leave a team or a date blank where it is not yet announced. The
        tournament's start and end come from these.
      </p>

      {participating.length === 0 && (
        <p className="mt-3 text-sm text-subtle-foreground">
          No teams are in this tournament yet, so there is nobody to pick. Set
          the teams above first.
        </p>
      )}

      <div className="mt-5 grid gap-5">
        {rows.map((row) => (
          <div
            key={row.matchId}
            className="border-t pt-4 first:border-t-0 first:pt-0"
          >
            <p className="font-mono text-xs tracking-wide text-subtle-foreground uppercase">
              Match {row.matchNumber}
            </p>

            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <TeamPicker
                id={`${row.matchId}-team1`}
                label="Team 1"
                teams={participating}
                value={row.team1Id}
                onChange={(team1Id) => update(row.matchId, { team1Id })}
              />
              <TeamPicker
                id={`${row.matchId}-team2`}
                label="Team 2"
                teams={participating}
                value={row.team2Id}
                onChange={(team2Id) => update(row.matchId, { team2Id })}
              />

              <div className="grid gap-1.5">
                <Label
                  htmlFor={`${row.matchId}-start`}
                  className="text-xs font-normal text-muted-foreground"
                >
                  Start
                </Label>
                <Input
                  id={`${row.matchId}-start`}
                  type="datetime-local"
                  value={row.startsAt}
                  onChange={(e) =>
                    update(row.matchId, { startsAt: e.target.value })
                  }
                />
              </div>

              <div className="grid gap-1.5">
                <Label
                  htmlFor={`${row.matchId}-venue`}
                  className="text-xs font-normal text-muted-foreground"
                >
                  Venue
                </Label>
                <Input
                  id={`${row.matchId}-venue`}
                  value={row.venue}
                  onChange={(e) =>
                    update(row.matchId, { venue: e.target.value })
                  }
                  placeholder="Optional"
                  maxLength={60}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <EditorFooter
        status={status}
        message={message}
        savedLabel="Fixtures saved."
        onSave={() => void save()}
      />

      <AddMatches
        value={adding}
        onChange={setAdding}
        onAdd={() => void append()}
      />

      {/*
        Removing is only possible off the end, and only on a draft. Once a
        tournament is published a league can exist against it, and a match can
        carry lineups and points — which is why nothing else in this admin
        deletes at all.
      */}
      {rows.length > 1 && tournament.publishedAt === undefined && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {confirmingRemove ? (
            <>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => void drop()}
              >
                Remove match {lastNumber}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmingRemove(false)}
              >
                Keep it
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => setConfirmingRemove(true)}
            >
              Remove the last match
            </Button>
          )}
        </div>
      )}
    </EditorCard>
  )
}

/**
 * Appending is its own write, not part of Save. It changes the round structure
 * as well as the match list, so mixing it into an edit of existing fixtures
 * would make one button do two unrelated things.
 */
function AddMatches({
  value,
  onChange,
  onAdd,
}: {
  value: string
  onChange: (value: string) => void
  onAdd: () => void
}) {
  return (
    <div className="mt-6 flex flex-wrap items-end gap-3 border-t pt-5">
      <div className="grid gap-1.5">
        <Label
          htmlFor="add-matches"
          className="text-xs font-normal text-muted-foreground"
        >
          Add more matches
        </Label>
        <Input
          id="add-matches"
          type="number"
          min={1}
          max={100}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-24"
        />
      </div>
      <Button variant="outline" onClick={onAdd}>
        Add
      </Button>
      <p className="text-xs text-subtle-foreground">
        Appended after the last match and added to the final round.
      </p>
    </div>
  )
}

function TeamPicker({
  id,
  label,
  teams,
  value,
  onChange,
}: {
  id: string
  label: string
  teams: Team[]
  value: string
  onChange: (teamId: string) => void
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs font-normal text-muted-foreground">
        {label}
      </Label>
      <Select
        value={value === '' ? NOT_DECIDED : value}
        onValueChange={(next) => onChange(next === NOT_DECIDED ? '' : next)}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NOT_DECIDED}>
            <span className="text-subtle-foreground">Not decided</span>
          </SelectItem>
          {teams.map((team) => (
            <SelectItem key={team.teamId} value={team.teamId}>
              {team.teamShortName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

/** **In `matchNumber` order, never by id.** Push keys sort by creation time. */
function rowsFromTournament(tournament: Tournament): MatchRow[] {
  return Object.values(tournament.matches ?? {})
    .sort((a, b) => a.matchNumber - b.matchNumber)
    .map(toRow)
}

function toRow(match: Match): MatchRow {
  return {
    matchId: match.matchId,
    matchNumber: match.matchNumber,
    team1Id: match.team1Id ?? '',
    team2Id: match.team2Id ?? '',
    startsAt: toLocalInput(match.startTimestamp),
    venue: match.venue ?? '',
  }
}

function toConfig(row: MatchRow): MatchConfig {
  return {
    matchId: row.matchId as MatchConfig['matchId'],
    team1Id: row.team1Id === '' ? undefined : (row.team1Id as TeamId),
    team2Id: row.team2Id === '' ? undefined : (row.team2Id as TeamId),
    startTimestamp: fromLocalInput(row.startsAt),
    venue: row.venue.trim() === '' ? undefined : row.venue.trim(),
  }
}

/**
 * `datetime-local` speaks the viewer's own timezone with no offset in the
 * string, so both directions go through the local calendar rather than
 * `toISOString`, which would silently shift by the offset.
 */
function toLocalInput(timestamp: number | undefined): string {
  if (timestamp === undefined) return ''

  const date = new Date(timestamp)
  const pad = (n: number) => String(n).padStart(2, '0')

  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

function fromLocalInput(value: string): number | undefined {
  if (value === '') return undefined
  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? undefined : parsed
}
