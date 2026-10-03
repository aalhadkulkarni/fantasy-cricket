/**
 * **Rules about the catalogue that more than one writer needs** — the IPL
 * seed data and bulk upload alike — so they cannot drift apart.
 */

export {
  FORMAT_COMPETITIONS,
  INTERNATIONAL_COMPETITIONS,
  type IntlFormat,
} from '@fantasy-cricket/shared'

/**
 * **A short name for each player**: the surname, unless two players share it,
 * in which case the first initial goes in front — "H Pandya", "K Pandya". If
 * that still collides, as three A Sharmas do, the full name is used.
 */
export function shortNames(names: readonly string[]): string[] {
  const surname = (name: string) => {
    const words = name.trim().split(/\s+/)
    return words[words.length - 1] ?? name
  }
  const initialled = (name: string) =>
    `${name.trim().charAt(0)} ${surname(name)}`
  const countOf = (key: (name: string) => string) => {
    const counts = new Map<string, number>()
    for (const name of names) {
      counts.set(key(name), (counts.get(key(name)) ?? 0) + 1)
    }
    return (name: string) => counts.get(key(name)) ?? 0
  }
  const sharingSurname = countOf(surname)
  const sharingInitial = countOf(initialled)

  return names.map((name) => {
    if (sharingSurname(name) === 1) return surname(name)
    if (sharingInitial(name) === 1) return initialled(name)
    return name.trim()
  })
}
