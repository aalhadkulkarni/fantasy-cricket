/**
 * **The auction's one processor, running in the auctioneer's browser.**
 *
 * Managers write their bids and passes to their own fields; this listens to
 * them, judges each against the round it holds in memory, and accepts the
 * valid ones through the service — **one at a time**. That is what stops two
 * bids at the same price both being accepted: the second is judged only after
 * the first has moved the asking price, so it meets a price that has already
 * gone up, and is silently ignored.
 *
 * It also **owns the round's clock**: the first, second and last calls at 20,
 * 10 and 5 seconds left, and time up at zero, all by the database's clock.
 *
 * **In the draft, it accepts each turn's pick** as it arrives, through the
 * same queue. The service re-checks it and makes the sale.
 *
 * **The accepted cost:** if this browser disconnects or sleeps, the auction
 * stalls. Selling is manual, so a missing auctioneer stalls it anyway.
 */

import {
  AUCTION_CALLS,
  BID_INCREMENT,
  CALL_AT_SECONDS,
  ROUND_SECONDS,
  type LeagueId,
  type PlayerId,
  type Unsubscribe,
  type UserId,
} from '@fantasy-cricket/shared'

import {
  acceptBid,
  acceptDraftPick,
  acceptNoBid,
  announceCall,
  markTimeUp,
  onSubmittedBids,
  onSubmittedNoBids,
} from '@/data-layer'

import type { AuctionStore } from './auction-store'

/** What the processor last knew of the round, ahead of the database. */
interface Ahead {
  playerId: PlayerId
  minNextBid: number
  leader: UserId | undefined
  deadline: number
}

type Job =
  | { kind: 'bid'; playerId: PlayerId; managerId: UserId; amount: number }
  | { kind: 'pass'; playerId: PlayerId; managerId: UserId }
  | { kind: 'draftPick'; turn: number }

