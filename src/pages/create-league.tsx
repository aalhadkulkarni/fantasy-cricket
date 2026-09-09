import { PagePlaceholder } from './page-placeholder'

/**
 * Create a League — `/leagues/new`.
 *
 * Two entry points, one page. Arriving from a tournament prefills and locks the
 * tournament field; arriving from the header leaves it as the first thing to
 * choose.
 */
export function CreateLeague() {
  return (
    <PagePlaceholder
      title="Create a League"
      intro="Set up a league on a tournament and invite people to it."
      coming="The full configuration form: tournament, name, accessibility, slots, deadlines, scoring, gameweek structure and auction settings. See docs/08-pages/create-league.md."
    />
  )
}
