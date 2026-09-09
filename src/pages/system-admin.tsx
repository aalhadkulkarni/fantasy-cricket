import { PagePlaceholder } from './page-placeholder'

/**
 * System admin — `/admin`.
 *
 * **System admins only**, and the route is guarded in the data layer rather
 * than only by hiding the link. Anyone can type a URL.
 */
export function SystemAdmin() {
  return (
    <PagePlaceholder
      title="Admin panel"
      intro="Cricket reference data, tournaments and scoring."
      coming="Competitions, teams, players, fixtures and standard points, plus publishing a tournament and marking one complete. See docs/08-pages/system-admin.md."
    />
  )
}
