/**
 * **Whose turn it is in the draft.** Pure, so the order can be checked without
 * a database.
 *
 * The order snakes: 1 to N, then N back to 1, repeating. Turn *t* is lap
 * ⌊t / n⌋ and index t mod n, reversed on odd laps. **A manager who can no
 * longer pick is skipped, not blocked on** — their turn passes and the counter
 * moves on, so the snake keeps its shape for everyone else.
 */

import type { UserId } from '@fantasy-cricket/shared'

/** The manager a turn belongs to, before any skipping. */
export function managerForTurn(
  order: readonly UserId[],
  turn: number,
): UserId | undefined {
  const n = order.length
  if (n === 0 || turn < 0) return undefined
  const lap = Math.floor(turn / n)
  const index = turn % n
  return order[lap % 2 === 0 ? index : n - 1 - index]
}

/**
 * **The next turn someone can take**, from `fromTurn` on. Undefined when
 * nobody can pick any more.
 *
 * Two laps are enough to have offered every manager a turn, and being unable
 * to pick only ever becomes more true — budgets fall, squads fill, the pool
 * shrinks — so a sweep that finds nobody means the draft is over.
 */
export function nextDraftTurn(
  order: readonly UserId[],
  fromTurn: number,
  canPick: (managerId: UserId) => boolean,
): { turn: number; managerId: UserId } | undefined {
  for (let turn = fromTurn; turn < fromTurn + 2 * order.length; turn += 1) {
    const managerId = managerForTurn(order, turn)
    if (managerId !== undefined && canPick(managerId)) {
      return { turn, managerId }
    }
  }
  return undefined
}

/**
 * **The draft order as a list**, from `auctionDetails/draftOrder` — position
 * to manager, positions nobody holds left out.
 *
 * RTDB returns a map with small integer keys as an array, with holes where
 * positions are free, so both shapes are read.
 */
export function draftOrderList(raw: unknown): UserId[] {
  if (raw === null || typeof raw !== 'object') return []
  return Object.entries(raw)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    .map(([position, managerId]) => [Number(position), managerId] as const)
    .sort((a, b) => a[0] - b[0])
    .map(([, managerId]) => managerId as UserId)
}
