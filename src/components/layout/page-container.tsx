import { cn } from '@/lib/utils'

/**
 * The one content width, shared by the site header and every page.
 *
 * **1100px with 28px of horizontal padding**, taken from `.wrap` and `.hdr-in`
 * in `docs/design-reference.html`, which deliberately give both the same value
 * so the header's left edge lines up with the page heading beneath it.
 *
 * A component rather than a copied class string because every page needs it,
 * and a width that drifts between pages is the kind of thing nobody notices
 * until several are wrong.
 */
export function PageContainer({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('mx-auto w-full max-w-[1100px] px-7', className)}>
      {children}
    </div>
  )
}
