import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

/**
 * Join by code, from the site header.
 *
 * **A code is a shortcut, not a bypass.** A closed league still requires
 * approval, so a valid code finds the league rather than joining it. See
 * `docs/04-navigation.md`.
 *
 * The code is not the league's address. It is a capability: eight characters
 * someone can be handed. URLs use the internal id instead, because anyone who
 * sees a URL would otherwise have the code, and codes can be regenerated.
 *
 * ---
 *
 * **TODO: nothing is wired up.** `getLeagueByCode()` throws, so there is no
 * lookup to run and the submit stays disabled. What is here is the shape: the
 * field, its length, and the copy.
 *
 * Open state is owned by the caller so the mobile navigation can close itself
 * before this opens, rather than stacking a dialog inside a sheet.
 */

/** From `LeagueJoinCode` in `src/types/ids.ts`. */
const JOIN_CODE_LENGTH = 8

export function JoinLeagueDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Join a League</DialogTitle>
          <DialogDescription>
            Enter the {JOIN_CODE_LENGTH}-character code you were given. A closed
            league will still ask its admin to approve you.
          </DialogDescription>
        </DialogHeader>

        <Input
          // Codes are identifiers, and the design system sets every figure in
          // Space Mono. Uppercase because that is how they are written down.
          className="font-mono tracking-[0.12em] uppercase"
          placeholder="XXXXXXXX"
          maxLength={JOIN_CODE_LENGTH}
          autoComplete="off"
          spellCheck={false}
          aria-label="League join code"
        />

        <p className="text-xs text-subtle-foreground">
          Looking a code up needs the data layer, which cannot reach a database
          yet.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled>Find league</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
