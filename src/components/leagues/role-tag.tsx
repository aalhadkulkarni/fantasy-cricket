import type { ReactNode } from 'react'

import type { PlayerRole } from '@/types'

/**
 * The small mark beside a player's name: a bat, a ball, a keeper's glove, or
 * bat and ball for an all rounder.
 *
 * **Drawn icons rather than emoji.** There is no cricket-ball or glove emoji,
 * and the ones that exist render differently on every phone, so a set drawn to
 * one stroke weight reads as a set. The role is still said in words, as the
 * tooltip and for screen readers, since an icon alone is a guess.
 *
 * Distinguished by shape rather than colour — the accent belongs to the
 * floodlight.
 */
export function RoleTag({ role }: { role: PlayerRole }) {
  return (
    <span
      title={NAME[role]}
      className="inline-flex size-6 shrink-0 items-center justify-center rounded-[4px] border text-subtle-foreground"
    >
      <svg
        viewBox="0 0 16 16"
        className="size-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {ICON[role]}
      </svg>
      <span className="sr-only">{NAME[role]}</span>
    </span>
  )
}

const NAME: Record<PlayerRole, string> = {
  batsman: 'Batsman',
  bowler: 'Bowler',
  wicketKeeper: 'Wicket keeper',
  allRounder: 'All rounder',
}

const BAT = (
  <>
    <path d="M9.6 4.4 11.6 6.4 5.1 12.9a1.4 1.4 0 0 1-2-2z" />
    <path d="M10.6 5.4 13.6 2.4" />
  </>
)

const ICON: Record<PlayerRole, ReactNode> = {
  batsman: BAT,
  bowler: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M4.2 4.2c2.4 2.2 5.2 5 7.6 7.6" />
    </>
  ),
  wicketKeeper: (
    <path d="M4.5 13.5V8a1 1 0 0 1 2 0V5a1 1 0 0 1 2 0v-.5a1 1 0 0 1 2 0V6a1 1 0 0 1 2 0v4.5a3 3 0 0 1-3 3zM4.5 9.5 2.8 8.4a1 1 0 0 0-1.3 1.4l2.2 2.9" />
  ),
  allRounder: (
    <>
      <path d="M7.1 2.9 9.1 4.9 4.1 9.9a1.4 1.4 0 0 1-2-2z" />
      <path d="M8.1 3.9 10.6 1.4" />
      <circle cx="11.5" cy="11.5" r="2.6" />
    </>
  ),
}
