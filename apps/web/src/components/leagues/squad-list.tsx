import type {
  ManagerSquadView,
  PlayerRole,
  SquadEntry,
} from '@fantasy-cricket/shared'
import { PLAYER_ROLES } from '@fantasy-cricket/shared'

import { price } from '@/components/auction/labels'
import { OverseasMark } from '@/components/auction/overseas-mark'
import { PlayerName } from '@/components/leagues/player-name'
import { RoleTag } from '@/components/leagues/role-tag'

/**
 * **One manager's squad**, one line per player: overseas mark, name and team,
 * role, and what they went for. The eleven to highlight — the manager's own
 * saved XI, or anyone else's locked one — is tinted, with C and VC marked.
 *
 * Read-only here. `squads.md` asks for the same rows, selectable, in the
 * Transfers offer builder, which is why it is a component of its own.
 *
 * One line per player rather than a table, so nothing scrolls sideways on a
 * phone.
 */
export function SquadList({
  entries,
  xi,
  homeNation,
}: {
  entries: readonly SquadEntry[]
  xi: ManagerSquadView['xi']
  homeNation: string
}) {
  if (entries.length === 0) {
    return (
      <p className="py-3 text-sm text-subtle-foreground">
        No players in this squad.
      </p>
    )
  }

  const inXi = new Set<string>(xi?.playerIds ?? [])

  return (
    <ul className="divide-y">
      {entries.map(({ player, pricePaid }) => {
        const picked = inXi.has(player.playerId)
        const mark =
          player.playerId === xi?.captainId
            ? 'C'
            : player.playerId === xi?.viceCaptainId
              ? 'VC'
              : undefined
        return (
          <li
            key={player.playerId}
            className={`flex items-center justify-between gap-3 px-2 py-2.5 ${
              picked ? 'bg-live/12 shadow-[inset_3px_0_0_var(--live)]' : ''
            }`}
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <OverseasMark player={player} homeNation={homeNation} keepSpace />
              <PlayerName player={player} className="text-[15px] font-medium" />
              <RoleTag role={player.playerRole} />
              {mark !== undefined && (
                <span className="shrink-0 rounded-[4px] bg-live/20 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold tracking-[0.08em]">
                  {mark}
                </span>
              )}
            </span>
            {pricePaid !== undefined && (
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {price(pricePaid)}
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

const ROLE_SHORT: Record<PlayerRole, string> = {
  batsman: 'BAT',
  bowler: 'BOWL',
  wicketKeeper: 'WK',
  allRounder: 'ALL',
}

/**
 * **What a squad is made of**: players per role, and overseas. A role with
 * fewer players than the XI needs is shown in red — that squad cannot field a
 * legal eleven, which the auction permits and the manager pays for at scoring.
 */
export function SquadMakeup({
  entries,
  homeNation,
  minimums,
}: {
  entries: readonly SquadEntry[]
  homeNation: string
  minimums: Partial<Record<PlayerRole, number>>
}) {
  const overseas = entries.filter(
    ({ player }) => player.country !== homeNation,
  ).length

  return (
    <p className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs text-muted-foreground">
      {PLAYER_ROLES.map((role) => {
        const count = entries.filter(
          ({ player }) => player.playerRole === role,
        ).length
        const short = count < (minimums[role] ?? 0)
        return (
          <span key={role} className={short ? 'text-destructive' : undefined}>
            {ROLE_SHORT[role]} {count}
          </span>
        )
      })}
      <span>Overseas {overseas}</span>
    </p>
  )
}
