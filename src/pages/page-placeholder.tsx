import { PageContainer } from '@/components/layout/page-container'

/**
 * The shape every page has until it is built: a heading, a line of context, and
 * a card saying what is coming.
 *
 * Factored out now rather than in 3.1 because there are eight of them, and
 * eight copies of the same markup would drift. When a page becomes real it
 * stops using this and writes its own body.
 */
export function PagePlaceholder({
  title,
  intro,
  coming,
}: {
  title: string
  /** One line on what the page is for, from its document in `docs/08-pages/`. */
  intro: string
  /** What will eventually render here. */
  coming: string
}) {
  return (
    <main className="py-10 sm:py-14">
      <PageContainer>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {title}
        </h1>

        <p className="mt-2 text-sm text-muted-foreground">{intro}</p>

        <div className="floodlit mt-8 rounded-lg border bg-card p-5 text-card-foreground sm:p-6">
          <p className="font-mono text-xs tracking-wide text-subtle-foreground uppercase">
            Placeholder
          </p>
          <p className="mt-3 text-sm">{coming}</p>
        </div>
      </PageContainer>
    </main>
  )
}
