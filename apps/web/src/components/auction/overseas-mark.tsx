import { PlaneIcon } from 'lucide-react'

import type { Player } from '@fantasy-cricket/shared'

/**
 * **An airplane before an overseas player's name.** Overseas means a country
 * other than the tournament's home nation; a tournament with none has no
 * overseas players, and nothing is drawn.
 *
 * Where a list mixes overseas and home players, pass `keepSpace` so names stay
 * aligned whether or not a row has the icon.
 */
export function OverseasMark({
  player,
  homeNation,
  keepSpace = false,
}: {
  player: Pick<Player, 'country'>
  homeNation: string | undefined
  keepSpace?: boolean
}) {
  const overseas = homeNation !== undefined && player.country !== homeNation

  if (!overseas) {
    return keepSpace ? <span className="size-3.5 shrink-0" aria-hidden /> : null
  }

  return (
    <PlaneIcon
      className="size-3.5 shrink-0 text-muted-foreground"
      role="img"
      aria-label="Overseas"
    />
  )
}
