import { useEffect, useState } from 'react'

import { useAuction } from './auction-store'

/**
 * **The round's time left, against the database's clock.** The only thing on
 * the page that ticks, and the only thing that re-renders when it does.
 *
 * Time left is the deadline minus the server's now — `Date.now()` plus the
 * offset the database reports — so a phone whose clock is a few seconds out
 * still counts down with everyone else. Time-up is the count reaching zero,
 * not an event arriving.
 *
 * Renders inline text, so it can sit as a value in the round's details.
 */
export function Countdown() {
  const deadline = useAuction((s) => s.round?.deadline)
  const offset = useAuction((s) => s.serverOffset)
  const phase = useAuction((s) => s.state?.phase)

  const [now, setNow] = useState(() => Date.now())

  const running = phase === 'bidding' && deadline !== undefined

  useEffect(() => {
    if (!running) return
    // A quarter-second tick keeps the whole-second display honest without
    // repainting anything else.
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [running])

  if (phase === 'paused') return <Value tone="quiet">Paused</Value>
  if (!running) return <Value tone="quiet">Time up</Value>

  const seconds = Math.max(0, Math.ceil((deadline - (now + offset)) / 1000))

  return seconds === 0 ? (
    <Value tone="quiet">Time up</Value>
  ) : (
    <Value tone={seconds <= 5 ? 'urgent' : 'live'}>{seconds}s</Value>
  )
}

function Value({
  tone,
  children,
}: {
  tone: 'live' | 'urgent' | 'quiet'
  children: React.ReactNode
}) {
  const colour =
    tone === 'urgent'
      ? 'text-destructive'
      : tone === 'live'
        ? 'text-live-text'
        : 'text-muted-foreground'

  return (
    <span
      className={`font-mono font-bold tabular-nums ${colour}`}
      // Announced at most once a second, and only the value.
      aria-live="polite"
      aria-atomic="true"
    >
      {children}
    </span>
  )
}
