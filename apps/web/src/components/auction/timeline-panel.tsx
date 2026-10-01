import { useMemo } from 'react'

import { useAuction, useAuctionStatic } from './auction-store'
import { timelineText } from './timeline-text'

/**
 * **What has happened, newest first.** Each entry is worded for the reader —
 * "You bid 6.5" for the bidder, the team name for everyone else — and timed
 * by the clock it was written at, so nothing here ticks.
 *
 * Display only. Nothing reacts to an entry arriving.
 */
export function TimelinePanel() {
  const data = useAuctionStatic()
  const timeline = useAuction((s) => s.timeline)
  const viewerId = useAuction((s) => s.viewer.userId)

  const words = useMemo(() => {
    // Keyed by plain string: the timeline carries ids as written.
    const names = new Map<string, string>(
      data.pool.map((entry) => [
        entry.player.playerId,
        entry.player.playerName,
      ]),
    )
    return {
      viewerId,
      teamName: (userId: string) => {
        const member = data.members.find((m) => m.userId === userId)
        return member?.fantasyTeamName ?? member?.userName ?? 'A manager'
      },
      playerName: (playerId: string) => names.get(playerId) ?? 'A player',
    }
  }, [data.pool, data.members, viewerId])

  const newestFirst = useMemo(() => [...timeline].reverse(), [timeline])

  if (newestFirst.length === 0) {
    return (
      <p className="py-4 text-sm text-subtle-foreground">
        Nothing has happened yet.
      </p>
    )
  }

  return (
    <ol className="divide-y">
      {newestFirst.map((message) => (
        <li
          key={message.timelineMessageId}
          className="flex items-baseline justify-between gap-3 py-2"
        >
          <span className="text-sm">{timelineText(message, words)}</span>
          {message.timestamp !== undefined && (
            <span className="shrink-0 font-mono text-[10.5px] text-subtle-foreground">
              {new Date(message.timestamp).toLocaleTimeString(undefined, {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
          )}
        </li>
      ))}
    </ol>
  )
}
