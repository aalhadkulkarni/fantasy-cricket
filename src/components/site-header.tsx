import { MenuIcon } from 'lucide-react'
import { useState } from 'react'
import { NavLink as RouterNavLink } from 'react-router'

import { JoinLeagueDialog } from '@/components/join-league-dialog'
import { PageContainer } from '@/components/layout/page-container'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/routes'

/**
 * Persistent navigation across the whole app. See
 * `docs/08-pages/site-header.md`, and `.hdr` in `docs/design-reference.html`
 * for the exact values transcribed below.
 *
 * **The signed-in header only.** `site-header.md` says the header varies by
 * auth state and that a signed-out visitor sees a minimal one. There is no auth
 * yet, so that variant arrives with login rather than being faked now.
 *
 * **Mobile is not from the reference.** That file hides the nav below 640px and
 * puts nothing in its place, which would leave a phone with no navigation at
 * all on a product whose usage is mostly phones. The items move into a sheet
 * behind a menu button instead.
 */

interface NavItem {
  label: string
  to: string
}

/**
 * Home is My Leagues, so the brand and the first item share a destination.
 * That is deliberate — see the opening line of `docs/08-pages/my-leagues.md`.
 *
 * Join a League is not in this list because it opens a modal rather than going
 * anywhere, so it is rendered alongside as a button rather than a link.
 */
const NAV_ITEMS: readonly NavItem[] = [
  { label: 'My Leagues', to: ROUTES.home },
  { label: 'Tournaments', to: ROUTES.tournaments },
  { label: 'Create a League', to: ROUTES.createLeague },
]

/**
 * TODO: system admins only. There is no auth to condition on, so it is shown to
 * everyone for now. It stays in the list because 3.3 builds a page per header
 * item and 3.5 routes them — dropping it now would leave `/admin` orphaned.
 */
const ADMIN_ITEM: NavItem = { label: 'Admin panel', to: ROUTES.admin }

/**
 * TODO: real initials, from the signed-in user. `site-header.md` calls for
 * `photoURL` with an initials fallback, which needs auth.
 */
const PLACEHOLDER_INITIALS = 'AK'

/**
 * TODO: from `getActionsCount()`, which throws today.
 *
 * Zero rather than a made-up figure. The chip renders nothing at zero, so the
 * header shows exactly what it would show for someone with no outstanding
 * actions, and wiring the real count up is a one-line change.
 */
const ACTIONS_COUNT = 0

export function SiteHeader() {
  /*
    Owned here rather than inside the dialog so the mobile sheet can close
    itself before this opens. A dialog inside an open sheet means two focus
    traps stacked on each other.
  */
  const [isJoinOpen, setIsJoinOpen] = useState(false)

  return (
    <header className="border-b">
      <PageContainer className="flex h-[58px] items-center gap-6 sm:gap-[26px]">
        <MobileNav onJoinLeague={() => setIsJoinOpen(true)} />

        {/*
          The brand is one of the two named exceptions to rule 1 — see
          `docs/07-design-system.md`. `--live` is otherwise reserved for live
          states, and this is a mark rather than a state.
        */}
        <RouterNavLink
          to={ROUTES.home}
          className="text-[15px] font-extrabold tracking-[-0.02em] whitespace-nowrap"
        >
          Fantasy <span className="text-live-text">League</span>
        </RouterNavLink>

        {/* Hidden below 640px, as in the reference. MobileNav carries these there. */}
        <nav className="ml-2 hidden gap-5 sm:flex">
          {[...NAV_ITEMS, ADMIN_ITEM].map((item) => (
            <NavLink key={item.to} item={item} />
          ))}
          <JoinLeagueButton
            onClick={() => setIsJoinOpen(true)}
            className="text-[13.5px] font-medium text-muted-foreground hover:text-foreground"
          />
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <RouterNavLink
            to={ROUTES.actions}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 rounded-sm border px-3.75 py-2.5 text-[13px] font-semibold whitespace-nowrap hover:bg-accent',
                isActive && 'bg-accent',
              )
            }
          >
            Actions
            <ActionsCount count={ACTIONS_COUNT} />
          </RouterNavLink>

          <Avatar initials={PLACEHOLDER_INITIALS} />
        </div>
      </PageContainer>

      <JoinLeagueDialog open={isJoinOpen} onOpenChange={setIsJoinOpen} />
    </header>
  )
}

