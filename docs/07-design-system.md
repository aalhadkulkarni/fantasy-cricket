# Design System — "Floodlit LED"

**A working reference lives at `docs/design-reference.html`.** Open it in a
browser to see every token, type sample and component rendered. Read its CSS
rather than re-deriving anything from this document — it is the source of truth
for exact values.

---

## The concept

**A T20 night match.** Stadium dark, with the floodlight rig as the organising
metaphor.

> **The one thing that is live on the page is genuinely lit. Everything else
> sits in the dark and stays quiet.**

This is not decoration. _"What is live right now"_ is the question this product
answers constantly — an auction running, a deadline approaching, your turn to
pick. That question earns a visual treatment rather than a badge.

**"LED"** names the palette: cold white-blue, like a modern stadium rig, rather
than the warm amber of older sodium lamps. Four palettes were built and compared;
this one was chosen for legibility, since the app is data-dense and read on
phones at night.

---

## Tokens

A **token** is a named value for a design decision. Defining `--live` once means
changing it changes everything — and, more importantly, the name carries meaning
that a hex code does not. The rules below depend on that meaning.

### shadcn's names are the interface

**Use shadcn/ui's semantic token names**, because every shadcn component
references them. Renaming them would mean rewriting each component as it is
added.

The concept names map onto those:

```css
/* surfaces */
--background: #080b10; /* the page */
--card: #121821; /* card and panel faces */
--popover: #121821;
--secondary: #1b232e; /* raised */
--accent: #1b232e; /* hover — a surface, not a colour accent */
--border: #28313d; /* every hairline */
--input: #28313d;

/* text, three tiers */
--foreground: #ecf2f8; /* primary */
--muted-foreground: #94a1b0; /* secondary */
--subtle-foreground: #5e6a78; /* captions, metadata — our addition */

/* a primary action is NOT a live state — see rule 1 */
--primary: #ecf2f8; /* near-white fill */
--primary-foreground: #080b10;

--ring: #ecf2f8; /* focus. deliberately not --live */
--destructive: #e5484d;

--radius: 12px;
```

### Our additions

shadcn has no equivalent for these:

```css
--live: #3b9eff; /* LIVE STATES ONLY — see rule 1 */
--live-text: #3b9eff; /* text; diverges on light backgrounds */
--live-foreground: #00121f; /* text sitting on a --live fill */
--settled: #5ebe97; /* steady positive states */
--bloom: 59, 158, 255; /* rgb of --live, for gradients */
```

**Tailwind reads these**, rather than holding its own hardcoded values. That is
why the scaffold was set up to consume CSS variables.

### The accent is two tokens, not one

`--live` is a **fill** colour. On a light background it would need to darken to
around `#0B6BD6` for text, because `#3B9EFF` on white is roughly 2.8:1 — below
the accessible minimum for body text.

Phase 1 ships **dark only**, so this does not bite yet. The split exists in the
token structure so a light theme is possible later without rewriting every
component that references the accent.

### Dark is the default, not a variant

Phase 1 has no light theme. **Define these tokens on `:root` directly** rather
than gating them behind a `.dark` class — there is no other theme to switch
away from.

---

## Type

| Role               | Typeface                                 | Used for                        |
| ------------------ | ---------------------------------------- | ------------------------------- |
| **Display and UI** | **Archivo** — weights 500, 600, 700, 800 | Headings, labels, body, buttons |
| **Data**           | **Space Mono** — 400, 700                | Every figure                    |

**Space Mono covers:** budgets, bids, ranks, points, deadlines, timestamps,
league codes, slot counts, match numbers.

> **Mono for data is deliberate.** These all read as _figures_, and a monospaced
> face makes them align in columns — which matters constantly on a product
> shaped like a scorecard. It also visually separates "this is a number you can
> act on" from surrounding prose.

---

## The six rules

These keep the concept coherent. The first is the one that matters most.

**1. `--live` appears nowhere except live states.**

An auction running. A deadline imminent. Your turn to pick.

**Not** on primary buttons. **Not** on the brand mark. **Not** on active tabs or
underlines. **Not** on count badges. **Not** on league-type tags — a league being
an auction league is a _type_, not a state.

> If it is used decoratively, nothing means "live" any more and the metaphor is
> dead. **This rule is the whole design** — everything else exists so that this
> one lands.

**What this forces:** a primary action button uses `--primary`, a near-white
fill. That is the standard pattern on dark interfaces and reads as clearly
primary without borrowing the accent. Tags distinguish by _fill_ rather than by
colour. The focus ring uses `--ring`, not `--live`.

> An earlier version of the reference file broke this rule on its own example
> page — primary button, brand, badge and tab underline were all `--live`. That
> was caught in review. If a page ends up with several blue things on it, the
> rule has been broken somewhere.

