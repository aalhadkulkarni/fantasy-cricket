import type { ComponentProps } from 'react'
import { Tabs as TabsPrimitive } from 'radix-ui'

import { cn } from '@/lib/utils'

/**
 * The underline tab bar from `docs/design-reference.html` (`.tabs` and `.tab`).
 *
 * **Built on the Radix primitives directly** rather than restyling the stock
 * shadcn `TabsList`, whose pill variant carries a fixed height and tight padding
 * that fight every override. The root and content still come from `ui/tabs`.
 *
 * **Every tab is the same width**, whatever its label, so the bar does not
 * change shape as counts or names change. They share the row equally on a
 * phone and are a fixed width from `sm`.
 *
 * **An active tab is not a live state**, so it is full-strength text with an
 * underline, never blue.
 */
export function PageTabsList({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn('flex w-full gap-1 border-b sm:w-auto', className)}
      {...props}
    />
  )
}

export function PageTab({
  className,
  count,
  children,
  ...props
}: ComponentProps<typeof TabsPrimitive.Trigger> & {
  /** A figure after the label, in the mono face. Absent shows none. */
  count?: number
}) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        '-mb-px inline-flex flex-1 cursor-pointer items-center justify-center border-b-2 border-transparent px-3 py-3 text-sm font-semibold whitespace-nowrap text-subtle-foreground transition-colors outline-none hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 data-[state=active]:border-foreground data-[state=active]:text-foreground sm:w-36 sm:flex-none',
        className,
      )}
      {...props}
    >
      {children}
      {count !== undefined && (
        <span className="ml-2 font-mono text-[11px] font-bold text-muted-foreground">
          {count}
        </span>
      )}
    </TabsPrimitive.Trigger>
  )
}