export function startBidProcessor(
  store: AuctionStore,
  leagueId: LeagueId,
): Unsubscribe {
  /**
   * **The queue.** Each job starts only when the one before has finished,
   * including its call to the service — the single thread alone is not
   * enough, because a job waits on the network part-way through.
   */
  let queue: Promise<void> = Promise.resolve()
  const enqueue = (job: Job) => {
    queue = queue.then(() => run(job)).catch(() => undefined)
  }

  /**
   * **The round, one step ahead of the database.** Updated the moment a bid
   * is accepted, before the database echoes it back, so the next job is
   * judged against the new price even if the echo is slow. The database's
   * round wins whenever it is further along.
   */
  let ahead: Ahead | undefined

  const fail = (error: unknown) =>
    store.setState({
      processorError: error instanceof Error ? error.message : String(error),
    })

  function serverNow(): number {
    return Date.now() + store.getState().serverOffset
  }

  /** The round to judge against: the database's, or ours if we are ahead. */
  function roundFor(playerId: PlayerId): Ahead | undefined {
    const stored = store.getState().round
    const fromStore: Ahead | undefined =
      stored === undefined
        ? undefined
        : {
            playerId,
            minNextBid: stored.minNextBid,
            leader: stored.currentLeadingManager,
            deadline: stored.deadline,
          }
    if (ahead?.playerId !== playerId) return fromStore
    if (fromStore === undefined) return ahead
    return ahead.minNextBid > fromStore.minNextBid ? ahead : fromStore
  }

  async function run(job: Job): Promise<void> {
    const { state, round, draftPick } = store.getState()

    if (job.kind === 'draftPick') {
      if (state?.currentDraftTurn !== job.turn) return
      if (
        draftPick === undefined ||
        draftPick.skipped === true ||
        draftPick.accepted === true
      ) {
        return
      }
      try {
        await acceptDraftPick(leagueId, job.turn)
        store.setState({ processorError: undefined })
      } catch (error) {
        fail(error)
      }
      return
    }

    if (state?.currentPlayerId !== job.playerId) return

    if (job.kind === 'pass') {
      const recorded = Object.values(round?.noBids ?? {}).some(
        (p) => p.managerId === job.managerId,
      )
      if (recorded || (state.phase !== 'bidding' && state.phase !== 'timeUp')) {
        return
      }
      try {
        await acceptNoBid(leagueId, job.playerId, job.managerId)
      } catch (error) {
        fail(error)
      }
      return
    }

    // A bid. Every check here is against the round in memory; anything that
    // fails is silently ignored, as the design says.
    const current = roundFor(job.playerId)
    if (state.phase !== 'bidding' || current === undefined) return
    if (job.amount !== current.minNextBid) return
    if (job.managerId === current.leader) return
    if (serverNow() > current.deadline) return
    const passed = Object.values(round?.noBids ?? {}).some(
      (p) => p.managerId === job.managerId,
    )
    if (passed || store.getState().noBids[job.managerId] === true) return

    // Move ahead before the call returns, so the next job meets the new price.
    ahead = {
      playerId: job.playerId,
      minNextBid: job.amount + BID_INCREMENT,
      leader: job.managerId,
      deadline: serverNow() + ROUND_SECONDS * 1000,
    }
    try {
      await acceptBid(leagueId, job.playerId, job.managerId, job.amount)
      store.setState({ processorError: undefined })
    } catch (error) {
      // The service said no — budget, squad, the clock by its reckoning. The
      // round in the database is unchanged, so drop back to it.
      ahead = undefined
      fail(error)
    }
  }

  // -------------------------------------------------------------------------
  // Following the player up: their bids and passes
  // -------------------------------------------------------------------------

  let followed: PlayerId | undefined
  let detach: Unsubscribe[] = []
  /** The last amount seen per manager, so an unchanged entry is not re-queued. */
  let seenBids = new Map<UserId, number>()
  let seenPasses = new Set<UserId>()

  function follow(playerId: PlayerId | undefined) {
    if (playerId === followed) return
    detach.forEach((stop) => stop())
    detach = []
    followed = playerId
    seenBids = new Map()
    seenPasses = new Set()
    ahead = undefined
    if (playerId === undefined) return

    detach = [
      onSubmittedBids(
        leagueId,
        playerId,
        (bids) => {
          for (const [managerId, amount] of Object.entries(bids)) {
            if (amount === undefined) continue
            const id = managerId as UserId
            if (seenBids.get(id) === amount) continue
            seenBids.set(id, amount)
            enqueue({ kind: 'bid', playerId, managerId: id, amount })
          }
        },
        fail,
      ),
      onSubmittedNoBids(
        leagueId,
        playerId,
        (passes) => {
          for (const managerId of Object.keys(passes)) {
            const id = managerId as UserId
            if (seenPasses.has(id)) continue
            seenPasses.add(id)
            enqueue({ kind: 'pass', playerId, managerId: id })
          }
        },
        fail,
      ),
    ]
  }

  // -------------------------------------------------------------------------
  // The draft: each turn's pick, accepted once
  // -------------------------------------------------------------------------

  /**
   * The picks already queued, so each is accepted once however often the
   * store changes. Keyed by the pick itself rather than the turn, because a
   * reset starts the turns again from 0. A failed accept is shown and not
   * retried; reopening the page queues it again.
   */
  const queuedPicks = new Set<string>()

  function watchDraft(s: ReturnType<AuctionStore['getState']>) {
    const turn = s.state?.currentDraftTurn
    const pick = s.draftPick
    // A skip has nothing to accept.
    if (
      turn === undefined ||
      pick === undefined ||
      pick.skipped === true ||
      pick.accepted === true
    ) {
      return
    }
    const key = `${turn}:${pick.managerId}:${pick.submittedAt}`
    if (queuedPicks.has(key)) return
    queuedPicks.add(key)
    enqueue({ kind: 'draftPick', turn })
  }

  follow(store.getState().state?.currentPlayerId)
  watchDraft(store.getState())
  const unsubscribeStore = store.subscribe((s) => {
    follow(s.state?.currentPlayerId)
    watchDraft(s)
  })

  // -------------------------------------------------------------------------
  // The clock: calls and time up
  // -------------------------------------------------------------------------

  /** What has been announced for which deadline, so nothing is said twice. */
  const announced = new Set<string>()
  /** When a time-up was last attempted, so a refusal is retried, not spammed. */
  let timeUpTriedAt = 0

  const ticker = setInterval(() => {
    const { state, round } = store.getState()
    if (state?.phase !== 'bidding' || round === undefined) return
    const left = round.deadline - serverNow()

    for (const call of AUCTION_CALLS) {
      const at = CALL_AT_SECONDS[call] * 1000
      const key = `${round.deadline}:${call}`
      // Only as the clock crosses the mark: opening the page with three
      // seconds left must not announce a first call.
      if (left <= at && left > at - 2000 && !announced.has(key)) {
        announced.add(key)
        void announceCall(leagueId, call).catch(fail)
      }
    }

    if (left <= 0 && Date.now() - timeUpTriedAt > 1000) {
      timeUpTriedAt = Date.now()
      void markTimeUp(leagueId).catch(fail)
    }
  }, 250)

  return () => {
    clearInterval(ticker)
    unsubscribeStore()
    detach.forEach((stop) => stop())
  }
}
