import { useState } from 'react'

/**
 * The quickest way to invite, which is what a new league needs most. Not the
 * only way in — a closed league can be found on its tournament page.
 */
export function JoinCode({
  code,
  compact = false,
}: {
  code: string
  /** Plain text and a small copy link, for the collapsed header's line. */
  compact?: boolean
}) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    void navigator.clipboard?.writeText(code).then(() => setCopied(true))
  }

  if (compact) {
    return (
      <span className="flex items-center gap-1.5 font-mono text-[11px]">
        <span className="tracking-[0.12em] text-muted-foreground">{code}</span>
        <button
          type="button"
          className="text-subtle-foreground underline-offset-2 hover:text-foreground hover:underline"
          onClick={copy}
        >
          {copied ? 'copied' : 'copy'}
        </button>
      </span>
    )
  }

  return (
    <span className="flex items-center gap-2.5">
      <span className="rounded-md border bg-secondary px-2.5 py-1 font-mono text-xs tracking-[0.12em]">
        {code}
      </span>
      <button
        type="button"
        className="font-mono text-xs text-subtle-foreground hover:text-foreground"
        onClick={copy}
      >
        {copied ? 'copied' : 'copy'}
      </button>
    </span>
  )
}
