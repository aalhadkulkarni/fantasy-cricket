import {
  FORMAT_COMPETITIONS,
  LEAGUE_COLUMNS,
  type Competition,
  type Player,
  type PlayerImportRow,
  type PlayerRole,
  type Team,
  type TeamImportRow,
} from '@fantasy-cricket/shared'

/**
 * **Pasted CSV, shaped into rows.** One line per entry, values separated by
 * commas, trimmed; blank lines are ignored. Nothing here judges a value — the
 * service does, so the preview and the import apply the same rules.
 *
 * **The first line is skipped only if it is the header** — every column the
 * same as `header`, ignoring case and spacing — so a real first row is never
 * dropped.
 *
 * Plain commas, no quoting: names and teams do not contain commas, and a list
 * inside one value uses its own separator (`;` for base tournaments, `/` for
 * formats).
 */
function lines(text: string, header: string): string[][] {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .map((line) => line.split(',').map((cell) => cell.trim()))
  const normal = (cells: readonly string[]) =>
    cells.map((cell) => cell.toLowerCase().replace(/\s+/g, ' ')).join(',')
  const first = rows[0]
  return first !== undefined && normal(first) === normal(header.split(','))
    ? rows.slice(1)
    : rows
}

/** The team columns, in order. */
export const TEAM_HEADER = 'name,short name,base tournaments'

/** `name,short name,base tournaments` — base tournaments separated by `;`. */
export function parseTeams(text: string): TeamImportRow[] {
  return lines(text, TEAM_HEADER).map(
    ([teamName = '', teamShortName = '', competitions = '']) => ({
      teamName,
      teamShortName,
      competitionNames: competitions
        .split(';')
        .map((c) => c.trim())
        .filter((c) => c !== ''),
    }),
  )
}

/** The player columns, in order: the header a fetch writes. */
export const PLAYER_HEADER = [
  'name',
  'short name',
  'country',
  'role',
  'category',
  'base price',
  ...LEAGUE_COLUMNS.map((league) => `${league} team`),
  'international team',
  'formats',
].join(',')

/**
 * `name,short name,country,role,category,base price,IPL team,BBL team,international team,formats`
 * — formats separated by `/`.
 */
export function parsePlayers(text: string): PlayerImportRow[] {
  return lines(text, PLAYER_HEADER).map((cells) => {
    const at = (i: number) => cells[i] ?? ''
    const leagues = LEAGUE_COLUMNS.length
    return {
      playerName: at(0),
      playerShortName: at(1),
      country: at(2),
      role: at(3),
      category: at(4),
      basePrice: at(5),
      leagueTeams: LEAGUE_COLUMNS.map((competitionName, i) => ({
        competitionName,
        team: at(6 + i),
      })).filter((entry) => entry.team !== ''),
      internationalTeam: at(6 + leagues),
      formats: at(7 + leagues)
        .split(/[/\s]+/)
        .map((f) => f.trim())
        .filter((f) => f !== ''),
    }
  })
}

const ROLE_SHORT: Readonly<Record<PlayerRole, string>> = {
  batsman: 'BAT',
  bowler: 'BOWL',
  wicketKeeper: 'WK',
  allRounder: 'ALL',
}

/**
 * **Players as pasteable rows**, header first — what the fetch buttons write
 * into the text area, so values can be edited in place and imported back.
 * Unchanged rows re-import as unchanged.
 *
 * The international team is the one they play for in any international base
 * tournament, and the formats are the ones those base tournaments mean.
 */
export function playersCsv(
  players: readonly Player[],
  teams: readonly Team[],
  competitions: readonly Competition[],
): string {
  const idOf = new Map(
    competitions.map((c) => [c.competitionName, c.competitionId]),
  )
  const shortOf = new Map(teams.map((t) => [t.teamId, t.teamShortName]))

  const rows = players.map((player) => {
    const teamIn = (competitionName: string) => {
      const cid = idOf.get(competitionName)
      const teamId = cid === undefined ? undefined : player.currentTeams?.[cid]
      return teamId === undefined ? '' : (shortOf.get(teamId) ?? '')
    }

    let nation = ''
    const formats: string[] = []
    for (const [format, names] of Object.entries(FORMAT_COMPETITIONS)) {
      const team = names.map(teamIn).find((t) => t !== '')
      if (team !== undefined) {
        formats.push(format)
        if (nation === '') nation = team
      }
    }

    return [
      player.playerName,
      player.playerShortName,
      player.country,
      ROLE_SHORT[player.playerRole],
      player.playerCategory ?? '',
      player.playerBasePrice === undefined
        ? ''
        : String(player.playerBasePrice),
      ...LEAGUE_COLUMNS.map(teamIn),
      nation,
      formats.join('/'),
    ].join(',')
  })

  return [PLAYER_HEADER, ...rows].join('\n')
}
