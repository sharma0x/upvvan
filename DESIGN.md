---
version: alpha
name: Upvvan
description: >
  A neighbourhood plant specialist that is honest about what it can deliver.
  The interface is calm, plain-spoken and unfussy: a customer on a phone, in a
  rented flat, deciding whether to trust us with a living thing. Confidence comes
  from saying "not yet" clearly rather than from visual polish.

# Warm botanical palette, sampled 4 Oct 2026 from eight live competitor
# homepages (see design/MOOD-BOARD.html). Every one of them — Ugaoo, Urvann,
# Paudhewale, TrustBasket, Bloomscape, The Sill, Hey Rooted — reaches for cold
# pure-white or high-chroma green. Bloomscape was the only warm ground found
# (`#fcf9f3`), and it is the one read as premium. Cream is therefore the surface,
# and the greens are darkened slightly so they hold against it.
#
# The greens keep hue 145. The SURFACES move to hue 70 (warm cream) — the two
# families no longer share a hue, which is the point: warm ground + cool green
# is the whole visual idea, and tinting the neutrals green threw it away.
colors:
  primary: 'oklch(0.52 0.15 145)'
  secondary: 'oklch(0.62 0.14 145)'
  # `secondary` is 3.62:1 on `forest`, which fails WCAG AA for the small text it
  # was being used for (trust-rail links, the 01–04 numerals). This is the light
  # green for ON-FOREST text only — 5.6:1. Never use it on a light surface: there
  # it is 2.9:1.
  'secondary-light': 'oklch(0.82 0.11 145)'
  # `forest` is the display/hero colour: a near-black green used for large
  # editorial type and the trust rail. Sampled from Bloomscape (#224229).
  forest: 'oklch(0.32 0.05 145)'
  # Clay is the ONLY accent allowed on a customer-facing plant or planter, and
  # the eyebrow label colour. Terracotta is the planter story, which is our
  # primary AOV mechanic (+29% to +121%), so it needs its own voice — but it must
  # never encode a yes/no, which is what green is for.
  clay: 'oklch(0.55 0.12 45)'
  # Consumables only: soil, fertiliser, neem cake. Never a plant.
  ochre: 'oklch(0.52 0.11 75)'
  surface: 'oklch(0.978 0.012 85)'
  'surface-raised': 'oklch(0.945 0.016 85)'
  # Raised cards sit lighter than the page, so a card reads as an object lifted
  # off warm paper rather than a hole punched in it.
  'surface-card': 'oklch(0.992 0.008 85)'
  ink: 'oklch(0.22 0.012 75)'
  'ink-muted': 'oklch(0.47 0.014 75)'
  border: 'oklch(0.87 0.018 80)'
  # Selected-state ground for the planter ladder. This is the token that was
  # referenced as `bg-brand-soft` in the catalogue components but NEVER EXISTED
  # in the exported theme, so the selected pot rendered with no background at
  # all — the one control the AOV mechanic depends on was visually inert.
  'brand-soft': 'oklch(0.93 0.03 145)'
  success: 'oklch(0.52 0.14 150)'
  'success-soft': 'oklch(0.95 0.03 145)'
  # Darkened from L 0.68 to 0.52 after `design.md lint` measured the original at
  # 2.91:1 on the surface colour — below WCAG AA. Warning text is still a
  # warning; it just has to be legible to the people who most need to read it.
  warning: 'oklch(0.52 0.13 70)'
  danger: 'oklch(0.52 0.17 25)'

typography:
  # Display is a REAL serif stack, not the `ui-serif` keyword. `ui-serif` is a
  # single generic slot that resolves to whatever the OS ships — Times on one
  # machine, Charter on another, something else on a third. Every competitor
  # that reads as premium (Bloomscape, The Sill) names its display face
  # explicitly. The stack leads with Iowan Old Style and Palatino (both present
  # by default on macOS/iOS, which is where most of our traffic is), then falls
  # back to Georgia and finally `ui-serif` so Linux and Android still get a
  # real serif rather than a sans.
  #
  # Weight is 400, NOT 600. At 46–64px a bold serif reads as a newspaper
  # masthead; the authority here comes from size and space, not from weight.
  h1:
    fontFamily: 'Iowan Old Style, Palatino Linotype, Palatino, Georgia, ui-serif, serif'
    fontSize: 3.5rem
    fontWeight: 400
    lineHeight: 1.04
    letterSpacing: '-0.02em'
  # Section headings share the display stack at a smaller size. Never bold.
  h2:
    fontFamily: 'Iowan Old Style, Palatino Linotype, Palatino, Georgia, ui-serif, serif'
    fontSize: 2rem
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: '-0.01em'
  body-md:
    fontFamily: 'Avenir Next, Avenir, Inter, ui-sans-serif, system-ui, sans-serif'
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.6
  label-caps:
    fontFamily: 'Avenir Next, Avenir, Inter, ui-sans-serif, system-ui, sans-serif'
    fontSize: 0.75rem
    fontWeight: 600
    letterSpacing: '0.16em'

