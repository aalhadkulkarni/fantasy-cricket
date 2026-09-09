import { useState } from 'react'

import { JoinLeagueDialog } from '@/components/join-league-dialog'
import { Button } from '@/components/ui/button'
import type { JoinableLeague } from '@/types'

/**
 * One league on a tournament page.
 *
 * **A variant of the My Leagues card, not a second implementation.** There the
 * card is about a league of yours and carries your status and where to go next.
 * Here you may have no relationship with it, so it carries what someone
 * deciding whether to join needs: how it is played, whether anyone can walk in,
 * and whether there is room.
 *
 * **Closed leagues appear too.** Only entry is restricted, which is why a join
 * code is a shortcut rather than the access mechanism — a closed league can be
 * found here and requested with no code at all.
 *
 * **Public leagues only.** A closed one is visible here and says so; requesting
 * to join it is not built yet.
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
    would not re-render when the moment passed anyway. The page reloads these
    rows after a join, and a deadline going by while someone stares at the
    screen is caught by the data layer, which refuses the join regardless.
  */
  const [now] = useState(() => Date.now())

  const full = league.filledSlots >= league.maxSlots
  const closed = league.leagueEntry !== 'Open'
  const past = now > league.joinDeadline
  const playing = league.myRoles.manager === true
  const banned = league.myRoles.bannedFromLeague === true

  // Every one of these is also refused by the data layer. Disabling here is
  // convenience; saying which one applies is the part that matters.
  const canJoin = !full && !closed && !past && !playing && !banned

  return (
    <article className="floodlit flex flex-col gap-3.5 rounded-lg border bg-card p-5 text-card-foreground">
      <div>
        <h3 className="text-[17px] leading-tight font-bold tracking-[-0.015em]">
          {league.leagueName}
        </h3>

        <div className="mt-2 flex flex-wrap gap-1.5">
          <Tag>{league.isAuctionEnabled ? 'Auction' : 'Regular'}</Tag>
          {/* Model vocabulary is Open and Private; users read public and closed. */}
          <Tag>{league.leagueEntry === 'Open' ? 'Public' : 'Closed'}</Tag>
          {/*
            Roles are additive, and running a league is not playing in it. The
            person who published the tournament owns its official leagues
            without holding a slot, so "you are playing" has to be a claim about
            `manager` and nothing else.
          */}
          {yourStanding(league) !== undefined && (
            <Tag>{yourStanding(league)}</Tag>
          )}
        </div>
      </div>

      <dl className="grid gap-[5px] font-mono text-[11px] text-subtle-foreground">
        <div className="flex justify-between gap-3">
          <dt>Managers</dt>
          <dd className="font-normal text-muted-foreground">
            {league.filledSlots} of {league.maxSlots}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Entry</dt>
          <dd className="font-normal text-muted-foreground">
            {league.leagueEntry === 'Open'
              ? 'Anyone can join'
              : 'Admin approves each request'}
          </dd>
        </div>
      </dl>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2.5 border-t pt-3">
        <div className="flex items-center gap-2 text-[13px] font-semibold">
          <span
            className={`inline-block size-[7px] rounded-full ${
              canJoin ? 'bg-settled' : 'bg-subtle-foreground'
            }`}
          />
          {standing(league, now)}
        </div>

        {canJoin ? (
          <Button size="sm" onClick={() => setJoining(true)}>
            Join
          </Button>
        ) : (
          <span className="font-mono text-[10.5px] whitespace-nowrap text-subtle-foreground">
            {league.filledSlots} of {league.maxSlots}
          </span>
        )}
      </div>

      {joining && (
        <JoinLeagueDialog
          open
          onOpenChange={(next) => !next && setJoining(false)}
          league={league}
          onJoined={onJoined}
        />
      )}
    </article>
  )
}

/**
 * What to call your relationship with this league, or nothing if you have none.
 *
 * **Playing is checked first**, because it is the one that decides whether you
 * can still join, and because someone who both runs a league and plays in it
 * cares more about the second.
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

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-[4px] border border-live-text/35 bg-live-text/10 px-[7px] py-[3px] font-mono text-[9.5px] tracking-[0.08em] text-live-text uppercase">
      {children}
    </span>
  )
}
