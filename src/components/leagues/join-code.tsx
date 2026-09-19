import { useState } from 'react'

/**
 * The quickest way to invite, which is what a new league needs most. Not the
 * only way in — a closed league can be found on its tournament page.
 */
export function JoinCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <span className="flex items-center gap-2.5">
      <span className="rounded-md border bg-secondary px-2.5 py-1 font-mono text-xs tracking-[0.12em]">
        {code}
      </span>
      <button
        type="button"
        className="font-mono text-xs text-subtle-foreground hover:text-foreground"
        onClick={() => {
          void navigator.clipboard?.writeText(code).then(() => setCopied(true))
        }}
      >
        {copied ? 'copied' : 'copy'}
      </button>
    </span>
  )
}
