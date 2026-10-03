import { PlayerName } from '@/components/leagues/player-name'
import { RoleTag } from '@/components/leagues/role-tag'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { Player, PlayerId, PlayerPoints } from '@fantasy-cricket/shared'

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
  breakdown,
}: {
  lineup: readonly Player[]
  captainId: PlayerId
  viceCaptainId: PlayerId
  /** Absent for an unscored match, which reads as zero throughout. */
  points: PlayerPoints
  totalLabel?: string
  /**
   * **Each match's points, for a period of more than one.** With it, a
   * player's points open the per-match figures on tap — option 2 in
   * `my-team.md`. A popover rather than a tooltip, because a tooltip needs
   * hover and most use is a phone.
   */
  breakdown?: readonly { label: string; points: PlayerPoints }[]
}) {
  const showBreakdown = breakdown !== undefined && breakdown.length > 1

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

  // Boxed like "Your XI" and Transfers beside it, so the three read as a set.
  return (
    <div className="lit rounded-xl border bg-secondary/30 p-5">
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
                <PlayerName
                  player={player}
                  className="text-[15px] font-medium"
                />
                <RoleTag role={player.playerRole} />
                {player.playerId === captainId && <Badge>C</Badge>}
                {player.playerId === viceCaptainId && <Badge>VC</Badge>}
              </span>

              {showBreakdown ? (
                <Popover>
                  <PopoverTrigger
                    className="-mr-1.5 shrink-0 rounded-md px-1.5 py-0.5 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    aria-label={`${player.playerName}: points in each match`}
                  >
                    <Points base={base} multiplier={multiplier} />
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-64">
                    <Breakdown
                      name={player.playerName}
                      playerId={player.playerId}
                      breakdown={breakdown}
                      base={base}
                      multiplier={multiplier}
                    />
                  </PopoverContent>
                </Popover>
              ) : (
                <Points base={base} multiplier={multiplier} />
              )}
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

function Points({ base, multiplier }: { base: number; multiplier: number }) {
  return (
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
  )
}

/**
 * **Raw points per match, and the multiplier once, on the total.** Applying
 * it per line would show three multiplied figures for one captaincy. A match
 * with no entry has not been scored for this player, which reads as a dash
 * rather than a zero the scorer typed.
 */
function Breakdown({
  name,
  playerId,
  breakdown,
  base,
  multiplier,
}: {
  name: string
  playerId: PlayerId
  breakdown: readonly { label: string; points: PlayerPoints }[]
  base: number
  multiplier: number
}) {
  return (
    <div className="text-sm">
      <p className="font-semibold">{name}</p>
      <ul className="mt-2 grid gap-1">
        {breakdown.map((entry) => {
          const value = entry.points[playerId]
          return (
            <li
              key={entry.label}
              className="flex items-baseline justify-between gap-3"
            >
              <span className="font-mono text-[11px] text-muted-foreground">
                {entry.label}
              </span>
              <span>{value === undefined ? '–' : format(value)}</span>
            </li>
          )
        })}
      </ul>
      <p className="mt-2 flex items-baseline justify-between gap-3 border-t pt-2 font-semibold">
        <span>Total</span>
        <span>
          {multiplier === 1
            ? format(base)
            : `${format(base)} ×${multiplier} = ${format(base * multiplier)}`}
        </span>
      </p>
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
