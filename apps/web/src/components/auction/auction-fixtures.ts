/**
 * **Fake live data, for seeing every state of the page before Phase E writes
 * real data.** Development builds only: the page imports this behind
 * `import.meta.env.DEV`, so a production build drops it entirely.
 *
 * Open the auction page with `?fixture=<scenario>&as=<viewer>`:
 *
 * - scenarios: `bidding`, `leading`, `passed`, `paused`, `timeup`, `sold`,
 *   `draft`, `draftturn`, `recovering`, `ended`
 * - viewers: `spectator`, `manager`, `auctioneer`
 *
 * Built from the league's real pool and members, so the names are real. A
 * league with fewer than three managers is padded with made-up ones.
 *
 * TEMPORARY. Remove once Phase E produces real auctions to look at — it is
 * logged in `docs/10-milestones.md` so it is not forgotten.
 */

import type {
  AcceptedBidsForPlayer,
  AuctionState,
  Bid,
  BidId,
  ManagerAuctionStatus,
  NoBid,
  PlayerId,
  PlayerStatus,
  TimelineMessage,
  TimelineMessageId,
  UserId,
} from '@fantasy-cricket/shared'

import type { AuctionStatic, AuctionStoreState, Viewer } from './auction-store'

export const FIXTURE_SCENARIOS = [
  'bidding',
  'leading',
  'passed',
  'paused',
  'timeup',
  'sold',
  'draft',
  'draftturn',
  'recovering',
  'ended',
] as const
export type FixtureScenario = (typeof FIXTURE_SCENARIOS)[number]

export function isFixtureScenario(value: string): value is FixtureScenario {
  return (FIXTURE_SCENARIOS as readonly string[]).includes(value)
}

const PADDING = ['Thane Thunders', 'Pune Panthers', 'Bangalore Blasters']

