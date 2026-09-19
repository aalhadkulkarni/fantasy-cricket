import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { changeClass, type Change } from '@/components/leagues/change'
import { ChangeMark } from '@/components/leagues/change-mark'
import { RoleTag } from '@/components/leagues/role-tag'
import type { Player, PlayerId } from '@/types'

/** A slot with nobody in it. Radix will not take an empty item value. */
const EMPTY = '__empty__'

/**
 * One of the eleven slots — a full-width row, numbered down the left.
 *
 * **Players already picked elsewhere are not offered**, which is how the same
 * player cannot be selected twice. The one currently in this slot stays, or
 * changing it would be impossible.
 *
 * **The slot has no role.** Any player goes in any slot; composition is
 * validated in the panel beside it, because the rules are ranges rather than
 * exact counts and pre-slotting cannot be done honestly against a range.
 */
export function PlayerPicker({
  index,
  pool,
  value,
  taken,
  change,
  onChange,
}: {
  index: number
  pool: Player[]
  value: PlayerId | undefined
  taken: readonly PlayerId[]
  /** Changed since the previous period, and whether that is saved yet. */
  change: Change
  onChange: (playerId: PlayerId | undefined) => void
}) {
  const player = pool.find((p) => p.playerId === value)
  const available = pool.filter(
    (p) => p.playerId === value || !taken.includes(p.playerId),
  )

  return (
    <Select
      value={value ?? EMPTY}
      onValueChange={(next) =>
        onChange(next === EMPTY ? undefined : (next as PlayerId))
      }
    >
      <SelectTrigger
        aria-label={`Player ${index + 1}`}
        className={`lit h-auto w-full justify-between gap-3 rounded-xl border px-4 py-3.5 data-[size=default]:h-auto ${changeClass(change)}`}
      >
        <span className="flex min-w-0 items-center gap-3.5">
          <span className="w-5 shrink-0 text-right font-mono text-xs text-subtle-foreground">
            {index + 1}
          </span>
          {player === undefined ? (
            <span className="text-[15px] text-subtle-foreground">
              Choose a player
            </span>
          ) : (
            <>
              <span className="truncate text-[15px] font-medium">
                {player.playerName}
              </span>
              <RoleTag role={player.playerRole} />
            </>
          )}
        </span>
        <ChangeMark change={change} />
      </SelectTrigger>

      {/*
          **`popper`, not the default `item-aligned`.** Item-aligned positions
          the panel so the selected option sits over the trigger, which needs a
          `SelectValue` to anchor to and assumes a trigger one line tall. These
          rows are neither, and the panel ends up off screen — open, invisible,
          and holding the body scroll lock.
        */}
      <SelectContent
        position="popper"
        className="max-h-72 w-(--radix-select-trigger-width)"
      >
        <SelectItem value={EMPTY}>
          <span className="text-subtle-foreground">Choose a player</span>
        </SelectItem>
        {available.map((p) => (
          <SelectItem key={p.playerId} value={p.playerId}>
            <span className="flex w-full items-center justify-between gap-3">
              <span className="truncate">{p.playerName}</span>
              <RoleTag role={p.playerRole} />
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
