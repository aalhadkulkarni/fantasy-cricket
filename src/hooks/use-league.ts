import { useOutletContext } from 'react-router'

import type { LeagueSummary } from '@/types'

interface LeagueContext {
  league: LeagueSummary
  /** Re-reads the summary, for a section that changes the phase or the strip. */
  reload: () => void
}

/**
 * The league a section is inside.
 *
 * League home reads the summary once and hands it down, so a section does not
 * fetch it again. Separate from the page for the usual reason: a component file
 * may not export anything that is not a component.
 */
export function useLeague(): LeagueContext {
  return useOutletContext<LeagueContext>()
}
