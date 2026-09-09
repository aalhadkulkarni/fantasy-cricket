/**
 * Branded id types.
 *
 * Every id in the database is a Firebase push key — an opaque twenty-character
 * string. That means `leagueId`, `managerId` and `matchId` are indistinguishable
 * to the compiler, and the data layer takes two or three of them in most of its
 * functions. A transposed pair does not throw; it reads a path that does not
 * exist and returns nothing, which surfaces as "no data" rather than as a bug.
 *
 * Branding makes that a compile error. The cost is that a string arriving from
 * the database has to be asserted into its brand, which happens once per read
 * inside the data layer and nowhere above it.
 *
 *     const leagueId = snapshotKey as LeagueId   // at the boundary, deliberate
 *
 * There is no runtime representation. `brand` is `declare`d, so all of this
 * erases to nothing.
 *
 * ---
 *
 * **Known limit, verified rather than assumed: branding does not survive in
 * computed key position.**
 *
 *     declare function f(p: PlayerId): void
 *     f(someBidId)                                  // error, as intended
 *
 *     const a: Record<PlayerId, number> = { 'nonsense': 1 }      // error
 *     const b: Record<PlayerId, number> = { [someBidId]: 1 }     // NO error
 *
 * A literal key of the wrong shape is rejected, but a *computed* key of any
 * branded string is accepted, because TypeScript widens computed keys to
 * `string`. So brands protect arguments and literals, and quietly do not
 * protect building a map by iterating over ids — which is exactly where you
 * would want them to.
 *
 * **Worse: two `Record`s with different key brands are mutually assignable**,
 * however unrelated their values.
 *
 *     declare const gw: Record<GameWeekId, GameWeekLineup>
 *     const m: Record<MatchId, MatchLineup> = gw     // NO error
 *
 *     declare const gw2: Record<string, GameWeekLineup>
 *     const m2: Record<string, MatchLineup> = gw2    // error, correctly
 *
 * Different brands make TypeScript treat the key sets as disjoint, so it finds
 * no overlapping properties to compare and succeeds vacuously. Plain `string`
 * keys catch this; branded ones do not. **For this one check, branding is
 * actively worse than not branding.**
 *
 * Kept anyway, because the value is in parameter positions — `getTeamFor` takes
 * three ids that would otherwise be three indistinguishable strings — and that
 * is where the mistakes actually happen. But nothing here should be trusted to
 * catch a wrongly-typed map.
 */

declare const brand: unique symbol

/** A string that only accepts other strings carrying the same brand. */
type Brand<K extends string> = string & { readonly [brand]: K }

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

/**
 * **The Firebase Auth UID.** Not an id of our own: there is no translation
 * table, because the UID is stable, unique, and the only value a Phase 2
 * security rule can check, since `auth.uid` resolves to exactly this.
 */
export type UserId = Brand<'UserId'>

// ---------------------------------------------------------------------------
// Cricket
// ---------------------------------------------------------------------------

/** UI calls this a "Base Tournament". */
export type CompetitionId = Brand<'CompetitionId'>

/** UI calls this simply a "Tournament". One running of a competition. */
export type TournamentId = Brand<'TournamentId'>

export type TeamId = Brand<'TeamId'>

/** A cricketer, not a fantasy participant. Those are managers. */
export type PlayerId = Brand<'PlayerId'>

export type MatchId = Brand<'MatchId'>
export type RoundId = Brand<'RoundId'>

// ---------------------------------------------------------------------------
// League
// ---------------------------------------------------------------------------

export type LeagueId = Brand<'LeagueId'>

/**
 * The eight-character code someone types to find a league.
 *
 * Deliberately not a `LeagueId`: it is a capability rather than an identifier,
 * it never appears in a URL, and it can in principle be regenerated. See
 * "Ids in URLs, codes for humans" in `05-data-model.md`.
 */
export type LeagueJoinCode = Brand<'LeagueJoinCode'>

export type GameWeekId = Brand<'GameWeekId'>
export type TransferWindowId = Brand<'TransferWindowId'>
export type TransferProposalId = Brand<'TransferProposalId'>

// ---------------------------------------------------------------------------
// Live auction runtime
// ---------------------------------------------------------------------------

export type BidId = Brand<'BidId'>
export type NoBidId = Brand<'NoBidId'>
export type TimelineMessageId = Brand<'TimelineMessageId'>