/** The live slices a scenario fills, plus who is looking. */
export function buildFixture(
  scenario: FixtureScenario,
  as: string,
  data: AuctionStatic,
): Partial<AuctionStoreState> & { static: AuctionStatic } {
  const now = Date.now()

  // At least three managers, real ones first.
  const real = data.members.filter((m) => m.leagueRoles.manager === true)
  const members = [
    ...data.members,
    ...PADDING.slice(0, Math.max(0, 3 - real.length)).map((name, i) => ({
      userId: `fixture-manager-${i}` as UserId,
      userName: name,
      fantasyTeamName: name,
      leagueRoles: { manager: true as const },
    })),
  ]
  const managers = members.filter((m) => m.leagueRoles.manager === true)
  const [first, second, third] = managers.map((m) => m.userId) as [
    UserId,
    UserId,
    UserId,
  ]

  const viewer: Viewer =
    as === 'auctioneer'
      ? {
          userId: data.settings.auctioneer.userId,
          isAuctioneer: true,
          isManager: false,
        }
      : as === 'manager'
        ? { userId: first, isAuctioneer: false, isManager: true }
        : { userId: undefined, isAuctioneer: false, isManager: false }

  const pool = data.pool
  const ended = scenario === 'ended'

  // Resolve some of the pool: most of it if the auction is over.
  const resolvedCount = ended ? pool.length : Math.min(6, pool.length - 2)
  const players: Partial<Record<PlayerId, PlayerStatus>> = {}
  const managerStatus: Partial<Record<UserId, ManagerAuctionStatus>> = {}
  const spend = new Map<UserId, Record<string, number>>()
  const timeline: TimelineMessage[] = []
  let order = 0
  const message = <M extends TimelineMessage>(
    m: Omit<M, 'timelineMessageId' | 'timestamp'>,
  ) => {
    order += 1
    timeline.push({
      ...m,
      timelineMessageId: `fixture-${order}` as TimelineMessageId,
      timestamp: now - (100 - order) * 20_000,
    } as TimelineMessage)
  }

  message({ timelineEventId: 'auctionStarted', timelineEventData: {} })
  message({
    timelineEventId: 'nextBatch',
    timelineEventData: { playerCategory: 'marquee', playerRole: 'batsman' },
  })

  pool.slice(0, resolvedCount).forEach((entry, i) => {
    const playerId = entry.player.playerId
    // Every fifth goes unsold; the rest go round the managers.
    if (i % 5 === 4) {
      players[playerId] = { playerId, status: 'Unsold' }
      message({ timelineEventId: 'unsold', timelineEventData: { playerId } })
      return
    }
    const buyer = managers[i % managers.length]?.userId ?? first
    const paid = entry.playerBasePrice + (i % 4) * 0.5
    players[playerId] = {
      playerId,
      status: 'Sold',
      managerId: buyer,
      winningBid: paid,
    }
    spend.set(buyer, { ...(spend.get(buyer) ?? {}), [playerId]: paid })
    message({
      timelineEventId: 'sold',
      timelineEventData: { playerId, winningBid: paid, managerId: buyer },
    })
  })

  for (const m of managers) {
    const list = spend.get(m.userId) ?? {}
    const spent = Object.values(list).reduce((a, b) => a + b, 0)
    managerStatus[m.userId] = {
      budget: data.settings.totalBudget - spent,
      playerList: list,
    }
  }

  // The player up next, and the round around them.
  const up = pool[resolvedCount]
  const upId = up?.player.playerId
  const base = up?.playerBasePrice ?? 2

  const leader =
    scenario === 'leading' && viewer.userId !== undefined
      ? viewer.userId
      : second
  const bids: Record<string, Bid> = {}
  ;[third, leader].forEach((managerId, i) => {
    const bidId = `fixture-bid-${i}` as BidId
    bids[bidId] = {
      bidId,
      bidNumber: i + 1,
      bid: base + i * 0.5,
      managerId,
      timestamp: now - 15_000 + i * 5000,
    }
  })
  const leading = base + 0.5

  // The lower bidder has passed since being outbid; in `passed`, so has the
  // viewer. Passing is irreversible for the round.
  const passers: UserId[] = [
    third,
    ...(scenario === 'passed' && viewer.userId !== undefined
      ? [viewer.userId]
      : []),
  ]
  const passes: Record<string, NoBid> = {}
  passers.forEach((managerId, i) => {
    passes[`fixture-pass-${i}`] = {
      noBidNumber: i + 1,
      managerId,
      timestamp: now - 3000 + i * 1000,
    }
  })

  const deadline =
    scenario === 'timeup' || scenario === 'sold' ? now - 4000 : now + 18_000

  const round: AcceptedBidsForPlayer | undefined =
    upId === undefined || ended || scenario.startsWith('draft')
      ? undefined
      : {
          basePrice: base,
          currentLeadingBid: leading,
          currentLeadingManager: leader,
          minNextBid: leading + 0.5,
          deadline,
          bids,
          lastAcceptedBid: 'fixture-bid-1' as BidId,
          noBids: passes,
        }

  if (round !== undefined && upId !== undefined) {
    message({
      timelineEventId: 'nextPlayer',
      timelineEventData: { playerId: upId, basePrice: base, timeLimit: 30 },
    })
    message({
      timelineEventId: 'bid',
      timelineEventData: { playerId: upId, bid: base, managerId: third },
    })
    message({
      timelineEventId: 'bid',
      timelineEventData: { playerId: upId, bid: leading, managerId: leader },
    })
    message({
      timelineEventId: 'firstCall',
      timelineEventData: { timeRemaining: 20 },
    })
  }

  const phaseFor: Record<FixtureScenario, AuctionState['phase']> = {
    bidding: 'bidding',
    leading: 'bidding',
    passed: 'bidding',
    paused: 'paused',
    timeup: 'timeUp',
    sold: 'sold',
    draft: 'betweenPlayers',
    draftturn: 'betweenPlayers',
    recovering: 'recovering',
    ended: 'ended',
  }

  if (scenario === 'paused') {
    message({ timelineEventId: 'paused', timelineEventData: {} })
  }
  if (scenario === 'timeup' || scenario === 'sold') {
    message({ timelineEventId: 'timeUp', timelineEventData: {} })
  }
  if (scenario === 'sold' && upId !== undefined) {
    players[upId] = {
      playerId: upId,
      status: 'Sold',
      managerId: leader,
      winningBid: leading,
    }
    message({
      timelineEventId: 'sold',
      timelineEventData: {
        playerId: upId,
        winningBid: leading,
        managerId: leader,
      },
    })
  }
  if (scenario === 'recovering') {
    message({ timelineEventId: 'auctionBeingRecovered', timelineEventData: {} })
  }
  if (scenario === 'draft' || scenario === 'draftturn') {
    message({ timelineEventId: 'draftStarted', timelineEventData: {} })
  }
  if (ended) {
    message({ timelineEventId: 'auctionEnded', timelineEventData: {} })
  }

  const draftTurn =
    scenario === 'draftturn' && viewer.userId !== undefined
      ? viewer.userId
      : second

  const state: AuctionState = {
    phase: phaseFor[scenario],
    currentBatch: scenario.startsWith('draft')
      ? { kind: 'draft' }
      : { kind: 'auction', playerCategory: 'marquee', playerRole: 'batsman' },
    ...(upId === undefined || ended || scenario.startsWith('draft')
      ? {}
      : { currentPlayerId: upId }),
    ...(scenario.startsWith('draft')
      ? { currentDraftManagerId: draftTurn }
      : {}),
  }

  return {
    static: { ...data, members },
    viewer,
    state,
    managers: managerStatus,
    players,
    round,
    noBids:
      scenario === 'passed' && viewer.userId !== undefined
        ? { [viewer.userId]: true }
        : {},
    timeline,
    serverOffset: 0,
    liveError: undefined,
    fixture: `${scenario} as ${as}`,
  }
}
