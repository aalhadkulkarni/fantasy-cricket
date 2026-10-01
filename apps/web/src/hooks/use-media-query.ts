import { useSyncExternalStore } from 'react'

/**
 * Whether a media query matches, kept current as the window changes.
 *
 * For layouts that must render **one** arrangement rather than hide one with
 * CSS — the live auction mounts its lists either as phone tabs or as desktop
 * columns, never both, so nothing hidden keeps re-rendering on every bid.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
  )
}
