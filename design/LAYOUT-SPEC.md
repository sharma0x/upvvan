# Upvvan — storefront layout spec

**Date:** 4 October 2026 · **Companion to:** `design/MOOD-BOARD.html`
**Evidence base:** live homepage HTML fetched 4 Oct 2026 from ugaoo.com,
bloomscape.com, thesill.com, heyrooted.com, trustbasket.com, foliage-factory.com,
mcaffeine.com. Urvann, Paudhewale and Plantora are JS-rendered and returned only a
shell — their page structure is **UNVERIFIED** and nothing here is attributed to them.

---

## 1. What the competitors actually do

| Site                | Hero                                                                                         | Then, in order                                                                                                                                                                                                                                                       | Ground          | Primary                      |
| ------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ---------------------------- |
| **Ugaoo**           | Banner carousel, ≤450px title column                                                         | Offers for You → Beginner-friendly → room facets (Living/Bedroom/Balcony/Office) → newsletter → Most loved → **farm trust (Grown at our farm / 3-step quality check / Survival packaging / Arrives alive)** → New Arrivals → Ugaoo vs the Rest → gifting → Our Story | `#fff`          | `#0a4c36` + `#ffd02a` yellow |
| **Bloomscape**      | "Bloomscape Your Space this Fall", then a **second** h1 "What kind of plant parent are you?" | 4 facet tiles (Low Light / Pet-Friendly / Statement / Easy Care) → Best Sellers → named-plant rows → **accessory rail (EcoPots, Grow Light, Mister…)** → plant quiz                                                                                                  | `#fcf9f3` cream | `#224229`                    |
| **The Sill**        | "Fall Neutrals" seasonal, growing-zone zip prompt in the announcement bar                    | 3 nav mega-columns → size-led shop → outdoor collection → collections by size/solution/occasion                                                                                                                                                                      | `#f7f7f7`       | `#00ab84` teal + `#f43643`   |
| **Hey Rooted**      | Split slideshow, 550px fixed height, title 60px→43px                                         | Bundle & Save → Green Living Made Easy → **"Over 7,000 5-Star Reviews!"** → Best Sellers → subscription → New Arrivals → Pet Friendly → **30-Day Guarantee**                                                                                                         | `#fff`          | `#134431`                    |
| **TrustBasket**     | Store-name h1, category tiles                                                                | Shop by Collection → New Arrivals carousel → FAQ → **PRESS COVERAGE** → Gardening Kits                                                                                                                                                                               | `#fff`          | `#228654` + `#f6740a`        |
| **Foliage Factory** | —                                                                                            | — (indie, most tasteful palette: `#607359` on `#e2e0da`)                                                                                                                                                                                                             | `#e2e0da`       | `#607359`                    |

**Common to all six:** product carousel or category tiles in the first viewport;
green primary; white or near-white ground; promises scattered; a nav of 12+ items.

**In none of them:** a warm ground except Bloomscape; a delivery-coverage question
above the fold; a number in the hero; an explanation of _why_ the shipping model is
what it is; provenance framed as nearness.

---

## 2. Our order, and why each block sits where it does

Each section answers the objection the previous one raised.

```
┌─ SiteHeader ────────────────────────────────────────────────┐
│ Upvvan          Plants  Guarantee  Contact      Cart · 0    │
└─────────────────────────────────────────────────────────────┘

1. HERO            "Plants that are grown forty minutes away."
                   eyebrow: OWN NURSERY · OWN RIDERS · BENGALURU
                   left: h1 + sub + 2 CTAs + prepaid explained
                   right: DO WE DELIVER TO YOU? (the gate)   ← above fold
2. TRUST RAIL      full-bleed forest band, 4 promises, linked
3. ROOM FACETS     AC flat / Pet-safe / Unkillable / Balcony
4. CATALOGUE       3-col card grid + consumables rail (ochre)
5. PROVENANCE      4 steps: acres → picked → ridden → arrived
6. POLICY NOTE     prepaid-only, stated as a reason
```

**Why the gate is in the hero and not a nav item.** Every competitor hides
"do we deliver to you" behind navigation or omits it. Over-promised geography is
the most-complained-about failure in this category, and Urvann grew revenue 54%
while rating 2.1/5. A customer who cannot trust the delivery map cannot be
persuaded by anything below it.

**Why trust comes second, not last.** Ugaoo's farm trust block sits six sections
down; TrustBasket's is a marquee; Bloomscape's guarantee lives in a support-site
footer. All four of our promises are true _by structure_ rather than by spend, so
putting them high costs nothing and is the actual differentiator.

**Why provenance is near the end, not in the hero.** It is the strongest
structural argument we have — no parcel, no RTO leg — but it only persuades a
customer who already believes the promises above it. Leading with it would be an
argument about logistics to someone who has not yet decided they want a plant.

---

## 3. Section specs

### 1. Hero

- `h1` 56px / weight **400** / tracking −0.02em. Not bold: at this size a bold
  serif reads as a newspaper masthead.
- Eyebrow in `clay` — nothing there is an assertion, which is the rule that keeps
  clay separate from green.
- **No photography yet.** `Species` and `Skus` have no upload field and
  `s3Storage` is config-gated, so the right column carries the coverage gate
  instead of a placeholder box. When imagery lands it swaps in and the gate moves
  beneath the headline — the grid does not need restructuring.

### 2. Trust rail — `bg-forest`

