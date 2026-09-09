import { useState } from 'react'

import { JoinLeagueDialog } from '@/components/join-league-dialog'
import {
  CardCaption,
  CardRow,
  CardStatus,
  CardTag,
  LeagueCard,
} from '@/components/leagues/league-card'
import { Button } from '@/components/ui/button'
import type { JoinableLeague } from '@/types'

/**
 * One league on a tournament page — the joining variant of the league card.
 *
 * **You may have no relationship with it.** On My Leagues a card is about a
 * league of yours and says where to go next; here it says how the league is
 * played, whether anyone can walk in, and whether there is room.
 *
 * **Closed leagues appear too.** Only entry is restricted, which is why a join
 * code is a shortcut rather than the access mechanism — a closed league can be
 * found here and requested with no code at all. Requesting is not built yet.
 */
export function LeagueRow({
  league,
  onJoined,
}: {
  league: JoinableLeague
  onJoined: () => void
}) {
  const [joining, setJoining] = useState(false)

  /*
    Pinned at mount rather than read during render, which would be impure and
    would not re-render when the moment passed anyway. A deadline going by while
    someone stares at the screen is caught by the data layer, which refuses the
    join regardless.
  */
  const [now] = useState(() => Date.now())

  const canJoin =
    league.leagueEntry === 'Open' &&
    league.filledSlots < league.maxSlots &&
    now <= league.joinDeadline &&
    league.myRoles.manager !== true &&
    league.myRoles.bannedFromLeague !== true

  return (
    <LeagueCard
      name={league.leagueName}
      tags={
        <>
          <CardTag>{league.isAuctionEnabled ? 'Auction' : 'Regular'}</CardTag>
          {/* Model vocabulary is Open and Private; users read public and closed. */}
          <CardTag>
            {league.leagueEntry === 'Open' ? 'Public' : 'Closed'}
          </CardTag>
          {/*
            Roles are additive, and running a league is not playing in it. The
            person who published the tournament owns its official leagues
            without holding a slot.
          */}
          {yourStanding(league) !== undefined && (
            <CardTag>{yourStanding(league)}</CardTag>
          )}
        </>
      }
      meta={
        <>
          <CardRow
            label="Managers"
            value={`${league.filledSlots} of ${league.maxSlots}`}
          />
          <CardRow
            label="Entry"
            value={
              league.leagueEntry === 'Open'
                ? 'Anyone can join'
                : 'Admin approves each request'
            }
          />
        </>
      }
      footer={
        <>
          <CardStatus tone={canJoin ? 'settled' : 'neutral'}>
            {standing(league, now)}
          </CardStatus>

          {canJoin ? (
            <Button size="sm" onClick={() => setJoining(true)}>
              Join
            </Button>
          ) : (
            <CardCaption>
              {league.filledSlots} of {league.maxSlots}
            </CardCaption>
          )}

          {joining && (
            <JoinLeagueDialog
              open
              onOpenChange={(next) => !next && setJoining(false)}
              league={league}
              onJoined={onJoined}
            />
          )}
        </>
      }
    />
  )
}

/**
 * The one line saying where this league stands for you. **Ordered by what stops
 * you joining first**, since that is the question the row exists to answer.
 */
function standing(league: JoinableLeague, now: number): string {
  if (league.myRoles.bannedFromLeague === true) return 'You are banned'
  if (league.myRoles.manager === true) return 'You are playing'
  if (league.leagueEntry !== 'Open') return 'Closed — admin approves'
  if (league.filledSlots >= league.maxSlots) return 'Full'
  if (now > league.joinDeadline) return 'Joining has closed'

  return `${league.maxSlots - league.filledSlots} places left`
}

/**
 * What to call your relationship with this league, or nothing if you have none.
 *
 * **Playing is checked first**, because it decides whether you can still join,
 * and because someone who both runs a league and plays in it cares more about
 * the second.
 */
function yourStanding(league: JoinableLeague): string | undefined {
  const roles = league.myRoles

  if (roles.manager === true) return 'You are playing'
  if (roles.leagueOwner === true) return 'You run this'
  if (roles.leagueAdmin === true) return 'You admin this'
  if (roles.spectator === true) return 'You are watching'
  if (roles.bannedFromLeague === true) return 'You are banned'

  return undefined
}
