import { useState } from 'react'
import { ChevronDownIcon } from 'lucide-react'

import { PageContainer } from '@/components/layout/page-container'
import { PageTab, PageTabsList } from '@/components/page-tabs'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import {
  POINTS_SYSTEM,
  type PointsRow,
  type PointsSection,
  type PointsValue,
} from '@/content/points-system'

/**
 * Points System — `/points-system`.
 *
 * **Formats are tabs; categories are collapsible sections beneath them.** You
 * pick a format once and then read down it, so the format is a switch rather
 * than something to scan, and the categories fold so a phone can get to
 * Fielding without scrolling past every strike-rate band. All sections start
 * open, since on a wide screen there is room to read the whole format at once.
 */
export function PointsSystem() {
  return (
    <main className="py-10 sm:py-14">
      <PageContainer>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Points System
        </h1>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          How standard points are awarded in each format. Leagues with custom
          scoring set their own rules, shown on their League Details page.
        </p>

        <Tabs defaultValue={POINTS_SYSTEM[0]?.formatId} className="mt-8 gap-6">
          <PageTabsList>
            {POINTS_SYSTEM.map((format) => (
              <PageTab key={format.formatId} value={format.formatId}>
                {format.formatName}
              </PageTab>
            ))}
          </PageTabsList>

          {POINTS_SYSTEM.map((format) => (
            <TabsContent
              key={format.formatId}
              value={format.formatId}
              className="grid max-w-3xl gap-3"
            >
              {format.sections.map((section) => (
                <Section key={section.title} section={section} />
              ))}
            </TabsContent>
          ))}
        </Tabs>
      </PageContainer>
    </main>
  )
}

function Section({ section }: { section: PointsSection }) {
  const [open, setOpen] = useState(true)
  const id = `points-${section.title.toLowerCase()}`

  return (
    <section className="lit rounded-xl border bg-secondary/30">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen(!open)}
          className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-5 py-4 text-left text-base font-semibold focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
        >
          {section.title}
          <ChevronDownIcon
            aria-hidden
            className={`size-5 shrink-0 text-subtle-foreground transition-transform ${
              open ? 'rotate-180' : ''
            }`}
          />
        </button>
      </h2>

      {open && (
        <div id={id} className="px-5 pb-5">
          <Rows rows={section.rows} />

          {section.band !== undefined && (
            <div className="mt-5 border-t pt-5">
              <p className="font-semibold">{section.band.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {section.band.qualifier}
              </p>
              <div className="mt-2">
                <Rows rows={section.band.rows} signed />
              </div>
            </div>
          )}

          {section.notes !== undefined && (
            <ul className="mt-4 grid list-disc gap-2 border-t pt-4 pl-5 text-sm text-muted-foreground">
              {section.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}

/**
 * **Gains green, losses red, nothing muted** — the one place colour carries
 * meaning here. `signed` puts a `+` on a gain, as a band of bonuses and
 * penalties reads better with both signs shown.
 */
function Rows({
  rows,
  signed = false,
}: {
  rows: readonly PointsRow[]
  signed?: boolean
}) {
  return (
    <dl className="divide-y">
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex items-baseline justify-between gap-4 py-3 text-[15px]"
        >
          <dt>{row.label}</dt>
          <dd
            className={`shrink-0 font-mono text-sm font-bold ${tone(row.value)}`}
          >
            {show(row.value, signed)}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function tone(value: PointsValue): string {
  if (typeof value === 'string' || value > 0) return 'text-settled'
  if (value < 0) return 'text-destructive'
  return 'text-muted-foreground'
}

function show(value: PointsValue, signed: boolean): string {
  if (typeof value === 'string') return value
  return signed && value > 0 ? `+${value}` : String(value)
}
