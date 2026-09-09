import { PagePlaceholder } from './page-placeholder'

/**
 * My Leagues — `/`, and **this is home**.
 *
 * Both the brand and the My Leagues header item point here. Home is this rather
 * than Tournaments because Tournaments is a discovery surface used a handful of
 * times ever, while this is where someone returns daily during a season.
 */
export function MyLeagues() {
  return (
    <PagePlaceholder
      title="My Leagues"
      intro="Home Test. Every league you have joined or are spectating."
      coming="Three tabs — Active, Pending and Archived — with a league card each, and an empty state when the first two are both empty. See docs/08-pages/my-leagues.md."
    />
  )
}
