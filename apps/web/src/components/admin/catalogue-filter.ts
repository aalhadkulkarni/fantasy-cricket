import type {
  Competition,
  Player,
  PlayerRole,
  PlayerRoleRecord,
  Team,
} from '@fantasy-cricket/shared'

/**
 * **The admin lists' filter, matched in the browser** against what each panel
 * has already loaded — no request per keystroke.
 *
 * Case-insensitive, and **every word must match somewhere**, so `bowl mi`
 * narrows to Mumbai's bowlers. Each word matches anywhere inside a value, so
 * `bowl` finds bowlers as you type.
 */
function matches(query: string, haystack: readonly string[]): boolean {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w !== '')
  if (words.length === 0) return true
  const text = haystack.join(' ').toLowerCase()
  return words.every((word) => text.includes(word))
}

const ROLE_SHORT: Readonly<Record<PlayerRole, string>> = {
  batsman: 'BAT',
  bowler: 'BOWL',
  wicketKeeper: 'WK',
  allRounder: 'ALL',
}

/** A player, by name, any of their teams, role or category. */
export function playerMatches(
  player: Player,
  query: string,
  teams: readonly Team[],
  roles: Readonly<Record<string, PlayerRoleRecord>>,
): boolean {
  const theirTeams = Object.values(player.currentTeams ?? {}).flatMap(
    (teamId) => {
      const team = teams.find((t) => t.teamId === teamId)
      return team === undefined ? [] : [team.teamName, team.teamShortName]
    },
  )
  return matches(query, [
    player.playerName,
    player.playerShortName,
    ...theirTeams,
    player.playerRole,
    roles[player.playerRole]?.playerRoleName ?? '',
    ROLE_SHORT[player.playerRole],
    player.playerCategory ?? '',
  ])
}

/**
 * A team, by name, or by the name or format of any base tournament it plays
 * — so `ipl` finds the IPL sides and `odi` the national ones.
 */
export function teamMatches(
  team: Team,
  query: string,
  competitions: readonly Competition[],
): boolean {
  const plays = competitions.filter(
    (c) => team.competitionIds?.[c.competitionId] === true,
  )
  return matches(query, [
    team.teamName,
    team.teamShortName,
    ...plays.map((c) => c.competitionName),
    ...plays.map((c) => c.formatId),
  ])
}
