import { useCallback, useEffect, useState } from 'react'

import {
  countryOptions,
  emptyFields,
  fieldsFromPlayer,
  lastWord,
  type PlayerFields,
} from '@/components/admin/player-form'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  addPlayerToTeam,
  createPlayer,
  getCompetitions,
  getPlayerRoles,
  getPlayers,
  getTeams,
  removePlayerFromTeam,
  setPlayerRetired,
  updatePlayer,
} from '@/data-layer'
import { PLAYER_ROLES } from '@/types'
import type {
  Competition,
  Player,
  PlayerRoleRecord,
  Team,
  TeamId,
} from '@/types'

/** The value a team dropdown holds when the player is not in that competition. */
const NOT_IN_COMPETITION = '__none__'

/**
 * Players, on the admin panel.
 *
 * **One player at a time.** Bulk entry was designed and dropped: the catalogue
 * for playtesting is thirty-six players, and the recurring job later is
 * reassigning teams rather than creating people, which a spreadsheet import
 * would not have helped with anyway.
 *
 * **Retired players are not listed**, and there is no screen that lists them —
 * `system-admin.md` defers a Retired Players view to Phase 2 on the grounds
 * that retirement is rare enough not to come up in Phase 1.
 */
export function PlayersPanel({
  catalogueVersion,
  onChanged,
}: {
  /**
   * Bumped by the page when another panel writes something this one reads. A
   * team created above is a dropdown option here, and without this it would not
   * appear until a page refresh.
   */
  catalogueVersion: number
  /** Called after a write here, so the other panels reload too. */
  onChanged: () => void
}) {
  const [players, setPlayers] = useState<Player[] | undefined>(undefined)
  const [teams, setTeams] = useState<Team[]>([])
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [roles, setRoles] = useState<Record<string, PlayerRoleRecord>>({})
  const [error, setError] = useState<string | undefined>(undefined)
  const [editing, setEditing] = useState<Player | 'new' | undefined>(undefined)
  const [notice, setNotice] = useState<string | undefined>(undefined)
  /* A failed row action. Separate from `error`, which means the list itself
     could not load and replaces it. */
  const [problem, setProblem] = useState<string | undefined>(undefined)

  /*
    Bumped to reload. The fetch lives inside the effect rather than in a
    callback the effect calls, because state must not be set synchronously while
    an effect body runs — that cascades renders.
  */
  const [reloadToken, setReloadToken] = useState(0)
  const reload = useCallback(() => setReloadToken((n) => n + 1), [])

  useEffect(() => {
    // Guards against setting state after unmount, and against a slow first
    // response landing on top of a faster reload.
    let cancelled = false

    void (async () => {
      try {
        const [loadedPlayers, loadedTeams, loadedCompetitions, loadedRoles] =
          await Promise.all([
            getPlayers(),
            getTeams(),
            getCompetitions(),
            getPlayerRoles(),
          ])
        if (cancelled) return
        setPlayers(loadedPlayers)
        setTeams(loadedTeams)
        setCompetitions(loadedCompetitions)
        setRoles(byRoleId(loadedRoles))
        setError(undefined)
      } catch (e) {
        if (cancelled) return
        // An empty array rather than undefined: undefined reads as "still
        // loading" and would spin forever.
        setPlayers([])
        setError(e instanceof Error ? e.message : String(e))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [reloadToken, catalogueVersion])

  // A player's team is picked per base tournament, so with no teams there is
  // nothing to pick from.
  const canAdd = teams.length > 0

  /*
    Retiring from the row rather than only from inside the dialog. The write is
    a flag, but the effect is that the player leaves this list and there is no
    screen that lists the retired, so from here it does not come back — which is
    why the button asks twice.
  */
  async function retire(player: Player) {
    setNotice(undefined)
    setProblem(undefined)
    try {
      await setPlayerRetired(player.playerId, true)
      setNotice(
        `${player.playerName} is now fully retired, and no longer listed.`,
      )
      reload()
      onChanged()
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <section className="floodlit mt-4 rounded-lg border bg-card p-5 text-card-foreground sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Players</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cricketers, and which team they play for in each base tournament.
          </p>
        </div>
        <Button
          onClick={() => {
            setNotice(undefined)
            setEditing('new')
          }}
          disabled={!canAdd}
        >
          Create player
        </Button>
      </div>

      {!canAdd && (
        <p className="mt-3 text-sm text-subtle-foreground">
          Create a team first. A player's team is picked per base tournament, so
          there is nothing to pick from yet.
        </p>
      )}

      {notice !== undefined && (
        <p className="mt-3 text-sm text-settled">{notice}</p>
      )}

      {problem !== undefined && (
        <p className="mt-3 font-mono text-xs text-destructive">{problem}</p>
      )}

      <Body
        players={players}
        error={error}
        teams={teams}
        competitions={competitions}
        roles={roles}
        onEdit={(player) => {
          setNotice(undefined)
          setProblem(undefined)
          setEditing(player)
        }}
        onRetire={(player) => void retire(player)}
      />

      {editing !== undefined && (
        <PlayerDialog
          player={editing === 'new' ? undefined : editing}
          competitions={competitions}
          teams={teams}
          roles={roles}
          onClose={() => setEditing(undefined)}
          onSaved={(summary) => {
            setEditing(undefined)
            setNotice(summary)
            reload()
            // A membership change writes the team's roster too.
            onChanged()
          }}
        />
      )}
    </section>
  )
}

function Body({
  players,
  error,
  teams,
  competitions,
  roles,
  onEdit,
  onRetire,
}: {
  players: Player[] | undefined
  error: string | undefined
  teams: Team[]
  competitions: Competition[]
  roles: Record<string, PlayerRoleRecord>
  onEdit: (player: Player) => void
  onRetire: (player: Player) => void
}) {
  /* Which row is asking to be confirmed. One at a time, so arming a second
     disarms the first. */
  const [confirming, setConfirming] = useState<string | undefined>(undefined)

  if (error !== undefined) {
    return (
      <div className="mt-5 text-sm">
        <p className="font-semibold text-destructive">Could not load players</p>
        <p className="mt-1 font-mono text-xs text-muted-foreground">{error}</p>
      </div>
    )
  }

  if (players === undefined) {
    return <p className="mt-5 text-sm text-muted-foreground">Loading…</p>
  }

  if (players.length === 0) {
    return (
      <p className="mt-5 text-sm text-subtle-foreground">
        No players yet. Create one, then build a tournament from them.
      </p>
    )
  }

  return (
    <ul className="mt-5 divide-y border-t">
      {players.map((player) => (
        <li key={player.playerId} className="flex items-center gap-2">
          {/*
            Two controls now, so the row can no longer be one — a button cannot
            contain a button. The name still opens the editor and takes the
            width; retiring sits beside it, per rule 5 in the design system:
            buttons are for secondary actions.

            Stacked rather than columned at every width, the same shape the
            teams panel settled on, and for the same reason: a column wide
            enough for the longest name strands every shorter one beside a gap.
          */}
          <button
            type="button"
            onClick={() => onEdit(player)}
            className="min-w-0 flex-1 px-2 py-2.5 text-left hover:bg-accent"
          >
            <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
              <span className="text-sm font-semibold">{player.playerName}</span>
              <span className="font-mono text-xs text-subtle-foreground">
                {player.playerShortName}
              </span>
              <span className="text-xs text-muted-foreground">
                {roles[player.playerRole]?.playerRoleName ?? player.playerRole}{' '}
                · {player.country}
              </span>
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {teamSummary(player, teams, competitions)}
            </span>
          </button>

          {/*
            Two taps, because one is not enough for something this hard to undo.
            The write is only a flag, but a retired player leaves this list and
            no screen lists the retired, so there is no way back from here.
          */}
          {confirming === player.playerId ? (
            <Button
              variant="destructive"
              size="sm"
              className="shrink-0"
              onClick={() => {
                setConfirming(undefined)
                onRetire(player)
              }}
            >
              Confirm
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 text-muted-foreground"
              onClick={() => setConfirming(player.playerId)}
            >
              Retire
            </Button>
          )}
        </li>
      ))}
    </ul>
  )
}

function byRoleId(
  records: PlayerRoleRecord[],
): Record<string, PlayerRoleRecord> {
  return Object.fromEntries(records.map((r) => [r.playerRoleId, r]))
}

function teamSummary(
  player: Player,
  teams: Team[],
  competitions: Competition[],
): string {
  const entries = Object.entries(player.currentTeams ?? {})
  if (entries.length === 0) return 'No team'

  return entries
    .map(([competitionId, teamId]) => {
      const competition = competitions.find(
        (c) => c.competitionId === competitionId,
      )
      const team = teams.find((t) => t.teamId === teamId)
      return `${competition?.competitionName ?? competitionId}: ${team?.teamShortName ?? teamId}`
    })
    .sort()
    .join(' · ')
}

/**
 * One dialog for both create and edit, because the fields are identical and two
 * would drift apart.
 *
 * **Teams are stacked, one labelled dropdown per base tournament**, rather than
 * laid out as a row of columns. Six columns cannot fit a phone, and this screen
 * has to work on one.
 */
function PlayerDialog({
  player,
  competitions,
  teams,
  roles,
  onClose,
  onSaved,
}: {
  player: Player | undefined
  competitions: Competition[]
  teams: Team[]
  roles: Record<string, PlayerRoleRecord>
  onClose: () => void
  onSaved: (summary: string) => void
}) {
  const isEditing = player !== undefined
  const [fields, setFields] = useState<PlayerFields>(
    player === undefined ? emptyFields() : fieldsFromPlayer(player),
  )
  const [status, setStatus] = useState<'idle' | 'saving' | 'failed'>('idle')
  const [message, setMessage] = useState<string | undefined>(undefined)

  const set = (next: Partial<PlayerFields>) =>
    setFields((current) => ({ ...current, ...next }))

  // Country is required because it decides whether a player counts as overseas,
  // and a blank one would quietly read as not-India.
  const canSave =
    fields.playerName.trim() !== '' &&
    fields.country !== '' &&
    status !== 'saving'

  async function save() {
    setStatus('saving')
    setMessage(undefined)
    try {
      onSaved(isEditing ? await saveEdit() : await saveNew())
    } catch (e) {
      setStatus('failed')
      setMessage(e instanceof Error ? e.message : String(e))
    }
  }

  /**
   * The record and every team membership in one atomic write, so the reverse
   * side on each team lands with it or not at all.
   */
  async function saveNew(): Promise<string> {
    const name = fields.playerName.trim()
    const result = await createPlayer({
      playerName: name,
      playerShortName: fields.playerShortName.trim() || lastWord(name),
      country: fields.country,
      playerRole: fields.playerRole,
      currentTeams: fields.teams,
    })

    // An existing name is skipped rather than duplicated. For a single create
    // that is not a quiet success, it is the thing you wanted refused.
    if (result.created === 0) {
      throw new Error(`A player called ${name} already exists.`)
    }

    return `Created ${name}.`
  }

  /**
   * Fields go in one call; each changed membership goes through the function
   * that owns it, because each has to touch the team's roster too.
   */
  async function saveEdit(): Promise<string> {
    if (player === undefined) return ''
    const { playerId } = player
    const name = fields.playerName.trim()

    await updatePlayer(playerId, {
      playerName: name,
      playerShortName: fields.playerShortName.trim() || lastWord(name),
      country: fields.country,
      playerRole: fields.playerRole,
    })

    const before = player.currentTeams ?? {}

    for (const { competitionId } of competitions) {
      const was = before[competitionId]
      const now = fields.teams[competitionId]
      if (was === now) continue

      if (now === undefined) await removePlayerFromTeam(playerId, competitionId)
      else await addPlayerToTeam(playerId, now, competitionId)
    }

    return `Saved ${name}.`
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      {/*
        Capped and scrollable, because ten fields is taller than a phone. The
        dialog is centred, so one that outgrows the viewport would push its own
        buttons off screen.
      */}
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit player' : 'Create player'}
          </DialogTitle>
          <DialogDescription>
            A cricketer. Their team is picked per base tournament, because the
            same player is in different teams in different ones.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="player-name">Name</Label>
            <Input
              id="player-name"
              value={fields.playerName}
              onChange={(e) => set({ playerName: e.target.value })}
              placeholder="Jasprit Bumrah"
              autoFocus
              maxLength={60}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="player-short">Short name</Label>
            <Input
              id="player-short"
              value={fields.playerShortName}
              onChange={(e) => set({ playerShortName: e.target.value })}
              // Filled from the last word of the name on save if left blank,
              // which is right often enough to save real typing.
              placeholder={lastWord(fields.playerName) || 'Bumrah'}
              maxLength={20}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="player-country">Country</Label>
            <Select
              value={fields.country}
              onValueChange={(country) => set({ country })}
            >
              <SelectTrigger id="player-country" className="w-full">
                <SelectValue placeholder="Pick a country" />
              </SelectTrigger>
              <SelectContent>
                {countryOptions(fields.country).map((country) => (
                  <SelectItem key={country} value={country}>
                    {country}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="player-role">Role</Label>
            <Select
              value={fields.playerRole}
              onValueChange={(value) =>
                set({ playerRole: value as PlayerFields['playerRole'] })
              }
            >
              <SelectTrigger id="player-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLAYER_ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {roles[role]?.playerRoleName ?? role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <fieldset className="grid gap-3">
            <legend className="text-sm font-medium">Teams</legend>
            {competitions.length === 0 ? (
              <p className="text-sm text-subtle-foreground">
                No base tournaments exist yet. They are seeded by Set up basic
                system.
              </p>
            ) : (
              competitions.map((competition) => (
                <TeamPicker
                  key={competition.competitionId}
                  competition={competition}
                  teams={teams}
                  value={fields.teams[competition.competitionId]}
                  onChange={(teamId) => {
                    const next = { ...fields.teams }
                    if (teamId === undefined)
                      delete next[competition.competitionId]
                    else next[competition.competitionId] = teamId
                    set({ teams: next })
                  }}
                />
              ))
            )}
          </fieldset>

          {status === 'failed' && (
            <p className="font-mono text-xs text-destructive">{message}</p>
          )}
        </div>

        {/* Retiring lives on the row in the list, not here. One path to it. */}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={!canSave}>
            {status === 'saving' ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * **Only the teams that play in this base tournament.** The team records
 * already carry which competitions they are in, so the IPL dropdown cannot
 * offer Australia and the ODI Series dropdown cannot offer Mumbai Indians.
 */
function TeamPicker({
  competition,
  teams,
  value,
  onChange,
}: {
  competition: Competition
  teams: Team[]
  value: TeamId | undefined
  onChange: (teamId: TeamId | undefined) => void
}) {
  const eligible = teams.filter(
    (team) => team.competitionIds?.[competition.competitionId] === true,
  )

  const id = `team-${competition.competitionId}`

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs font-normal text-muted-foreground">
        {competition.competitionName}
      </Label>
      {eligible.length === 0 ? (
        <p className="text-sm text-subtle-foreground">
          No teams play in this yet.
        </p>
      ) : (
        <Select
          value={value ?? NOT_IN_COMPETITION}
          onValueChange={(next) =>
            onChange(next === NOT_IN_COMPETITION ? undefined : (next as TeamId))
          }
        >
          <SelectTrigger id={id} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {/*
              Blank means the player does not play in this base tournament,
              which is a real answer rather than a missing one. Radix will not
              take an empty string as an item value, so it needs a name.
            */}
            <SelectItem value={NOT_IN_COMPETITION}>
              <span className="text-subtle-foreground">Does not play</span>
            </SelectItem>
            {eligible.map((team) => (
              <SelectItem key={team.teamId} value={team.teamId}>
                {team.teamShortName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}
