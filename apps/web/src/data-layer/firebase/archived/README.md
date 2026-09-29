# The browser's old data layer

These three files are how the app talked to Firebase before the API service
existed: `FirebaseApi` implementing the contract, `FirebaseService` wrapping
the client SDK, and the path builders.

**They are kept for reference and nothing imports them.** The working copies
now live in `apps/api/src/firebase`, against the Admin SDK, and the browser
reaches them over HTTP through `HttpApi`.

**They are excluded from typechecking, linting and formatting**, so they are
frozen as they were rather than being kept compiling. They will drift from the
server's copies; when that stops being useful, delete the folder — git has
them either way.
