import { useState } from 'react'

import {
  EditorCard,
  EditorFooter,
  type SaveStatus,
} from '@/components/admin/editor-card'
import { Checkbox } from '@/components/ui/checkbox'
import { updateTournamentParticipants } from '@/data-layer'
import type { Player, PlayerId, Team, TeamId, Tournament } from '@/types'

/**
 * Who is playing in this tournament.
 *
 * **A team is in because its players are.** There is one set of checkboxes, not
 * two: ticking a team ticks its players, and a team with none of its players
 * ticked is simply not in the tournament. Two independent lists could disagree
 * about whether a team with no players counts, and there is no useful answer to
 * that question.
 *
 * **The players offered are the ones whose current team plays this base
 * tournament.** That is the prefill the documents describe, and saving here
 * freezes it — a cricketer transferring later does not rewrite a tournament
 * that has already been played.
 */
export function TournamentParticipants({
  tournament,
  teams,
  players,
  onSaved,
}: {
  tournament: Tournament
  /** Every team, unfiltered. */
  teams: Team[]
  /** Every player, unfiltered. */
  players: Player[]
  onSaved: () => void
}) {
  const { competitionId } = tournament

  const eligibleTeams = teams
    .filter((team) => team.competitionIds?.[competitionId] === true)
    .sort((a, b) => a.teamName.localeCompare(b.teamName))

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(Object.keys(tournament.participatingPlayers ?? {})),
  )

  const playersByTeam = new Map<TeamId, Player[]>()
  for (const player of players) {
    const teamId = player.currentTeams?.[competitionId]
    if (teamId === undefined) continue
    // A retired player is not offered, but one already in this tournament stays
    // listed — retiring only sets a flag and leaves every membership intact, so
    // hiding them would drop them from the tournament on the next save.
    if (player.isRetired === true && !selected.has(player.playerId)) continue
    playersByTeam.set(teamId, [...(playersByTeam.get(teamId) ?? []), player])
  }
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [message, setMessage] = useState<string | undefined>(undefined)

  function toggleTeam(teamId: TeamId, on: boolean) {
    const next = new Set(selected)
    for (const player of playersByTeam.get(teamId) ?? []) {
      if (on) next.add(player.playerId)
      else next.delete(player.playerId)
    }
    setSelected(next)
    setStatus('idle')
  }

  function togglePlayer(playerId: string, on: boolean) {
    const next = new Set(selected)
    if (on) next.add(playerId)
    else next.delete(playerId)
    setSelected(next)
    setStatus('idle')
  }

  async function save() {
    setStatus('saving')
    setMessage(undefined)
    try {
      const participants: Partial<Record<PlayerId, TeamId>> = {}
      for (const player of players) {
        if (!selected.has(player.playerId)) continue
        const teamId = player.currentTeams?.[competitionId]
        if (teamId === undefined) continue
        participants[player.playerId] = teamId
      }

      await updateTournamentParticipants(tournament.tournamentId, participants)
      setStatus('saved')
      onSaved()
    } catch (e) {
      setStatus('failed')
      setMessage(e instanceof Error ? e.message : String(e))
    }
  }

  if (eligibleTeams.length === 0) {
    return (
      <EditorCard title="Teams and players">
        <p className="text-sm text-subtle-foreground">
          No team plays this base tournament yet. Add one on the admin panel
          first — a tournament draws its players from its teams.
        </p>
      </EditorCard>
    )
  }

  return (
    <EditorCard title="Teams and players">
      <p className="text-sm text-muted-foreground">
        Tick a team to include its whole squad, then untick anyone not touring.
        A team with nobody ticked is not in the tournament.
      </p>

      <div className="mt-5 grid gap-5">
        {eligibleTeams.map((team) => {
          const squad = (playersByTeam.get(team.teamId) ?? []).sort((a, b) =>
            a.playerName.localeCompare(b.playerName),
          )
          const chosen = squad.filter((p) => selected.has(p.playerId)).length

          return (
            <fieldset key={team.teamId}>
              <legend className="sr-only">{team.teamName}</legend>

              <label className="flex items-center gap-2.5 text-sm font-semibold">
                <Checkbox
                  checked={squad.length > 0 && chosen === squad.length}
                  onCheckedChange={(checked) =>
                    toggleTeam(team.teamId, checked === true)
                  }
                  disabled={squad.length === 0}
                />
                {team.teamName}
                <span className="font-mono text-xs font-normal text-subtle-foreground">
                  {chosen}/{squad.length}
                </span>
              </label>

              {squad.length === 0 ? (
                <p className="mt-1.5 pl-6.5 text-xs text-subtle-foreground">
                  No players list this team for this base tournament.
                </p>
              ) : (
                <div className="mt-2 grid gap-1.5 pl-6.5 sm:grid-cols-2">
                  {squad.map((player) => (
                    <label
                      key={player.playerId}
                      className="flex items-center gap-2.5 text-sm"
                    >
                      <Checkbox
                        checked={selected.has(player.playerId)}
                        onCheckedChange={(checked) =>
                          togglePlayer(player.playerId, checked === true)
                        }
                      />
                      <span className="min-w-0 truncate">
                        {player.playerName}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
          )
        })}
      </div>

      <EditorFooter
        status={status}
        message={message}
        savedLabel={`${selected.size} ${selected.size === 1 ? 'player' : 'players'} saved.`}
        onSave={() => void save()}
      />
    </EditorCard>
  )
}