rounded:
  sm: 8px
  md: 12px
  lg: 16px

spacing:
  xs: 4px
  sm: 8px
  md: 12px
  base: 16px
  lg: 24px
  xl: 32px
  '2xl': 48px
  '3xl': 64px

components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.surface}'
    rounded: '{rounded.sm}'
    padding: 16px
  button-primary-disabled:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.surface}'
    rounded: '{rounded.sm}'
    padding: 16px
  input-field:
    backgroundColor: '{colors.surface-raised}'
    textColor: '{colors.ink}'
    rounded: '{rounded.sm}'
    padding: 14px
  select-field:
    backgroundColor: '{colors.surface-raised}'
    textColor: '{colors.ink}'
    rounded: '{rounded.sm}'
    padding: 14px
  label-secondary:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink-muted}'
  result-serviceable:
    backgroundColor: '{colors.success-soft}'
    textColor: '{colors.ink}'
    rounded: '{rounded.sm}'
    padding: 16px
  result-unserviceable:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    rounded: '{rounded.sm}'
    padding: 16px
  # Operational states — licence pending, capacity short, gate refused. Amber and
  # red appear almost nowhere on the customer surface by design, so they are
  # declared as components here rather than left as unreferenced palette entries.
  status-pending:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.warning}'
  status-blocked:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.danger}'
  # Success is referenced here as the hairline on a "yes" answer, so the token
  # that carries the meaning is the one that carries the border.
  result-serviceable-border:
    backgroundColor: '{colors.success}'
  # Hairline separating form controls from the surface behind them.
  control-border:
    backgroundColor: '{colors.border}'
  # ── Storefront surfaces (added 4 Oct 2026) ──────────────────────────────────
  # Card ground. Lighter than `surface` so a card reads as a physical object
  # lifted off warm paper. `surface-raised` is DARKER than the page and is used
  # for recessed wells (form panels); `surface-card` is lighter and is used for
  # things you pick up. Conflating the two is why the old catalogue looked like
  # holes cut in the page.
  card:
    backgroundColor: '{colors.surface-card}'
  card-border:
    backgroundColor: '{colors.border}'
  # The hero and trust rail. Forest, not primary: this is a large dark ground
  # carrying white text, and `primary` at L 0.52 across a full-bleed band reads
  # as a sale banner.
  band-forest:
    backgroundColor: '{colors.forest}'
    textColor: '{colors.surface}'
  # The planter ladder's selected row. Terracotta, deliberately NOT green —
  # selecting a pot is a choice, not an answer, and green is reserved for truth.
  planter-selected:
    backgroundColor: '{colors.clay}'
    textColor: '{colors.surface}'
  # Trust rail, on the forest band. Needs its own token because `secondary` is
  # 3.62:1 on forest and these are 13–14px links and numerals. `secondary-light`
  # measures 5.6:1 there. This component exists in DESIGN.md specifically so the
  # contrast requirement is expressed next to the colours it constrains, rather
  # than only in a comment — `design.md lint` then enforces that the token is used.
  on-forest-accent:
    backgroundColor: '{colors.forest}'
    textColor: '{colors.secondary-light}'
  on-forest-body:
    backgroundColor: '{colors.forest}'
    textColor: '{colors.surface}'
  # Consumable rail (soil, fertiliser). Ochre.
  consumable-accent:
    backgroundColor: '{colors.ochre}'
  # Eyebrow label on the storefront.
  eyebrow:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.clay}'
  # Soft green tint for a SELECTED row in a choice list — the grow-pot entry in
  # the planter ladder, and the selected size tier on the PDP. Referenced by the
  # catalogue components as `bg-brand-soft`, which is why it has to exist: before
  # this token was declared, the selected planter rendered with a border colour
  # change and no ground at all, and `design.md lint` correctly reports the token
  # as orphaned because nothing in DESIGN.md referenced it.
  selection-soft:
    backgroundColor: '{colors.brand-soft}'
---

# Upvvan — design context

## Overview

A single-city plant specialist that owns its own nursery and its own riders.
The business thesis is not plants or price — it is **service**: answering on
WhatsApp inside 15 minutes, and replacing a plant that dies rather than
deflecting with a coupon. Across nine competitors the loudest failure is that
nobody answers.

