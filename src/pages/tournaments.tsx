import { PagePlaceholder } from './page-placeholder'

/**
 * Tournaments — `/tournaments`. The discovery surface.
 *
 * The interface says **Tournament** for what the model calls `tournaments`. The
 * level above, `competitions`, is a system-admin concept that never appears
 * under that name in anything a user sees.
 */
export function Tournaments() {
  return (
    <PagePlaceholder
      title="Tournaments"
      intro="Every tournament you can create a league against."
      coming="Upcoming, active and past tournaments, each showing its dates and format, with the leagues already running on it. Only published tournaments appear. See docs/08-pages/tournaments.md."
    />
  )
}
