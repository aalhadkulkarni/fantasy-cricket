import { PagePlaceholder } from './page-placeholder'

/**
 * Actions Center — `/actions`.
 *
 * **Entirely derived.** Nothing is stored, nothing is written, and there is no
 * read state. An item stays until the underlying thing resolves, which is why
 * this exists instead of notifications — a dismissed notification for a pending
 * transfer is a lost transfer.
 */
export function ActionsCenter() {
  return (
    <PagePlaceholder
      title="Actions Center"
      intro="Everything currently waiting on you."
      coming="Join requests awaiting your approval, your own pending requests, incoming transfer offers, a live auction in one of your leagues, a team deadline with no team set, and your unpicked draft turn. See docs/08-pages/actions-center.md."
    />
  )
}
