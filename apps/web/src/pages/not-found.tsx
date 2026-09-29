import { PagePlaceholder } from './page-placeholder'

/**
 * Anything that matches no route.
 *
 * `docs/04-navigation.md` is explicit that a missing league, tournament or
 * match gets **a not-found state, not a blank page**. This is the same
 * treatment for a URL that was never a route at all.
 */
export function NotFound() {
  return (
    <PagePlaceholder
      title="Not found"
      intro="There is nothing at this address."
      coming="Eventually this should offer a way back rather than only saying no — home, or whichever league the URL was reaching for."
    />
  )
}
