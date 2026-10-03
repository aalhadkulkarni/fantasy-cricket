/**
 * **What the page works out from the store, never stores.** Pure functions,
 * called inside `useMemo` with raw slices, so a derived list is rebuilt only
 * when what it came from changes.
 */

import type {
  AcceptedBidsForPlayer,
  AuctionPoolPlayer,
  AuctionSettings,
  AuctionState,
  LeagueMemberSummary,
  ManagerAuctionStatus,
  PlayerId,
  PlayerRole,
  PlayerStatus,
  UserId,
} from '@fantasy-cricket/shared'

export type PoolIndex = ReadonlyMap<PlayerId, AuctionPoolPlayer>

export function indexPool(pool: readonly AuctionPoolPlayer[]): PoolIndex {
  return new Map(pool.map((entry) => [entry.player.playerId, entry]))
}

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------

export interface SoldEntry {
  entry: AuctionPoolPlayer
  managerId: UserId
  winningBid: number
}

export interface PlayerLists {
  remaining: AuctionPoolPlayer[]
  sold: SoldEntry[]
  unsold: AuctionPoolPlayer[]
}

/**
 * **Remaining is everything not yet resolved.** A player with no status, or a
 * pending one, has not been sold or marked unsold — which before the auction
 * starts is the whole pool. Kept in the pool's order: category, role, name.
 */
export function playerLists(
  pool: readonly AuctionPoolPlayer[],
  statuses: Partial<Record<PlayerId, PlayerStatus>>,
): PlayerLists {
  const lists: PlayerLists = { remaining: [], sold: [], unsold: [] }
  for (const entry of pool) {
    const status = statuses[entry.player.playerId]
    if (status?.status === 'Sold') {
      lists.sold.push({
        entry,
        managerId: status.managerId,
        winningBid: status.winningBid,
      })
    } else if (status?.status === 'Unsold') {
      lists.unsold.push(entry)
    } else {
      lists.remaining.push(entry)
    }
  }
  return lists
}

/**
 * **The draft pool**: every General player not yet taken, plus everyone left
 * unsold from the bidding batches, each marked as previously unsold.
 */
export function draftPool(
  pool: readonly AuctionPoolPlayer[],
  statuses: Partial<Record<PlayerId, PlayerStatus>>,
): { entry: AuctionPoolPlayer; wasUnsold: boolean }[] {
  return pool.flatMap(
    (entry): { entry: AuctionPoolPlayer; wasUnsold: boolean }[] => {
      const status = statuses[entry.player.playerId]?.status
      if (status === 'Sold') return []
      if (status === 'Unsold') return [{ entry, wasUnsold: true }]
      return entry.playerCategory === 'general'
        ? [{ entry, wasUnsold: false }]
        : []
    },
  )
}

// ---------------------------------------------------------------------------
// Managers
// ---------------------------------------------------------------------------

export interface SquadPlayer {
  entry: AuctionPoolPlayer
  price: number
}

export interface ManagerRow {
  userId: UserId
  name: string
  teamName: string
  budget: number
  squad: SquadPlayer[]
}

/**
 * **Every manager, whether or not the auction has started.** Before it, the
 * live statuses are empty, so each sits on the full budget with no players —
 * which is what the managers table shows until the first sale.
 */
export function managerRows(
  members: readonly LeagueMemberSummary[],
  statuses: Partial<Record<UserId, ManagerAuctionStatus>>,
  settings: AuctionSettings,
  pool: PoolIndex,
): ManagerRow[] {
  return members
    .filter((member) => member.leagueRoles.manager === true)
    .map((member) => {
      const status = statuses[member.userId]
      const squad = Object.entries(status?.playerList ?? {}).flatMap(
        ([playerId, paid]) => {
          const entry = pool.get(playerId as PlayerId)
          return entry === undefined ? [] : [{ entry, price: paid }]
        },
      )
      return {
        userId: member.userId,
        name: member.userName,
        teamName: member.fantasyTeamName ?? member.userName,
        budget: status?.budget ?? settings.totalBudget,
        squad,
      }
    })
}

/** A squad's makeup: how many of each role, and how many overseas. */
export function composition(
  squad: readonly SquadPlayer[],
  homeNation: string | undefined,
): { byRole: Record<PlayerRole, number>; overseas: number } {
  const byRole: Record<PlayerRole, number> = {
    batsman: 0,
    bowler: 0,
    wicketKeeper: 0,
    allRounder: 0,
  }
  let overseas = 0
  for (const { entry } of squad) {
    byRole[entry.player.playerRole] += 1
    if (homeNation !== undefined && entry.player.country !== homeNation) {
      overseas += 1
    }
  }
  return { byRole, overseas }
}

// ---------------------------------------------------------------------------
// The stage
// ---------------------------------------------------------------------------

/**
 * **Which moment the auction is in, as the screen needs to tell it apart.**
 * The stored phase plus two facts it does not carry: whether the current
 * player has a round yet (selected, or bidding), and whether this is the draft.
 */
export type Moment =
  | 'notStarted'
  | 'betweenPlayers'
  | 'selected'
  | 'bidding'
  | 'paused'
  | 'timeUp'
  | 'sold'
  | 'unsold'
  | 'draft'
  | 'recovering'
  | 'ended'

export function momentOf(
  state: AuctionState | undefined,
  round: AcceptedBidsForPlayer | undefined,
): Moment {
  if (state === undefined) return 'notStarted'
  if (state.phase === 'ended') return 'ended'
  if (state.phase === 'recovering') return 'recovering'
  if (state.currentBatch?.kind === 'draft') return 'draft'

  switch (state.phase) {
    case 'notStarted':
      return 'betweenPlayers'
    case 'betweenPlayers':
      return state.currentPlayerId !== undefined && round === undefined
        ? 'selected'
        : 'betweenPlayers'
    default:
      return state.phase
  }
}