/**
 * The active item takes `--foreground` while the rest sit in
 * `--muted-foreground`, as `.nav a.on` does in the design reference.
 *
 * `end` matters on home: without it, `/` would count as active on every route,
 * since every path starts with a slash.
 */
function NavLink({ item }: { item: NavItem }) {
  return (
    <RouterNavLink
      to={item.to}
      end={item.to === ROUTES.home}
      className={({ isActive }) =>
        cn(
          'text-[13.5px] font-medium whitespace-nowrap hover:text-foreground',
          isActive ? 'text-foreground' : 'text-muted-foreground',
        )
      }
    >
      {item.label}
    </RouterNavLink>
  )
}

/**
 * Opens the join-by-code dialog. A button rather than a link because it goes
 * nowhere — `docs/08-pages/site-header.md` specifies a modal.
 */
function JoinLeagueButton({
  onClick,
  className,
}: {
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('cursor-pointer text-left', className)}
    >
      Join a League
    </button>
  )
}

/**
 * An 18px round chip, mono at weight 700, taking its geometry from `.count` in
 * the reference.
 *
 * **Filled with `--live`**, which makes it the second of the two named
 * exceptions to rule 1 in `docs/07-design-system.md`. The text uses
 * `--live-foreground`, the token that exists for text on a `--live` fill.
 *
 * Absent at zero, since a badge showing nothing is noise.
 */
function ActionsCount({ count }: { count: number }) {
  if (count <= 0) return null

  return (
    <span className="grid h-4.5 min-w-4.5 place-items-center rounded-full bg-live px-1 font-mono text-[10.5px] font-bold text-live-foreground">
      {count}
    </span>
  )
}

/**
 * `.avatar` from the reference: a 30px circle on the raised surface with a
 * hairline, initials set in mono.
 *
 * TODO: `photoURL` from Google auth, with these initials as the fallback. That
 * is when shadcn's Avatar earns its place; today there is no image to fall back
 * from.
 */
function Avatar({ initials }: { initials: string }) {
  return (
    <div
      aria-hidden
      className="grid size-[30px] shrink-0 place-items-center rounded-full border bg-secondary font-mono text-[10.5px] font-bold text-muted-foreground"
    >
      {initials}
    </div>
  )
}

/**
 * The menu button and its sheet, below 640px only.
 *
 * A sheet rather than a hand-rolled panel because an accessible drawer needs a
 * focus trap, escape handling and the right ARIA, and getting those subtly
 * wrong is worse than not having them.
 *
 * **Open state is held here so navigating closes it.** With client-side routing
 * the page swaps underneath without the sheet noticing, so an uncontrolled
 * sheet would sit open over whichever page you just chose.
 */
function MobileNav({ onJoinLeague }: { onJoinLeague: () => void }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger
        aria-label="Open navigation"
        className="-ml-2 grid size-9 shrink-0 place-items-center rounded-sm hover:bg-accent sm:hidden"
      >
        <MenuIcon className="size-5" />
      </SheetTrigger>

      <SheetContent side="left" className="w-[280px] max-w-[85vw]">
        <SheetHeader>
          <SheetTitle className="text-[15px] font-extrabold tracking-[-0.02em]">
            Fantasy <span className="text-live-text">League</span>
          </SheetTitle>
        </SheetHeader>

        <nav className="flex flex-col gap-1 px-4">
          {[...NAV_ITEMS, ADMIN_ITEM].map((item) => (
            <RouterNavLink
              key={item.to}
              to={item.to}
              end={item.to === ROUTES.home}
              onClick={() => setIsOpen(false)}
              className={({ isActive }) =>
                cn(
                  'rounded-sm px-3 py-2.5 text-sm font-medium hover:bg-accent',
                  isActive && 'bg-accent text-foreground',
                )
              }
            >
              {item.label}
            </RouterNavLink>
          ))}
          <JoinLeagueButton
            onClick={() => {
              // Close the sheet first, so the dialog is not a focus trap
              // opening inside another focus trap.
              setIsOpen(false)
              onJoinLeague()
            }}
            className="rounded-sm px-3 py-2.5 text-sm font-medium hover:bg-accent"
          />
        </nav>
      </SheetContent>
    </Sheet>
  )
}