**2. `--settled` for steady positive states** — a gameweek in progress, points
confirmed. Positive, but not urgent.

**3. Bloom, not glow-everything.** The lit card carries a top-edge radial bloom
plus a soft animated beam. **One element per screen, maximum.** Two glowing
things compete and neither reads as important.

**4. `prefers-reduced-motion` kills the beam animation**, retaining a static
opacity. The card still reads as live without moving.

**5. The card or row body is the link.** Buttons are reserved for secondary
actions.

> This keeps cards clean as roles multiply. A league card gains spectator tags,
> admin badges and status text over time — if every one of those needed a button
> the card would become a toolbar.

**6. Mobile is the primary target.** Every layout must survive **390px** with no
horizontal scroll.

> Most usage is a phone browser. This is a constraint, not an aspiration —
> when deciding whether a table can scroll sideways, the answer comes from here.

---

## The signature element

**The light bloom on a live card.** A radial gradient from the top edge, plus a
two-pixel beam that pulses gently.

```css
.card.is-live {
  border-color: rgba(var(--bloom), 0.4);
}
.card.is-live::before {
  /* the bloom */
  content: '';
  position: absolute;
  inset: -1px -1px auto;
  height: 110px;
  background: radial-gradient(
    90% 100% at 50% 0%,
    rgba(var(--bloom), 0.22),
    transparent 70%
  );
  pointer-events: none;
}
.card.is-live::after {
  /* the beam */
  content: '';
  position: absolute;
  top: 0;
  left: 14%;
  right: 14%;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--live), transparent);
  animation: beam 3.2s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  .card.is-live::after {
    animation: none;
    opacity: 0.8;
  }
}
```

**This is the one memorable thing in the design.** Everything around it stays
disciplined so that it lands.

---

## Component library

**shadcn/ui**, which is Radix primitives styled with Tailwind, with components
copied into the repo rather than installed from a package.

**Why it fits:** shadcn themes through CSS custom properties by default — the
same mechanism these tokens already use. The tokens map straight onto it rather
than fighting a theme object.

> MUI and Fluent UI were both considered and rejected. Each brings its own
> visual language — Material's or Microsoft's — which would have to be overridden
> on nearly every screen. Mockups were built of both; MUI could be dragged close
> to Floodlit, but only through a theme object plus overrides on the header,
> cards, chips, tabs, buttons and badges, and its buttons stay uppercase because
> that is baked into Material's spec. With shadcn, only the variable block
> changes.

**Add components individually as needed** — `npx shadcn@latest add dialog` —
rather than installing a set upfront. Each brings only the Radix package it
requires.

---

## Palettes considered and rejected

Kept as a record so these are not revisited.

| Palette                                                     | Why not                                                                                                                                                                       |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sodium** — amber `#F5A623` on indigo `#0C1024`            | Strong, warm, unambiguously "floodlight". The close second.                                                                                                                   |
| **Pink ball** — `#FF4D8D` on plum `#120E17`                 | The most memorable and the most cricket-literate: day-night Tests are the only place pink balls exist. Rejected for reading playful on a competitive product.                 |
| **Saffron** — `#FF9933` on maroon `#130A0A`, teal secondary | Warmest and most distinctly Indian, and a genuinely good colour pairing — but saffron on maroon carries political connotation in India that is better avoided than navigated. |

**LED was chosen for legibility.** Blue on dark is the most readable of the four,
and this is a data-dense app read on phones at night. Blue being a common accent
elsewhere matters less than it seems — the floodlight _structure_ carries the
identity, not the hue.

---

## Light theme

**Not in Phase 1.** Dark only.

A light variant was explored. Two findings worth recording, in case it is ever
built:

- **A straight inversion does not work.** `--live` fails contrast on white at
  about 2.8:1, and `--settled` is worse at roughly 2:1. Both need darkening for
  text use — around `#0B6BD6` and `#1B7A54` respectively.
- **The bloom cannot survive.** Light does not glow against light. The
  replacement that worked was a solid four-pixel bar down the card's left edge
  plus a faint tint, on a page background slightly off-white so cards lift off
  it.

> **The product is watched at night during cricket matches, and its identity is
> a floodlight.** A light theme would always be the weaker expression of this
> design, and maintaining two token sets means checking every screen twice.

---

## What is deferred

| Item                    | Status                                                                                                                                                                                                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Accessibility audit** | After Phase 1. **But a floor applies during the build:** semantic HTML, visible focus states, alt text. Those are nearly free now and expensive to retrofit, since retrofitting means reopening markup that would otherwise never be touched. Colour contrast is already handled by these tokens. |
| **Performance work**    | Later. No equivalent retrofit trap.                                                                                                                                                                                                                                                               |
| **Light theme**         | See above.                                                                                                                                                                                                                                                                                        |
