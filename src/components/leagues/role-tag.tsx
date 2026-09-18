import type { PlayerRole } from '@/types'

/**
 * The small chip beside a player's name.
 *
 * Short enough to sit inline without pushing the name around, and distinguished
 * by its outline rather than by colour — the accent belongs to the floodlight.
 */
export function RoleTag({ role }: { role: PlayerRole }) {
  return (
    <span className="shrink-0 rounded-[4px] border px-1.5 py-0.5 font-mono text-[9.5px] tracking-[0.08em] text-subtle-foreground uppercase">
      {SHORT[role]}
    </span>
  )
}

const SHORT: Record<PlayerRole, string> = {
  batsman: 'BAT',
  bowler: 'BOWL',
  wicketKeeper: 'WK',
  allRounder: 'ALL',
}
