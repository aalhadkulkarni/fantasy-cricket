/**
 * **One sentence per timeline event, worded for whoever is reading.** The
 * timeline stores an id plus data rather than prose, which is what lets a
 * bidder read "You bid 6.5" while everyone else reads "Thane bid 6.5" — and a
 * spectator never reads "you" at all.
 *
 * **Display only.** Nothing reacts to an entry arriving; this only turns one
 * into words.
 */

import type { TimelineMessage, UserId } from '@fantasy-cricket/shared'

import { batchName, price } from './labels'

export interface TimelineWords {
  /** The viewer's id, so their own actions read as "You". */
  viewerId: UserId | undefined
  teamName: (managerId: UserId) => string
  playerName: (playerId: string) => string
}

export function timelineText(
  message: TimelineMessage,
  words: TimelineWords,
): string {
  const who = (managerId: UserId) =>
    managerId === words.viewerId ? 'You' : words.teamName(managerId)

  switch (message.timelineEventId) {
    case 'auctionStarted':
      return 'The auction has started'
    case 'nextBatch': {
      const { playerCategory, playerRole } = message.timelineEventData
      return `Next batch: ${batchName({ kind: 'auction', playerCategory, playerRole })}`
    }
    case 'nextPlayer': {
      const { playerId, basePrice } = message.timelineEventData
      return `${words.playerName(playerId)} is up, base price ${price(basePrice)}`
    }
    case 'bid': {
      const { managerId, bid } = message.timelineEventData
      return `${who(managerId)} bid ${price(bid)}`
    }
    case 'noBid': {
      const { managerId, playerId } = message.timelineEventData
      return `${who(managerId)} passed on ${words.playerName(playerId)}`
    }
    case 'paused':
      return 'Bidding paused'
    case 'auctionRestarted':
      return 'Bidding resumed'
    case 'auctionBeingRecovered':
      return 'The auctioneer is correcting the auction'
    case 'auctionRecovered': {
      const rounds = message.timelineEventData.rewindedRounds
      return rounds === 0
        ? 'Correction finished'
        : `Correction finished: ${rounds} ${rounds === 1 ? 'round' : 'rounds'} undone`
    }
    case 'auctioneerChanged':
      return 'The auctioneer has changed'
    case 'sold': {
      const { playerId, managerId, winningBid } = message.timelineEventData
      // Always the team name, even for the buyer: their row is highlighted
      // instead, which reads better than "sold to you".
      return `${words.playerName(playerId)} sold to ${words.teamName(
        managerId,
      )} for ${price(winningBid)}`
    }
    case 'unsold':
      return `${words.playerName(message.timelineEventData.playerId)} unsold`
    case 'draftStarted':
      return 'The draft has started'
    case 'nextDraftManager': {
      const { managerId } = message.timelineEventData
      return managerId === words.viewerId
        ? 'Your turn to pick'
        : `${words.teamName(managerId)} to pick`
    }
    case 'draftPick': {
      const { managerId, playerId, basePrice } = message.timelineEventData
      return `${who(managerId)} picked ${words.playerName(playerId)} for ${price(basePrice)}`
    }
    case 'draftTurnSkipped': {
      const { managerId } = message.timelineEventData
      return managerId === words.viewerId
        ? 'Your turn was skipped'
        : `${words.teamName(managerId)}'s turn was skipped`
    }
    case 'firstCall':
      return `First call: ${message.timelineEventData.timeRemaining} seconds left`
    case 'secondCall':
      return `Second call: ${message.timelineEventData.timeRemaining} seconds left`
    case 'lastCall':
      return `Last call: ${message.timelineEventData.timeRemaining} seconds left`
    case 'timeUp':
      return 'Time up'
    case 'timeIncreased':
      return `${message.timelineEventData.timeAdded} seconds added`
    case 'auctionEnded':
      return 'The auction has ended'
    case 'auctionReopened':
      return 'The auctioneer reopened the auction'
    case 'roundRewound': {
      // Team names throughout, as a sale reads: it names what was undone.
      const { result } = message.timelineEventData
      switch (result.kind) {
        case 'sold':
          return `Undone: ${words.playerName(result.playerId)} sold to ${words.teamName(
            result.managerId,
          )} for ${price(result.amount)}`
        case 'unsold':
          return `Undone: ${words.playerName(result.playerId)} unsold`
        case 'draftPick':
          return `Undone: ${words.teamName(result.managerId)}'s pick of ${words.playerName(
            result.playerId,
          )}`
        case 'draftTurnSkipped':
          return `Undone: ${words.teamName(result.managerId)}'s skipped turn`
        case 'batchUnsold':
          return `Undone: ${result.playerIds.length} players marked unsold`
      }
      return 'Undone: the last round'
    }
    default:
      // An event this page does not know, from a newer writer. Say something
      // rather than break the list.
      return 'Something happened in the auction'
  }
}

/** A sale to the viewer, which the timeline highlights. */
export function isViewersPurchase(
  message: TimelineMessage,
  viewerId: UserId | undefined,
): boolean {
  return (
    viewerId !== undefined &&
    message.timelineEventId === 'sold' &&
    message.timelineEventData.managerId === viewerId
  )
}