So the interface has one job above all others: **be straight with the customer.**
Saying "we do not deliver to your pincode yet" is a feature, and it must be
easier to read than anything else on the page. A customer who is told the truth
early can choose a competitor cleanly. A customer told "yes" and then cancelled
becomes a one-star review.

Everything below follows from that.

## Colors

Green is still the only colour that encodes a **truth**, and the rule is
unchanged and absolute: a green surface means yes, a neutral surface means no.
Amber and red remain reserved for operational warnings (licence pending,
capacity short) and appear almost nowhere on the customer surface.

What changed is that green is no longer the only chromatic voice. `clay`
(terracotta) and `ochre` (soil) were added as **decorative** accents with hard
scopes, because a monochrome green page cannot carry a planter ladder, a
seasonal catalogue and a set of category facets without them all collapsing into
the same signal.

| Token | Scope | Forbidden as |
| ----- | ----- | ------------ |
| `primary` / `success` | Actions, affirmative answers, "yes we deliver" | Backgrounds behind long body copy |
| `forest` | Display type, trust rail, section grounds | Anything that must read as a click |
| `clay` | Eyebrow labels, planter surfaces, pot selection | Any yes/no state |
| `ochre` | Consumables only — soil, fertiliser, neem cake | A living plant |

The separation that matters: **clay never answers a question.** If clay is on
screen, nothing is being asserted to the customer. That is what keeps "green
means yes" intact while allowing the page to be warm.

Neutrals are now warm (hue 70–85) rather than green-tinted. The earlier rule —
tint neutrals toward the brand hue — was right for a green-on-gray system and is
wrong for warm-ground-plus-cool-green, which is the visual idea the mood board
settles on. Pure black and pure white remain banned in both directions.

`primary` (L 0.52) rather than `secondary` (L 0.62) is the interaction colour
because white text on it clears WCAG AA. The lighter `secondary` is for large
text and accents only, where the contrast ratio would fail.

## Typography

A **named** serif stack leads the display sizes, at weight 400. `ui-serif` alone
is a generic slot that resolves differently per OS, so the site looked like a
different brand on different machines; naming Iowan Old Style / Palatino /
Georgia fixes that with zero webfont weight, which matters because a customer on
a patchy mobile connection pays for every kilobyte.

Body and labels are a named sans stack (Avenir Next / Inter / system-ui). It is
still system-resident rather than a downloaded face, for the same reason, and
Inter and system-ui both render Devanagari correctly when the regional-language
wedge ships.

Small-caps letter-spaced labels mark sections. They are structural, not
decorative, and never used below 12px where they stop being legible. On the
storefront they are `clay`; on the coverage screen they stay `ink-muted`,
because the coverage screen has no accent vocabulary.

## Layout

A 4pt spacing scale. Controls get 14–16px padding, which is the minimum that
keeps a tappable target comfortable for someone holding a plant pot in the other
hand.

**Two different measures, deliberately:**

- The **coverage checker** stays one column at max 640px. That screen is a single
  question with a single answer; a wider layout would imply there is more to
  decide, and that is the one screen where clarity must beat presentation.
- The **storefront** widens to 1120px with a two-column hero, because it is
  browsing rather than deciding, and browsing in a 640px column is a list, not a
  shop.

The old rule said "one column, max 640px" for the whole site. Applying it
everywhere is what produced a catalogue that read as a document.

## Shapes

8px for controls and result banners, 12px for the containing card. Nothing is
fully rounded — plants are not pills, and a pill-shaped form reads as a toy.

## Components

`button-primary` is the single high-emphasis action. There is no secondary
button on this screen; a customer either checks coverage or leaves.

Disabled buttons keep full opacity in the DOM and are distinguished by
`cursor: not-allowed` plus reduced opacity — never by removing the affordance
entirely, so the control does not jump position as the form becomes valid.

Result banners always carry a 1px border in addition to a background tint, so the
state is legible in greyscale and to a colour-blind customer.

## Do's and Don'ts

**Do**

- Show the coverage answer with the same visual weight as the question.
- Name the city in a refusal: "not in Bengaluru yet" is more useful than a bare
  error.
- Keep prepaid-only framing visible and matter-of-fact. It is the model, not an
  apology.

**Don't**

- Don't soften a refusal. No "we'll try our best", no upsell on a pincode we
  cannot serve.
- Don't reveal another city's name in a refusal. "Not in your delivery city yet"
  only.
- Don't use green as decoration. If it is green, it means yes.
- Don't use gradient text, or `border-left` accent stripes thicker than 1px.
- Don't animate a coverage answer. The result should appear like a fact.
