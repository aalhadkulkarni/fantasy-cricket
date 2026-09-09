/**
 * The Firebase project this app talks to.
 *
 * **One config for all four environments.** They are four roots inside one
 * database, selected by a path prefix rather than by connecting somewhere
 * different, so nothing here varies between them. Which root is active is
 * `environments.ts`; turning that into a prefix is the Firebase service's job.
 *
 * A plain object with no Firebase import, so reading the config never pulls the
 * SDK in. Everything that touches Firebase itself lives in
 * `src/data-layer/firebase/`.
 *
 * ---
 *
 * **The API key is not a secret, and committing it is correct.** Firebase web
 * config is public by design: it ships inside the browser bundle wherever it is
 * stored, so moving it to an environment variable would add ceremony without
 * adding safety. What protects the data is the security rules, and in Phase 1
 * the data layer.
 *
 * ---
 *
 * **`databaseURL` must stay explicit, and this project is why.**
 *
 * The database lives in `asia-southeast1`, so its host ends
 * `.asia-southeast1.firebasedatabase.app`. Omit the field and the SDK does not
 * fail — it **guesses** `https://{projectId}-default-rtdb.firebaseio.com`,
 * which is the default US region and is wrong here. Every read would have gone
 * quietly nowhere against a URL that looked entirely plausible.
 *
 * Singapore is also the sensible region for this product, whose users are in
 * India.
 */
/**
 * The shape, declared here rather than imported as Firebase's `FirebaseOptions`
 * — importing that would pull the SDK into `src/config/`, and every Firebase
 * import belongs in `src/data-layer/firebase/`.
 *
 * Annotated rather than `as const`, so `databaseURL` is a `string` and not the
 * literal below. With the literal type, the empty-string guard in
 * `firebase-service.ts` becomes provably false and stops compiling — which
 * would mean deleting a check that still matters for a fresh clone.
 */
interface FirebaseWebConfig {
  readonly apiKey: string
  readonly authDomain: string
  readonly projectId: string
  readonly storageBucket: string
  readonly messagingSenderId: string
  readonly appId: string
  readonly databaseURL: string
}

export const FIREBASE_CONFIG: FirebaseWebConfig = {
  apiKey: 'AIzaSyDRyB9v4x99OWCN8yWuq_kWQb0i3uQaxHc',
  authDomain: 'fantasy-cricket-league-c0346.firebaseapp.com',
  projectId: 'fantasy-cricket-league-c0346',
  storageBucket: 'fantasy-cricket-league-c0346.firebasestorage.app',
  messagingSenderId: '65959591798',
  appId: '1:65959591798:web:d391645464c2cad1a3c457',

  /** Realtime Database, `asia-southeast1`. See the note above on why this is explicit. */
  databaseURL:
    'https://fantasy-cricket-league-c0346-default-rtdb.asia-southeast1.firebasedatabase.app',
}

/**
 * `measurementId` from the console snippet is deliberately not here, and
 * neither is `getAnalytics`.
 *
 * Nothing in `docs/` asks for analytics, there is no measurement plan to serve,
 * and it carries consent implications nobody has discussed. It also throws
 * outside a browser — the SDK's own advice is to wrap the call in
 * `isSupported()`, which is real work for a feature that has not been asked
 * for. Two lines to add if it is ever wanted.
 */