Four items, numbered 01–04, each with a linked CTA:

1. Own nursery, own riders → `/policies`
2. Free delivery, no minimum → `/policies`
3. A human answers on WhatsApp → `/grievance`
4. **48-hour arrival guarantee** → `/policies`

> The guarantee says **48 hours**, matching `Skus.guaranteeTier` default T0 — the
> same number the PDP prints. The 90-day survival promise is the Phase 1 target
> and is deliberately **not** on the page: printing a number we have not measured
> a dead-on-arrival rate against is what produces the worst reviews in this
> category.

### 3. Room facets

Bloomscape's four facets with one India substitution: **"Low Light" →
"AC flat, no window."** Lux measurement false-negatives most of the Indian
market, because the defining fact of an Indian rented flat is not low light, it is
AC running all day and no window at all.

Counts are derived from `care.light`, `care.toxicity`, `care.difficulty` — the
same fields the PDP reads. Not a separate flag column: a non-toxic plant must
never be sold as toxic, and one source of truth prevents that.

Tiles link to `#catalogue`, not to collection pages. We have ~12 seasonal
listings; four dead-ended collection pages for a dozen products is worse than one
honest grid. It shows `None in season` when a facet is empty rather than hiding it.

### 4. Catalogue

Per card: size tier · light → name → botanical → **water interval + soil-moisture %**
→ pet/child safety → price. The water line is copied from Bloomscape's most
transferable mechanic: "top 50–75% of the soil is dry" is testable, "water weekly"
is not.

Price uses `mt-auto` so a ragged grid still aligns its prices.

**Not on the card:** struck-through MRP, "save X%", urgency badges. The planter
ladder is already framed as value on the PDP ("the pot is worth ₹657 more"); a
discount framing here would contradict it.

Consumables sit in their own ochre rail — structurally higher margin, no
mortality, no return leg, and the only line refunded in money rather than replaced.

### 5. Provenance — 4 steps

Two acres inside the city → picked the same morning (never shipped wet) → ridden
by our own people → arrived in one piece. Leads on **distance, not scale**: Ugaoo
has 25 acres in Talegaon and ships nationally, Urvann has 8 farms and 500 riders
across 2 cities, and both are trying to make distance disappear.

---

## 4. Tokens changed

| Token          | Before                                   | After                              | Why                                                                                                                         |
| -------------- | ---------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `surface`      | `oklch(0.995 0.004 145)` cool near-white | `oklch(0.978 0.012 85)` warm cream | 6 of 6 audited sites use cold white. Bloomscape's `#fcf9f3` was the only warm ground.                                       |
| `surface-card` | —                                        | `oklch(0.992 0.008 85)`            | Cards sit _lighter_ than the page so they read as objects, not holes. `surface-raised` (darker) is for recessed wells only. |
| `ink`          | `oklch(0.22 0.008 145)`                  | `oklch(0.22 0.012 75)`             | Warm neutrals; the old rule tinted them green, which fought the warm-ground idea.                                           |
| `forest`       | —                                        | `oklch(0.32 0.05 145)`             | Hero/trust band ground. `primary` across a full-bleed band reads as a sale banner.                                          |
| `clay`         | —                                        | `oklch(0.55 0.12 45)`              | Eyebrows + planters. **Never encodes a yes/no** — that is what keeps "green means yes" intact.                              |
| `ochre`        | —                                        | `oklch(0.52 0.11 75)`              | Consumables only.                                                                                                           |
| `brand-soft`   | —                                        | `oklch(0.93 0.03 145)`             | **Bug fix.** See below.                                                                                                     |
| `h1`           | 2rem / 600 / `ui-serif`                  | 3.5rem / 400 / named stack         | `ui-serif` resolves differently per OS, so the site looked like a different brand per machine.                              |
| `h2`           | —                                        | 2rem / 400 / named stack           | Token existed but **no selector consumed it** — every section heading fell back to the browser's bold sans.                 |

---

## 5. Two real bugs found while doing this

**`bg-brand-soft` did not exist.** `AddToCart.tsx`, `CartClient.tsx` and the PDP
all used `bg-brand-soft` for the _selected_ planter / size tier, but there was no
`--color-brand-soft` in `theme.css` — so the class compiled to nothing and the
selected pot had a border change with no ground. The planter ladder is our
primary AOV mechanic (+29% to +121%), and its one selection cue was invisible.
Now declared and exported.

**`text-foreground` did not exist.** `SiteFooter` used it on the legal entity
name, which is the r.4(2)(a) compliance string. Same failure: the class emitted
nothing and the entity name rendered in the same muted grey as the address around
it. Now `text-ink`.

Both are the exact failure mode in `AGENTS.md` — an undefined token is invisible to
typecheck, lint, tests and the build.

---

## 6. Not done, deliberately

- **Product photography.** Needs an upload field on `Species`/`Skus` and a decision
  on S3 vs local. Layout is built to absorb it without restructuring.
- **Care content pages.** Bloomscape has 117 guides + 175 symptom-first pages. This
  is the highest-value SEO and retention asset in the category and it is the
  cheapest thing on the roadmap, but it is content, not UI.
- **Cart page / policies / grievance** restyled. Only the homepage and the token
  system changed; those pages inherit the new palette but keep their old layout.
- **Mobile-specific layout.** The grid collapses at `md`/`lg` breakpoints and is
  untested on a real device.
