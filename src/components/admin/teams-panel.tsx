import { useCallback, useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
  createTeam,
  getCompetitions,
  getPlayers,
  getTeams,
  updateTeam,
} from '@/data-layer'
import type { Competition, CompetitionId, Player, Team } from '@/types'

/**
 * Teams, on the admin panel.
 *
 * **Nothing here deletes.** A team leaves a competition instead, which takes it
 * out of every tournament that could draw on it — see `08-pages/system-admin.md`.
 * That is why the edit dialog warns before removing one: the cascade also drops
 * the roster and every affected player's record of playing for the team.
 *
 * **Each team's squad is shown per base tournament**, sized on the row and
 * named in the edit dialog. It is read from the team's own roster rather than
 * by counting the players who name this team, which is the point: the two are
 * written together, and this is the only place a disagreement between them
 * would be visible.
 *
 * The interface says **Base Tournament** where the model says competition, and
 * the word "competition" never appears in anything a user reads.
 */
export function TeamsPanel({
  catalogueVersion,
  onChanged,
}: {
  /** Bumped by the page when another panel writes something this one reads. */
  catalogueVersion: number
  /** Called after a write here, so the panels below reload their dropdowns. */
  onChanged: () => void
}) {
  const [teams, setTeams] = useState<Team[] | undefined>(undefined)
  const [competitions, setCompetitions] = useState<Competition[]>([])
  /*
    Keyed by id, and **including the retired**. Retiring only flips a flag: it
    leaves the player in every roster, so resolving a roster with the default
    list would leave holes exactly where a retired player sits.
  */
  const [playersById, setPlayersById] = useState<Record<string, Player>>({})
  const [error, setError] = useState<string | undefined>(undefined)
  const [editing, setEditing] = useState<Team | 'new' | undefined>(undefined)

  /*
    Bumped to reload. The fetch lives inside the effect rather than in a
    callback the effect calls, because state must not be set synchronously
    while an effect body runs — that cascades renders.
  */
  const [reloadToken, setReloadToken] = useState(0)
  const reload = useCallback(() => setReloadToken((n) => n + 1), [])

  useEffect(() => {
    // Guards against setting state after unmount, and against a slow first
    // response landing on top of a faster reload.
    let cancelled = false

    void (async () => {
      try {
        const [loadedTeams, loadedCompetitions, loadedPlayers] =
          await Promise.all([
            getTeams(),
            getCompetitions(),
            getPlayers({ includeRetired: true }),
          ])
        if (cancelled) return
        setTeams(loadedTeams)
        setCompetitions(loadedCompetitions)
        setPlayersById(
          Object.fromEntries(loadedPlayers.map((p) => [p.playerId, p])),
        )
        setError(undefined)
      } catch (e) {
        if (cancelled) return
        // An empty array rather than undefined: undefined reads as "still
        // loading" and would spin forever.
        setTeams([])
        setError(e instanceof Error ? e.message : String(e))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [reloadToken, catalogueVersion])

  return (
    <section className="mt-4 rounded-lg border bg-card p-5 text-card-foreground sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Teams</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Real cricket teams, and which base tournaments they play in.
          </p>
        </div>
        <Button onClick={() => setEditing('new')}>Create team</Button>
      </div>

      <Body
        teams={teams}
        error={error}
        competitions={competitions}
        playersById={playersById}
        onEdit={setEditing}
      />

      {editing !== undefined && (
        <TeamDialog
          team={editing === 'new' ? undefined : editing}
          competitions={competitions}
          playersById={playersById}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined)
            reload()
            // A new team is a new option in the players table's dropdowns.
            onChanged()
          }}
        />
      )}
    </section>
  )
}

function Body({
  teams,
  error,
  competitions,
  playersById,
  onEdit,
}: {
  teams: Team[] | undefined
  error: string | undefined
  competitions: Competition[]
  playersById: Record<string, Player>
  onEdit: (team: Team) => void
}) {
  if (error !== undefined) {
    return (
      <div className="mt-5 text-sm">
        <p className="font-semibold text-destructive">Could not load teams</p>
        <p className="mt-1 font-mono text-xs text-muted-foreground">{error}</p>
      </div>
    )
  }

  if (teams === undefined) {
    return <p className="mt-5 text-sm text-muted-foreground">Loading…</p>
  }

  if (teams.length === 0) {
    return (
      <p className="mt-5 text-sm text-subtle-foreground">
        No teams yet. Create one, then add players to it.
      </p>
    )
  }

  return (
    <ul className="mt-5 divide-y border-t">
      {teams.map((team) => (
        <li key={team.teamId}>
          {/*
            The whole row is the control, per rule 5 in the design system:
            buttons are for secondary actions, and a row with one action does
            not need one.
          */}
          {/*
            Stacked rather than columned, at every width. A column wide enough
            for "Royal Challengers Bengaluru" strands every shorter name beside
            a gap, and columns narrow enough to look tight cannot hold it.
            Name over detail sidesteps the tension and reads the same on a
            phone.
          */}
          <button
            type="button"
            onClick={() => onEdit(team)}
            className="block w-full px-2 py-2.5 text-left hover:bg-accent"
          >
            <span className="flex items-baseline gap-2.5">
              <span className="text-sm font-semibold">{team.teamName}</span>
              <span className="font-mono text-xs text-subtle-foreground">
                {team.teamShortName}
              </span>
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {competitionNames(team, competitions, playersById)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

/**
 * Each base tournament with the size of this team's squad in it.
 *
 * **The count comes from the team's own roster**, not from counting players who
 * name this team. That is the point of showing it: the two are written together
 * and a disagreement between them is the failure this screen can catch by eye.
 *
 * **Retired players are not counted.** Retiring only sets a flag and leaves
 * every membership intact, so they stay in the roster — but a squad of one that
 * cannot field anybody reads as a squad of one, which is worse than useless.
 * They are named in the dialog instead.
 */
function competitionNames(
  team: Team,
  competitions: Competition[],
  playersById: Record<string, Player>,
): string {
  const ids = Object.keys(team.competitionIds ?? {})
  if (ids.length === 0) return 'No base tournaments'

  return ids
    .map((id) => {
      const name =
        competitions.find((c) => c.competitionId === id)?.competitionName ?? id
      const roster = rosterIds(team, id)
      const active = roster.filter(
        (playerId) => playersById[playerId]?.isRetired !== true,
      ).length
      const retired = roster.length - active

      return `${name} (${active}${retired > 0 ? `, ${retired} retired` : ''})`
    })
    .sort()
    .join(' · ')
}

function rosterIds(team: Team, competitionId: string): string[] {
  const roster = team.playerIds?.[competitionId as CompetitionId] ?? {}
  return Object.keys(roster)
}

/**
 * This team's squad in one base tournament, read from the team's own roster.
 *
 * **Both sides of a membership are written together**, so this is the half you
 * cannot see anywhere else — the players panel shows only the player's side. A
 * name here that does not list this team on its own record, or a player listing
 * this team and missing here, is the failure the atomic writes exist to
 * prevent, and this is where it would show.
 *
 * Retired players stay in a roster, since retiring only sets a flag. They are
 * marked rather than hidden, because a squad that silently shrank would read as
 * a bug in the write rather than as a retirement.
 */
function Roster({
  team,
  competitionId,
  playersById,
}: {
  team: Team
  competitionId: CompetitionId
  playersById: Record<string, Player>
}) {
  const ids = rosterIds(team, competitionId)
  if (ids.length === 0) return null

  const names = ids
    .map((playerId) => {
      const player = playersById[playerId]
      if (player === undefined) return `unknown (${playerId})`
      return player.isRetired
        ? `${player.playerShortName} (retired)`
        : player.playerShortName
    })
    .sort()

  return (
    /* Indented to clear the checkbox, so it reads as belonging to the row. */
    <p className="mt-1 pl-6.5 text-xs text-muted-foreground">
      {names.length} · {names.join(', ')}
    </p>
  )
}

/**
 * One dialog for both create and edit, because the fields are identical and two
 * would drift apart.
 */
function TeamDialog({
  team,
  competitions,
  playersById,
  onClose,
  onSaved,
}: {
  team: Team | undefined
  competitions: Competition[]
  playersById: Record<string, Player>
  onClose: () => void
  onSaved: () => void
}) {
  const [teamName, setTeamName] = useState(team?.teamName ?? '')
  const [teamShortName, setTeamShortName] = useState(team?.teamShortName ?? '')
  const [selected, setSelected] = useState<Set<string>>(
    new Set(Object.keys(team?.competitionIds ?? {})),
  )
  const [status, setStatus] = useState<'idle' | 'saving' | 'failed'>('idle')
  const [message, setMessage] = useState<string | undefined>(undefined)

  const originals = new Set(Object.keys(team?.competitionIds ?? {}))
  const removing = [...originals].filter((id) => !selected.has(id))

  const canSave =
    teamName.trim() !== '' && teamShortName.trim() !== '' && status !== 'saving'

  async function save() {
    setStatus('saving')
    try {
      const config = {
        teamName: teamName.trim(),
        teamShortName: teamShortName.trim(),
        competitionIds: [...selected] as CompetitionId[],
      }
      if (team === undefined) await createTeam(config)
      else await updateTeam(team.teamId, config)
      onSaved()
    } catch (e) {
      setStatus('failed')
      setMessage(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      {/*
        Capped and scrollable: a team in six base tournaments now lists six
        squads, which outgrows a phone. The dialog is centred, so one taller
        than the viewport would push its own buttons off screen.
      */}
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>
            {team === undefined ? 'Create team' : 'Edit team'}
          </DialogTitle>
          <DialogDescription>
            A real cricket team. It appears in a tournament only through the
            base tournaments you pick here.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="team-name">Name</Label>
            <Input
              id="team-name"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Royal Challengers Bengaluru"
              autoFocus
              maxLength={60}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="team-short">Short name</Label>
            <Input
              id="team-short"
              value={teamShortName}
              onChange={(e) => setTeamShortName(e.target.value)}
              placeholder="RCB"
              maxLength={6}
              className="font-mono uppercase"
            />
          </div>

          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">Base tournaments</legend>
            {competitions.length === 0 ? (
              <p className="text-sm text-subtle-foreground">
                None exist yet. They are seeded by Set up basic system.
              </p>
            ) : (
              competitions.map((competition) => (
                <div key={competition.competitionId}>
                  <label className="flex items-center gap-2.5 text-sm">
                    <Checkbox
                      checked={selected.has(competition.competitionId)}
                      onCheckedChange={(checked) => {
                        const next = new Set(selected)
                        if (checked === true)
                          next.add(competition.competitionId)
                        else next.delete(competition.competitionId)
                        setSelected(next)
                      }}
                    />
                    {competition.competitionName}
                  </label>

                  {team !== undefined && (
                    <Roster
                      team={team}
                      competitionId={competition.competitionId}
                      playersById={playersById}
                    />
                  )}
                </div>
              ))
            )}
          </fieldset>

          {/*
            Worth saying out loud. Unchecking a box here is the only destructive
            action on this screen, and what it destroys is not on it.
          */}
          {removing.length > 0 && (
            <p className="text-sm text-destructive">
              Removing{' '}
              {removing.length === 1 ? 'a base tournament' : 'base tournaments'}{' '}
              also clears this team's players for it, and those players will no
              longer list this team.
            </p>
          )}

          {status === 'failed' && (
            <p className="font-mono text-xs text-destructive">{message}</p>
          )}
        </div>

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
