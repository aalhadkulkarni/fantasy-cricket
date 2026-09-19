import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/**
 * **A button that looks like a link.** It changes what is shown, not the URL,
 * so semantically it is a button — which is what keyboards and screen readers
 * expect of something that acts on click — dressed as the quieter thing.
 */
const LINK =
  'group flex max-w-full cursor-pointer items-center gap-2 rounded-sm text-base text-foreground'

/**
 * **The arrow is what says it is clickable**, so it carries the colour, and
 * turns white with the label underlining when hovered or focused.
 */
const ARROW =
  'size-5 shrink-0 text-live-text group-hover:text-foreground group-focus-visible:text-foreground'

/** One thing you can be looking at — a match, or a gameweek. */
export interface Period {
  id: string
  label: string
}

/**
 * Moving between matches, or between gameweeks.
 *
 * **The neighbours are labelled with where they go**, rather than with arrows
 * alone, so you can see what is one step away without taking the step. The
 * current one sits between them and does not move.
 *
 * **A jump appears once walking would be tedious.** Three matches need no
 * dropdown; sixty-four do, and `my-team.md` asks for one.
 *
 * `reachable` is what stops a gameweek league offering more than the next one.
 * Matches are all reachable for viewing; editing is a separate question decided
 * by the deadline.
 */
export function PeriodNav({
  periods,
  selectedId,
  reachable,
  onSelect,
}: {
  periods: readonly Period[]
  selectedId: string
  /** Ids that may be opened. Anything else is shown but not offered. */
  reachable: ReadonlySet<string>
  onSelect: (id: string) => void
}) {
  const index = periods.findIndex((p) => p.id === selectedId)
  const current = periods[index]
  if (current === undefined) return null

  const previous = periods[index - 1]
  const next = periods[index + 1]

  const step = (target: Period | undefined) =>
    target !== undefined && reachable.has(target.id) ? target : undefined

  const back = step(previous)
  const forward = step(next)

  return (
    <div className="relative">
      {/*
        **The current one is the fixed centre.** The two outer columns share
        the rest equally, so it stays put whether or not there is a neighbour on
        either side, and each button hugs it rather than sitting at the edge.
        A neighbour that cannot be reached is absent, not a disabled button.
      */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-5 sm:gap-10">
        <div className="flex min-w-0 justify-end">
          {back !== undefined && (
            <button
              type="button"
              className={`${LINK} justify-end underline-offset-4 hover:underline focus-visible:underline`}
              onClick={() => onSelect(back.id)}
            >
              <ArrowLeftIcon className={ARROW} aria-hidden />
              <span className="truncate">{back.label}</span>
            </button>
          )}
        </div>

        <span className="text-lg font-bold whitespace-nowrap">
          {current.label}
        </span>

        <div className="flex min-w-0 justify-start">
          {forward !== undefined && (
            <button
              type="button"
              className={`${LINK} underline-offset-4 hover:underline focus-visible:underline`}
              onClick={() => onSelect(forward.id)}
            >
              <span className="truncate">{forward.label}</span>
              <ArrowRightIcon className={ARROW} aria-hidden />
            </button>
          )}
        </div>
      </div>

      {/* Below the row on a phone, at the far right beside it from `sm`. */}
      {periods.length > 5 && (
        <div className="mt-2.5 flex justify-center sm:absolute sm:inset-y-0 sm:right-0 sm:mt-0 sm:items-center">
          <Select value={selectedId} onValueChange={onSelect}>
            <SelectTrigger className="w-36" aria-label="Jump to">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" className="max-h-72">
              {periods
                .filter((p) => reachable.has(p.id))
                .map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )
}
