import { useMemo } from 'react'

import { PlayerName } from '@/components/leagues/player-name'
import { RoleTag } from '@/components/leagues/role-tag'

import { indexPool, momentOf } from './auction-derived'
import { useAuction, useAuctionStatic } from './auction-store'
import { Countdown } from './countdown'
import { crore } from './labels'
import { OverseasMark } from './overseas-mark'

/**
 * **What is happening right now**, in the largest type on the page: the
 * player up, the leading bid and who holds it, what the next bid costs, and
 * the time left. Between players it carries the headline instead — who the
 * last one went to — and in the draft, whose turn it is.
 */
export function Stage() {
  const data = useAuctionStatic()
  const state = useAuction((s) => s.state)
  const round = useAuction((s) => s.round)
  const players = useAuction((s) => s.players)
  const viewerId = useAuction((s) => s.viewer.userId)
  const draftPick = useAuction((s) => s.draftPick)

  const pool = useMemo(() => indexPool(data.pool), [data.pool])
  const teamName = (userId: string | undefined) => {
    if (userId === undefined) return 'nobody'
    if (userId === viewerId) return 'you'
    const member = data.members.find((m) => m.userId === userId)
    return member?.fantasyTeamName ?? member?.userName ?? 'a manager'
  }
  /** The team's name even when it is the viewer's, as a sale reads. */
  const buyerName = (userId: string) => {
    const member = data.members.find((m) => m.userId === userId)
    return member?.fantasyTeamName ?? member?.userName ?? 'a manager'
  }

  const moment = momentOf(state, round)

  // What the turn's pick went for, once sold.
  const pickStatus =
    draftPick === undefined || draftPick.skipped === true
      ? undefined
      : players[draftPick.playerId]
  const pickPrice =
    pickStatus?.status === 'Sold' ? pickStatus.winningBid : undefined
  const current =
    state?.currentPlayerId === undefined
      ? undefined
      : pool.get(state.currentPlayerId)

  // Everyone who has passed on this player, as the auctioneer accepted it.
  // Passing is irreversible for the round, so they are out until the next.
  const outOfBidding = Object.values(round?.noBids ?? {}).map((noBid) =>
    teamName(noBid.managerId),
  )

  // The headline after a round: the last resolved player and what became of
  // them, read from their status rather than from the timeline.
  const lastId = state?.lastPlayerId ?? state?.currentPlayerId
  const last = lastId === undefined ? undefined : pool.get(lastId)
  const lastStatus = lastId === undefined ? undefined : players[lastId]

  return (
    <section className="floodlit rounded-xl border bg-card p-5 text-card-foreground sm:p-6">
      {moment === 'notStarted' && (
        <Headline
          title="The auction hasn't started"
          detail={`Starts ${new Date(
            data.settings.auctionStartTime,
          ).toLocaleString(undefined, {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            hour: 'numeric',
            minute: '2-digit',
          })}`}
        />
      )}

      {moment === 'ended' && (
        <Headline
          title="The auction has ended"
          detail="Every sale, and the bidding on each player, is below."
        />
      )}

      {moment === 'recovering' && (
        <Headline
          title="The auctioneer is correcting the auction"
          detail="Bidding is on hold until they finish."
        />
      )}

      {/*
        Once the turn's pick is accepted it is the headline, like a sale, until
        the auctioneer moves the turn on.
      */}
      {moment === 'draft' &&
        (draftPick?.skipped === true ? (
          <Headline
            title={`${buyerName(draftPick.managerId)}'s turn was skipped`}
            detail="Waiting for the next turn."
          />
        ) : draftPick?.accepted === true ? (
          <Headline
            title={`${buyerName(draftPick.managerId)} picked ${
              pool.get(draftPick.playerId)?.player.playerName ?? 'a player'
            }${pickPrice === undefined ? '' : ` for ${crore(pickPrice)}`}`}
            detail="Waiting for the next turn."
          />
        ) : (
          <Headline
            title={
              state?.currentDraftManagerId === undefined
                ? 'The draft is about to start'
                : state.currentDraftManagerId === viewerId
                  ? 'Your turn to pick'
                  : `${teamName(state.currentDraftManagerId)} to pick`
            }
            detail="Picks go at base price, in draft order."
          />
        ))}

      {moment === 'betweenPlayers' &&
        (last !== undefined && lastStatus?.status === 'Sold' ? (
          <Headline
            title={`${last.player.playerName} sold to ${buyerName(
              lastStatus.managerId,
            )} for ${crore(lastStatus.winningBid)}`}
            detail="Waiting for the next player."
          />
        ) : last !== undefined && lastStatus?.status === 'Unsold' ? (
          <Headline
            title={`${last.player.playerName} unsold`}
            detail="Waiting for the next player."
          />
        ) : (
          <Headline
            title="Waiting for the next player"
            detail="The auctioneer is choosing who goes up."
          />
        ))}

      {(moment === 'selected' ||
        moment === 'bidding' ||
        moment === 'paused' ||
        moment === 'timeUp' ||
        moment === 'sold' ||
        moment === 'unsold') &&
        current !== undefined && (
          <div>
            {/*
              One title line: who, their team, their base price. "Next
              player" while they are only selected, "Current player" once
              bidding opens.
            */}
            <h2 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base leading-snug sm:text-lg">
              <span className="text-muted-foreground">
                {moment === 'selected' ? 'Next player' : 'Current player'}
              </span>
              <OverseasMark
                player={current.player}
                homeNation={data.settings.homeNation}
              />
              <PlayerName
                player={current.player}
                className="font-bold text-foreground"
              />
              <RoleTag role={current.player.playerRole} />
              <span className="text-muted-foreground">
                · Base price {crore(current.playerBasePrice)}
              </span>
            </h2>

            {moment === 'selected' ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Bidding opens when the auctioneer starts it.
              </p>
            ) : (
              <dl className="mt-4 grid gap-2.5 border-t pt-4 text-[15px]">
                <Detail label="Current leading bid">
                  {round?.currentLeadingBid === undefined ? (
                    <span className="text-muted-foreground">No bids yet</span>
                  ) : (
                    <>
                      <span className="font-bold">
                        {crore(round.currentLeadingBid)}
                      </span>{' '}
                      <span className="text-muted-foreground">
                        ({teamName(round.currentLeadingManager)})
                      </span>
                    </>
                  )}
                </Detail>
                {moment === 'sold' || moment === 'unsold' ? (
                  <Detail label="Result">
                    <span className="font-bold">
                      {moment === 'sold' ? 'Sold' : 'Unsold'}
                    </span>
                  </Detail>
                ) : (
                  <>
                    <Detail label="Next asking bid">
                      <span className="font-bold">
                        {round === undefined ? '—' : crore(round.minNextBid)}
                      </span>
                    </Detail>
                    <Detail label="Time remaining for next bid">
                      <Countdown />
                    </Detail>
                  </>
                )}
                <Detail label="Managers out of bidding">
                  {outOfBidding.length === 0 ? (
                    <span className="text-muted-foreground">None</span>
                  ) : (
                    outOfBidding.join(', ')
                  )}
                </Detail>
              </dl>
            )}
          </div>
        )}
    </section>
  )
}

function Headline({ title, detail }: { title: string; detail: string }) {
  return (
    <div>
      <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">{detail}</p>
    </div>
  )
}

/** One line of the round: what it is on the left, its value on the right. */
function Detail({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  )
}
