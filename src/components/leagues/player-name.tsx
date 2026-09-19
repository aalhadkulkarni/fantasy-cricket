import type { Player } from '@/types'

/**
 * A player's name with their team after it — "Virat Kohli (IND)". The team is
 * quieter than the name, and absent where no tournament is in context.
 *
 * Truncates the name rather than the team, so a long name on a phone still
 * shows who they play for.
 */
export function PlayerName({
  player,
  className = '',
}: {
  player: Pick<Player, 'playerName' | 'teamShortName'>
  className?: string
}) {
  return (
    <span className={`flex min-w-0 items-baseline gap-1.5 ${className}`}>
      <span className="truncate">{player.playerName}</span>
      {player.teamShortName !== undefined && (
        <span className="shrink-0 font-mono text-[11px] font-normal text-subtle-foreground">
          ({player.teamShortName})
        </span>
      )}
    </span>
  )
}
