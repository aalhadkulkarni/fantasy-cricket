/**
 * How the auction's ids read on screen, shared by Auction Center and the live
 * auction so the two never name a batch differently.
 *
 * Ids stay ids everywhere else; these are display only.
 */

import type {
  AuctionBatch,
  PlayerCategory,
  PlayerRole,
} from '@fantasy-cricket/shared'

export const CATEGORY_NAME: Readonly<Record<PlayerCategory, string>> = {
  marquee: 'Marquee',
  star: 'Star',
  general: 'General',
}

export const ROLE_PLURAL: Readonly<Record<PlayerRole, string>> = {
  batsman: 'Batsmen',
  bowler: 'Bowlers',
  wicketKeeper: 'Wicket keepers',
  allRounder: 'All-rounders',
}

/** "Marquee bowlers", or "Draft". */
export function batchName(batch: AuctionBatch): string {
  return batch.kind === 'draft'
    ? 'Draft'
    : `${CATEGORY_NAME[batch.playerCategory]} ${ROLE_PLURAL[
        batch.playerRole
      ].toLowerCase()}`
}

/** Two batches are the same step of the sequence. */
export function sameBatch(a: AuctionBatch, b: AuctionBatch): boolean {
  if (a.kind === 'draft' || b.kind === 'draft') return a.kind === b.kind
  return a.playerCategory === b.playerCategory && a.playerRole === b.playerRole
}

/** "5.5 cr" — a price with its unit, as the live round reads it. */
export function crore(value: number): string {
  return `${price(value)} cr`
}

/** Prices step by 0.5, so a half has to survive: 6.5, never 6.50 or 7. */
export function price(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}
