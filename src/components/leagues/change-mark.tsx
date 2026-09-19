import { ArrowLeftIcon } from 'lucide-react'

import type { Change } from '@/components/leagues/change'

/**
 * The arrow on the right of a changed row, pointing back into the team. The
 * colour alone would not survive being read by a screen reader or by someone
 * who cannot tell yellow from green, so it is said in words too.
 */
export function ChangeMark({ change }: { change: Change }) {
  if (change === undefined) return null

  const saved = change === 'saved'
  return (
    <span
      className={`ml-auto flex shrink-0 items-center ${
        saved ? 'text-settled' : 'text-pending'
      }`}
    >
      <ArrowLeftIcon className="size-4" aria-hidden />
      <span className="sr-only">
        {saved
          ? 'Changed from the previous match, saved'
          : 'Changed from the previous match, not saved yet'}
      </span>
    </span>
  )
}
