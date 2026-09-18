import { RoleTag } from '@/components/leagues/role-tag'
import type { Player, PlayerId, PlayerPoints } from '@/types'

/** Fixed, and the vice-captain is never promoted when the captain does not play. */
const CAPTAIN = 2
const VICE_CAPTAIN = 1.5

/**
 * An eleven you cannot change — the same list whether it is locked because its
 * deadline passed or because you are looking back at a match already played.
 *
 * **Sorted by role**, so the shape of the team reads at a glance rather than in
 * the order the slots were filled.
 *
 * **Multipliers are shown, not just applied.** A captain who scored 89 reads as
 * 178 with `89×2` beside it, never a bare 178. The working is dropped when the
 * base is zero, since `0 (0×2)` is noise rather than transparency.
 */
export function LineupView({
  lineup,
  captainId,
  viceCaptainId,
  points,
  /** What the total is summed over. A gameweek says "gameweek", not "match". */
  totalLabel = 'Total',
}: {
  lineup: readonly Player[]
  captainId: PlayerId
  viceCaptainId: PlayerId
  /** Absent for an unscored match, which reads as zero throughout. */
  points: PlayerPoints
  totalLabel?: string
}) {
  const ordered = [...lineup].sort(
    (a, b) =>
      ORDER.indexOf(a.playerRole) - ORDER.indexOf(b.playerRole) ||
      a.playerName.localeCompare(b.playerName),
  )

  const multiplierFor = (playerId: PlayerId) =>
    playerId === captainId
      ? CAPTAIN
      : playerId === viceCaptainId
        ? VICE_CAPTAIN
        : 1

  const total = ordered.reduce(
    (sum, player) =>
      sum + (points[player.playerId] ?? 0) * multiplierFor(player.playerId),
    0,
  )

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 pb-2">
        <span className="font-mono text-[10px] tracking-[0.14em] text-subtle-foreground uppercase">
          Player
        </span>
        <span className="font-mono text-[10px] tracking-[0.14em] text-subtle-foreground uppercase">
          Points
        </span>
      </div>

      <ul className="divide-y border-t border-b">
        {ordered.map((player) => {
          const base = points[player.playerId] ?? 0
          const multiplier = multiplierFor(player.playerId)

          return (
            <li
              key={player.playerId}
              className="flex items-center justify-between gap-3 py-3.5"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="truncate text-[15px] font-medium">
                  {player.playerName}
                </span>
                <RoleTag role={player.playerRole} />
                {player.playerId === captainId && <Badge>C</Badge>}
                {player.playerId === viceCaptainId && <Badge>VC</Badge>}
              </span>

              <span className="flex shrink-0 items-baseline gap-2.5">
                <span className="text-[15px] font-semibold">
                  {format(base * multiplier)}
                </span>
                {multiplier !== 1 && base !== 0 && (
                  <span className="font-mono text-[10.5px] text-subtle-foreground">
                    {format(base)}×{multiplier}
                  </span>
                )}
              </span>
            </li>
          )
        })}
      </ul>

      {/* Sums the multiplied values, not the raw ones. */}
      <div className="flex items-baseline justify-between gap-3 pt-3.5">
        <span className="text-[15px] font-bold">{totalLabel}</span>
        <span className="text-[15px] font-bold">{format(total)}</span>
      </div>
    </div>
  )
}

/** A vice-captain on 45 scores 67.5, so halves have to survive. */
function format(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function Badge({ children }: { children: string }) {
  return (
    <span className="shrink-0 rounded-[4px] border bg-secondary px-1.5 py-0.5 font-mono text-[9.5px] tracking-[0.08em] uppercase">
      {children}
    </span>
  )
}

/** Batsmen, keepers, all rounders, bowlers — the order a scorecard uses. */
const ORDER = ['batsman', 'wicketKeeper', 'allRounder', 'bowler'] as const
