/**
 * The actions feed: open items awaiting the signed-in user.
 *
 * **Entirely derived from standing conditions.** Nothing is stored, nothing is
 * written, and there is no read state. An item stays until the underlying thing
 * resolves, which is the whole reason this exists rather than notifications — a
 * dismissed notification for a pending transfer is a lost transfer.
 */

import type { Action } from '@/types'
import { notImplemented } from './not-implemented'
import type {
  Subscriber,
  SubscriptionErrorHandler,
  Unsubscribe,
} from './subscriptions'

/** Fetched once at load and held, not re-fetched per page. */
export function getActions(): Promise<Action[]> {
  return notImplemented('getActions', {})
}

/** The number shown in the site header. Same derivation as `getActions`. */
export function getActionsCount(): Promise<number> {
  return notImplemented('getActionsCount', {})
}

/**
 * New items only.
 *
 * **Known gap:** items *disappearing* because they were resolved elsewhere are
 * not covered, so the count can run slightly stale. Accepted rather than
 * overlooked.
 */
export function onActionReceived(
  callback: Subscriber<Action>,
  onError?: SubscriptionErrorHandler,
): Unsubscribe {
  return notImplemented('onActionReceived', { callback, onError })
}
