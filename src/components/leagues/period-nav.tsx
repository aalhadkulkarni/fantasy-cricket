import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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
    <div className="flex flex-wrap items-center gap-2.5">
      <Button
        variant="outline"
        size="sm"
        disabled={back === undefined}
        onClick={() => back !== undefined && onSelect(back.id)}
      >
        ‹ {previous?.label ?? 'Previous'}
      </Button>

      <span className="px-1 text-[15px] font-bold">{current.label}</span>

      <Button
        variant="outline"
        size="sm"
        disabled={forward === undefined}
        onClick={() => forward !== undefined && onSelect(forward.id)}
      >
        {next?.label ?? 'Next'} ›
      </Button>

      {periods.length > 5 && (
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
      )}
    </div>
  )
}
