/**
 * Every function in this layer is a signature with no implementation yet.
 *
 * A stub cannot simply ignore its arguments — `noUnusedParameters` is on — and
 * an empty body cannot satisfy a declared return type. This does both jobs:
 * every parameter is passed through, so the compiler is satisfied, and the
 * return type is `never`, so it fits any signature.
 *
 * It throws rather than returning a placeholder, deliberately. A stub that
 * returned an empty array would let a component render as though it had loaded
 * nothing, which is a state the interface is supposed to handle for real
 * emptiness. Failing loudly keeps the two apart.
 *
 * **The stubs declare `Promise<T>` without being `async`**, which is why: a
 * function marked `async` with nothing to await trips `require-await`, and
 * `never` satisfies `Promise<T>` on its own. Callers cannot tell the
 * difference. Add `async` when a body arrives.
 */
export function notImplemented(
  name: string,
  args: Record<string, unknown>,
): never {
  const passed = Object.keys(args).join(', ')
  throw new Error(
    `data-layer: ${name}(${passed}) is a signature only — not implemented yet`,
  )
}
