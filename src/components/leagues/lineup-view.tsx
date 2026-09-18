import { RoleTag } from '@/components/leagues/role-tag'
import type { Player, PlayerId } from '@/types'

/**
 * An eleven you cannot change — the same list whether it is locked because its
 * deadline passed or because you are looking back at a match already played.
 *
 * **Sorted by role**, so the shape of the team reads at a glance rather than in
 * the order the slots were filled.
 *
 * **No points column yet.** B8 adds one, along with the multipliers shown
 * transparently — a captain on 50 reads as 100 (50×2), never a bare 100. This
 * is the component that gains it.
 */
export function LineupView({
  lineup,
  captainId,
  viceCaptainId,
}: {
  lineup: readonly Player[]
  captainId: PlayerId
  viceCaptainId: PlayerId
}) {
  const ordered = [...lineup].sort(
    (a, b) =>
      ORDER.indexOf(a.playerRole) - ORDER.indexOf(b.playerRole) ||
      a.playerName.localeCompare(b.playerName),
  )

  return (
    <ul className="divide-y border-t border-b">
      {ordered.map((player) => (
        <li
          key={player.playerId}
          className="flex items-center justify-between gap-3 py-3.5"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="truncate text-[15px] font-medium">
              {player.playerName}
            </span>
            <RoleTag role={player.playerRole} />
            {/*
              The captain scores double and the vice-captain one and a half, and
              **the vice-captain is not promoted when the captain does not
              play** — the multipliers are fixed.
            */}
            {player.playerId === captainId && <Badge>C</Badge>}
            {player.playerId === viceCaptainId && <Badge>VC</Badge>}
          </span>
        </li>
      ))}
    </ul>
  )
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
