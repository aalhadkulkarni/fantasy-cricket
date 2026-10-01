/**
 * **The live auction page's state, in one Zustand store per page.**
 *
 * Plain React context re-renders every consumer on any change, and this page
 * changes several times a second. Here the context carries only the store
 * itself — a reference that never changes — and each component subscribes to
 * the narrow slice it draws with a selector, so a new bid repaints the round
 * card and the bid panel and leaves the player lists alone.
 *
 * **Select raw slices, derive in the component.** A selector that builds a new
 * array or object on every call never compares equal and re-renders forever;
 * select the stored value and derive with `useMemo`.
 *
 * Fed from outside React: the live subscriptions write into it directly (see
 * `startLiveFeed`), as does the dev-only fixture loader.
 */

import { createContext, useContext } from 'react'
import { createStore, useStore, type StoreApi } from 'zustand'

import {
  onAuctionStateChanged,
  onCurrentRoundChanged,
  onManagerStatusesChanged,
  onPlayerStatusesChanged,
  onServerTimeOffset,
  onSubmittedNoBids,
  onTimelineEvent,
} from '@/data-layer'
import type {
  AcceptedBidsForPlayer,
  AuctionPoolPlayer,
  AuctionSettings,
  AuctionState,
  DraftOrderEntry,
  LeagueId,
  LeagueMemberSummary,
  LeagueSummary,
  LineupRules,
  ManagerAuctionStatus,
  PlayerId,
  PlayerStatus,
  TimelineMessage,
  Unsubscribe,
  UserId,
} from '@fantasy-cricket/shared'

/** Read once when the page opens. None of it changes during an auction. */
export interface AuctionStatic {
  league: LeagueSummary
  settings: AuctionSettings
  pool: AuctionPoolPlayer[]
  members: LeagueMemberSummary[]
  draftOrder: DraftOrderEntry[]
  rules: LineupRules
}

/** Who is looking, which decides the panels and the wording. */
export interface Viewer {
  userId: UserId | undefined
  isAuctioneer: boolean
  isManager: boolean
}

export interface AuctionStoreState {
  static: AuctionStatic | undefined
  staticError: string | undefined

  viewer: Viewer

  /** Absent until the auction is started — the normal pre-auction state. */
  state: AuctionState | undefined
  managers: Partial<Record<UserId, ManagerAuctionStatus>>
  players: Partial<Record<PlayerId, PlayerStatus>>
  /** The current player's round. Absent until bidding on them starts. */
  round: AcceptedBidsForPlayer | undefined
  /** Who has passed on the current player. */
  noBids: Partial<Record<UserId, true>>
  /** Oldest first, as written. The timeline shows them newest first. */
  timeline: TimelineMessage[]
  /** Add to `Date.now()` for the database's idea of now. */
  serverOffset: number

  /** A live listener failed. The page says updates have stopped. */
  liveError: string | undefined
  /** Set while showing fake data, so the page can say so. */
  fixture: string | undefined
}

export type AuctionStore = StoreApi<AuctionStoreState>

export function createAuctionStore(): AuctionStore {
  return createStore<AuctionStoreState>(() => ({
    static: undefined,
    staticError: undefined,
    viewer: { userId: undefined, isAuctioneer: false, isManager: false },
    state: undefined,
    managers: {},
    players: {},
    round: undefined,
    noBids: {},
    timeline: [],
    serverOffset: 0,
    liveError: undefined,
    fixture: undefined,
  }))
}

/** The viewer's roles, from the static data and who is signed in. */
export function viewerFor(
  data: AuctionStatic,
  userId: UserId | undefined,
): Viewer {
  const member = data.members.find((m) => m.userId === userId)
  return {
    userId,
    isAuctioneer:
      userId !== undefined && data.settings.auctioneer.userId === userId,
    isManager: member?.leagueRoles.manager === true,
  }
}

/**
 * **Every live listener the page needs, attached and torn down together.**
 *
 * The round and the passes are per player, so they follow the current player:
 * when it changes, the old listeners detach and new ones attach. Everything
 * else is one listener for the page's life.
 *
 * Returns one function that detaches all of it, for the page's unmount.
 */
export function startLiveFeed(
  store: AuctionStore,
  leagueId: LeagueId,
): Unsubscribe {
  const fail = (error: Error) => store.setState({ liveError: error.message })

  let perPlayer: Unsubscribe[] = []
  let followedPlayer: PlayerId | undefined

  function follow(playerId: PlayerId | undefined) {
    if (playerId === followedPlayer) return
    perPlayer.forEach((stop) => stop())
    perPlayer = []
    followedPlayer = playerId
    store.setState({ round: undefined, noBids: {} })
    if (playerId === undefined) return

    perPlayer = [
      onCurrentRoundChanged(
        leagueId,
        playerId,
        (round) => store.setState({ round }),
        fail,
      ),
      onSubmittedNoBids(
        leagueId,
        playerId,
        (noBids) => store.setState({ noBids }),
        fail,
      ),
    ]
  }

  const always = [
    onAuctionStateChanged(
      leagueId,
      (state) => {
        store.setState({ state })
        follow(state?.currentPlayerId)
      },
      fail,
    ),
    onManagerStatusesChanged(
      leagueId,
      (managers) => store.setState({ managers }),
      fail,
    ),
    onPlayerStatusesChanged(
      leagueId,
      (players) => store.setState({ players }),
      fail,
    ),
    onTimelineEvent(
      leagueId,
      (message) =>
        store.setState((s) => ({ timeline: [...s.timeline, message] })),
      fail,
    ),
    onServerTimeOffset(
      (serverOffset) => store.setState({ serverOffset }),
      fail,
    ),
  ]

  return () => {
    always.forEach((stop) => stop())
    perPlayer.forEach((stop) => stop())
  }
}

// ---------------------------------------------------------------------------
// Reaching the store from a component
// ---------------------------------------------------------------------------

/** Holds the store reference only, which never changes for a mounted page. */
export const AuctionStoreContext = createContext<AuctionStore | undefined>(
  undefined,
)

/** One slice of the auction. Re-renders only when that slice changes. */
export function useAuction<T>(selector: (state: AuctionStoreState) => T): T {
  const store = useContext(AuctionStoreContext)
  if (store === undefined) {
    throw new Error('useAuction must be used inside the auction page')
  }
  return useStore(store, selector)
}

/**
 * The static data, for components that only render once it has loaded. The
 * page draws nothing that calls this until it has.
 */
export function useAuctionStatic(): AuctionStatic {
  const data = useAuction((s) => s.static)
  if (data === undefined) {
    throw new Error('useAuctionStatic called before the auction loaded')
  }
  return data
}
