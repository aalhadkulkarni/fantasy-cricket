/**
 * Whether a slot has changed since the previous period's team, and whether that
 * change is saved. **Yellow is a draft, green is saved**, so the same swap
 * reads as unfinished until it is submitted.
 */
export type Change = 'draft' | 'saved' | undefined

/** The row's border and tint. Unchanged rows keep the plain look. */
export function changeClass(change: Change): string {
  switch (change) {
    case 'draft':
      return 'border-pending/60 bg-pending/10 hover:bg-pending/15'
    case 'saved':
      return 'border-settled/60 bg-settled/10 hover:bg-settled/15'
    default:
      return 'bg-secondary/40 hover:bg-secondary/70'
  }
}
