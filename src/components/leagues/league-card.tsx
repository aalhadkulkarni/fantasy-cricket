import type { ReactNode } from 'react'

/**
 * The chrome every league card shares.
 *
 * `tournaments.md` asks for **one component with variants, not two
 * implementations** — the same card appears on My Leagues, where it is a league
 * of yours, and on a tournament page, where it may be a league you have never
 * heard of. What differs is the meta rows and the footer, so those are supplied
 * by the caller and everything else lives here.
 *
 * Built to `docs/design-reference.html`: name, a tag row, label-and-value meta
 * in mono, then a hairline and a footer. The `floodlit` wash is the ambient
 * bloom, atmosphere rather than a state marker.
 */
export function LeagueCard({
  name,
  tags,
  meta,
  footer,
}: {
  name: string
  tags: ReactNode
  meta: ReactNode
  footer: ReactNode
}) {
  return (
    <article className="floodlit flex flex-col gap-3.5 rounded-lg border bg-card p-5 text-card-foreground">
      <div>
        <h3 className="text-[17px] leading-tight font-bold tracking-[-0.015em]">
          {name}
        </h3>
        <div className="mt-2 flex flex-wrap gap-1.5">{tags}</div>
      </div>

      <dl className="grid gap-[5px] font-mono text-[11px] text-subtle-foreground">
        {meta}
      </dl>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2.5 border-t pt-3">
        {footer}
      </div>
    </article>
  )
}

/** One label-and-value line in a card's meta block. */
export function CardRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt>{label}</dt>
      <dd className="font-normal text-muted-foreground">{value}</dd>
    </div>
  )
}

export function CardTag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-[4px] border border-live-text/35 bg-live-text/10 px-[7px] py-[3px] font-mono text-[9.5px] tracking-[0.08em] text-live-text uppercase">
      {children}
    </span>
  )
}

/**
 * The footer's left half: a dot and a short statement of where things stand.
 *
 * `settled` is the steady-positive green — something is fine and needs nothing
 * from you. Anything else is the neutral dot. **Not the live blue**, which rule
 * 1 keeps for an auction running or a deadline closing in.
 */
export function CardStatus({
  tone,
  children,
}: {
  tone: 'settled' | 'neutral'
  children: ReactNode
}) {
  return (
    <div className="flex items-center gap-2 text-[13px] font-semibold">
      <span
        className={`inline-block size-[7px] rounded-full ${
          tone === 'settled' ? 'bg-settled' : 'bg-subtle-foreground'
        }`}
      />
      {children}
    </div>
  )
}

/** The footer's right half. A count, a countdown, a note. */
export function CardCaption({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[10.5px] whitespace-nowrap text-subtle-foreground">
      {children}
    </span>
  )
}
