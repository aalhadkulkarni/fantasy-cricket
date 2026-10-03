import { Input } from '@/components/ui/input'

/**
 * **A filter above an admin list.** It narrows what is already loaded, as you
 * type, with nothing fetched; clearing it shows everything again.
 */
export function FilterBox({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <Input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label="Filter the list"
      className="mt-5"
    />
  )
}
