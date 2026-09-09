import {
  CardCaption,
  CardRow,
  CardStatus,
  CardTag,
  LeagueCard,
} from '@/components/leagues/league-card'
import type {
  ArchivedLeagueCard,
  LeagueCard as Card,
  LeaguePhase,
} from '@/types'

/**
 * One of your leagues — the My Leagues variant of the league card.
 *
 * Shows **name, owner, type, tournament and status**, per `my-leagues.md`.
 * Everything else is behind view details, which is league home.
 *
 * **The count changes meaning with the phase.** Before the tournament starts it
 * is slots, because the question is whether there is still room. Once it is
 * running the ceiling stops meaning anything — nobody can join — so the count
 * stays as league context and the ceiling goes.
 *
 * **No rank here.** Rank needs the league's whole lineup subtree plus the points
 * node, which at forty managers across sixty matches is a quarter to half a
 * megabyte per league. It lives on league home instead.
 *
 * **Not a link yet.** The card body is meant to be the link to league home,
 * which does not exist as a route.
 */
export function MyLeagueCard({
  league,
}: {
  league: Card | ArchivedLeagueCard
}) {
  const archived = 'archivedAt' in league
  const spectating = league.myRoles.spectator === true
  const banned = league.myRoles.bannedFromLeague === true
  const pending = league.membershipStatus === 'Pending'

  return (
    <LeagueCard
      name={league.leagueName}
      tags={
        <>
          <CardTag>{league.isAuctionEnabled ? 'Auction' : 'Regular'}</CardTag>
          {/* A spectator is in the league without playing in it. */}
          {spectating && <CardTag>Spectating</CardTag>}
          {banned && <CardTag>Banned</CardTag>}
        </>
      }
      meta={
        <>
          <CardRow label="Tournament" value={league.tournamentName} />
          <CardRow label="Run by" value={league.ownerName} />
          {!archived && !pending && <Count league={league} />}
          {archived && league.finalRank !== undefined && (
            <CardRow label="You finished" value={`#${league.finalRank}`} />
          )}
        </>
      }
      footer={
        <>
          <CardStatus tone={league.phase === 'active' ? 'settled' : 'neutral'}>
            {pending ? 'Waiting on approval' : PHASE_LABEL[league.phase]}
          </CardStatus>
          {archived && (
            <CardCaption>
              finished {new Date(league.archivedAt).toLocaleDateString()}
            </CardCaption>
          )}
        </>
      }
    />
  )
}

/**
 * **Slots before the tournament starts, a plain count once it has.** Max slots
 * is dropped when a league goes active because nobody can join any more, so the
 * ceiling stops meaning anything.
 */
function Count({ league }: { league: Card }) {
  const stillFilling =
    league.phase === 'preAuction' ||
    league.phase === 'auction' ||
    league.phase === 'teamSubmission'

  return (
    <CardRow
      label="Managers"
      value={
        stillFilling
          ? `${league.filledSlots} of ${league.maxSlots}`
          : `${league.filledSlots}`
      }
    />
  )
}

/**
 * The same five states as league home. **One derivation shared by both**, in
 * `src/data-layer/league-phase.ts`; this only names them.
 *
 * **Named for what is happening, not for the state.** `my-leagues.md` lists
 * these as Pre-auction, Auction phase, Team submission, Active and Finished,
 * which are the internal names — "Team submission" on a card tells a reader
 * nothing about what they can do. Each label here says what the league is doing
 * and, where it matters, what it is waiting for from you.
 */
const PHASE_LABEL: Record<LeaguePhase, string> = {
  preAuction: 'Auction not started',
  auction: 'Auction ongoing',
  teamSubmission: 'Accepting team submissions',
  active: 'Active',
  finished: 'Finished',
}
