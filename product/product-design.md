# Product Design — all five surfaces

**Date:** 4 October 2026
**Companion:** `plant-platform-architecture.html` (4 interactive views)
**Derived from:** `research/business-model.md`, `research/concept.md`, `research/founder-documents-checklist.md`

---

## 0. The two screens that decide the business

Everything else in this document is plumbing. Two things decide whether this product wins or becomes Urvann with better branding:

1. **The delivery confirmation screen (rider app)** — whether it auto-completes or demands proof.
2. **The claim intake screen (customer)** — whether it's 24 hours and human, or 7 days and a form.

Urvann's publicly-filed 3PL agreement pays riders ₹65 per order regardless of distance and penalises fake delivery marking at ₹100. Under that structure, lying is the cheapest action available. **Their penalty clause is a symptom of broken incentives, not a fix.** We never create the need for it.

---

## 1. The scaling primitive: `city_id` on everything

You asked for easy onboarding of new cities and pincodes. The answer is one structural decision applied relentlessly.

### The model

```
GLOBAL                          PER-CITY                        PER-ZONE
─────────────────────────       ──────────────────────         ──────────────
species catalogue        →      nursery_stock               →   pincode_zone
care content (symptom-          price_book                     distance_band
  first pages)                  city_config (licence, tax)     rider_pool
planter library                fulfilment capacity            batch windows
```

**Species and care content are written once and reused everywhere.** Per-city we hold stock, prices, licence status, capacity and the serviceable pincode set. Per-zone we hold the distance band that feeds rider pay, customer ETA, and delivery fee — one source of truth for all three.

### What a new city actually costs

| Artefact                                                            | Who creates it      | Deploy?               |
| ------------------------------------------------------------------- | ------------------- | --------------------- |
| `city` row (state, licence no., GSTIN, tax regime, capacity)        | HQ admin            | No                    |
| `nursery_stock` rows (SKU, qty, batch, cost, seasonal availability) | Nursery ops console | No                    |
| `price_book` (MRP, planter ladder, free-shipping threshold)         | HQ admin            | No                    |
| `pincode_zone` rows (CSV import: pin → zone → band → serviceable)   | HQ admin            | No                    |
| `rider_pool` + shift templates                                      | HQ admin            | No                    |
| **Total**                                                           |                     | **Zero code changes** |

### The two hard gates before city 1

These are modelled as **blocking steps in the onboarding pipeline**, because they can each invalidate the city:

1. **State nursery licence** — mandatory in Telangana (Act 2010), Haryana (Act 2025), West Bengal (Act XXXI 2001) and Uttarakhand (Fruit Nurseries Act). _This makes city selection a legal decision, not just a density decision._
2. **Interstate plant-movement clearance** — **unresolved across all nine research files.** The PQ Order 2003 governs import under the Destructive Insects & Pests Act 1914; domestic movement appears to be state territory. No uniform requirement was verified and no small-retail exemption was found. **Get this in writing from the State Horticulture Directorate and PPQS before shipping anything.**

### The scaling trap

**Cities are not fungible.** Climate band, licence regime and density all differ. March–June at 40–46°C is lethal in most of India, but _what survives_ differs by city. So:

> Global species catalogue × **per-city seasonal availability matrix** × per-city price book

A per-city assortment decision, never a global feature flag. Bangalore's summer catalogue is not Delhi's.

---

## 2. Customer surface (web + app)

### 2.1 Home — the quiz is the hook, not the banner

The single highest-converting element inherited from Bloomscape, adapted to India.

The research is explicit about the adaptation: **do not ask "how bright is your window?"** Most urban Indian buyers have zero natural light in a rented flat, so that question false-negatives most of the market. Ask instead:

- Which room is it for? (bedroom / kitchen / desk / balcony / living room)
- Does the AC run in that room?
- Rented or owned?
- Which direction does the window face?

Then return **three plants, not thirty.**

### 2.2 Plant-finder quiz — why it converts (carried from research)

1. It collapses choice paralysis across a large catalogue into a bounded answer.
2. It pre-empts _"I will kill this."_ Completing the quiz is a small identity commitment, so the recommendation feels self-authored — which is what makes a ₹900 price payable.
3. It produces a **structured first-party care profile** (light, skill, pets, kids, travel) that drives post-purchase care, merchandising, and _suppressing plants the customer cannot keep alive_.

### 2.3 Catalogue — the planter ladder is the primary mechanic

Measured uplift on the same SKU at two variants: **+29% to +121%**, largest at the small end. Ugaoo does ₹199 → ₹1,099 for an identical plant.

**Design rules:**

- Planter/colour is a **1-D variant axis** on an item already decided — no added choice paralysis.
- Always include the **honest entry option** (Ugaoo's GroPot at ₹199; Bloomscape's Money Tree nursery pot at no premium). Removing the "am I being upsold?" objection keeps the premium default intact.
- Show the **uplift as a value, never as a discount.** The MRP is a merchandising fiction and every Indian site uses a struck-through price; we don't.

### 2.4 PDP — the compliance-critical screen

Legal Metrology PC Rules 2011 r.6(1), extended to listings by the **2017 Amendment r.6(10)**, requires these on the listing itself (only month-and-year-of-packing is exempt online):

- Manufacturer/packer name and address · Country of origin · Common name · Net quantity / number of units · Best-before where it can become unfit · **MRP inclusive of all taxes** · **Dimensions where size is relevant**

**Dimensions on a plant PDP = height × pot diameter × spread, declared.** And the associated finding:

> **Publishing a height-range spec actively increases return rate when the grower misses the band**, because it converts a shortfall into a provable breach. Bloomscape's loudest review is a parlor palm _"laughably small for the container it was in."_

So: **every PDP ships a photo of the actual plant against a ruler**, and the declared dimension is measured from that photo, not from a batch record.

Also on the PDP:

- **Care card** — light, water interval, soil-moisture target %, toxicity, difficulty
- **Grow-pot dispatch note** — you decorate on arrival; explain why, so it reads as a feature
- **Care profile match** — if the quiz was completed, show "fits your profile: low light, pet-safe"
- **Guarantee badge showing the ACTIVE window only** (T0 = 48h at launch) — never show a window we have not earned; see `use-cases.md` §11
- **Unboxing video requirement stated here, at point of sale** — not buried in T&Cs

### 2.5 Cart & checkout

- Free delivery, no minimum order (Urvann's ₹99/₹199 floor is the published market floor; parcel competitors must charge ₹60–150 we don't)
- **Prepaid only.** No COD affordance anywhere in the flow. The absence is the model, so it must be invisible rather than apologised for.
- Care-profile confirmation as a checkout step — one click, doubles as claim-eligibility record

### 2.6 Post-delivery — the care & guarantee surface

The guarantee is a differentiator, so the post-delivery UI is a first-class surface, not a policy page. **The window shown is configuration-driven (see `use-cases.md` §11): T0 = 48 hours at launch, T1 = 30 days once a DOA rate is measured, T2 = 90 days only if the data supports it.** We do not display a number we cannot price.

| When   | What the customer sees                                                   |
| ------ | ------------------------------------------------------------------------ |
| Day 0  | Delivery confirmed. **Unboxing video requested in-app and on WhatsApp.** |
| Day 3  | Care check-in ("how's the soil moisture?") — photo prompt                |
| Day 7  | Light check. Offer a swap if it's clearly wrong for their room           |
| Day 21 | Diagnose-on-demand entry point                                           |
| Day 45 | **Refill offer** — the 70–80% margin attach point                        |
| Day 90 | Guarantee window closes, stated honestly                                 |

### 2.7 Claims — 24–48 hours, human, replacement-only

Competitor policy comparison, from research:

| Player                 | Window                         | Remedy                          | Evidence                           |
| ---------------------- | ------------------------------ | ------------------------------- | ---------------------------------- |
| Ugaoo                  | 3 days transit / 30 days plant | Replacement, at sole discretion | Photos, registration within 5 days |
| Paudhewale             | 24 hours                       | Refund-first, **no return**     | Mandatory uncut unboxing video     |
| Urvann                 | —                              | **Wallet credit only**          | —                                  |
| **Us (T0, at launch)** | **48h arrival**                | **Replacement, never refund**   | Unboxing video + close-up + wide   |

**Design:** a claim is started from the order page, guided through photo capture in-app, and lands in a human queue. **No public Google Form** (Kyari's approach). No "sole discretion" — a published adjudication gate with a reason code, which is both fairer and generates the feedback signal.

**Replacement is genuinely cheaper than a refund here:** the marginal cost is a plant already grown and otherwise discarded, shipped in a grow pot with a repot guide — turning a loss into a second interaction. Bloomscape's trick.

**And settle in money where money is owed.** Urvann's wallet-credit default suppressed complaints until the review score cratered. We keep the signal.

---

## 3. Nursery owner / ops surface (tablet console)

Designed for someone working with wet hands, not at a desk. Large targets, high contrast, one-handed.

### 3.1 Today — the morning view

- Orders due to pack today, **sorted by wave**
- Stock low / out alerts
- **Today's weather + season advisory** (critical — the March–June window)
- Yesterday's DOA rate and claim count, because that's the number that matters

### 3.2 Batch & stock

| Object                | Fields                                                                             |
| --------------------- | ---------------------------------------------------------------------------------- |
| **Species** (global)  | name, care profile, light/water/toxicity, difficulty, seasonal availability matrix |
| **SKU** (per nursery) | species + size tier (XS/MD/LG/XL), batch, qty, unit cost, pot binding              |
| **Batch**             | source/nursery, traceability bill ID, date in, expected ready date                 |

**"Never list a species you can't trace to a bill"** is enforced structurally: a SKU cannot be published without a traceable batch ID. That rule is a compliance requirement (CITES / protected species), so it belongs in the data model rather than in a checklist.

### 3.3 The packing bench — where the evidence is captured

This is the highest-leverage screen in the whole ops product, because it's where claim evidence and fraud prevention are won or lost.

- Large order queue, one item per card
- **Mandatory bench photo against the order ID before "packed"** — not optional, not skippable
- Checklist per plant: soil moisture target met, pot secured, grow pot only, no decorative pot inside
- **Care card printed/attached** — physical, because the digital one won't be read
- One tap → next item

### 3.4 Season & climate console

Because the lethal window is real and per-city:

- **Summer (Mar–Jun, 40–46°C):** hardy SKUs only, morning dispatch slots, fragile tier suspended, water-only refills
- **Monsoon (Jul–Sep):** fungal-rot risk protocol, sealed-but-vented tubs, drainage-first care content
- **Perennial (Oct–Feb):** full catalogue, peak gifting, corporate renewal push

---

## 4. Delivery / rider surface (PWA, offline-capable)

The most important surface in the product.

### 4.1 Shift view

- Today's assigned batch: ordered route, ~8–12 drops in one 12 km zone
- **Per-drop pay shown upfront** — Band A 0–3km ₹45 · Band B 3–7km ₹60 · Band C 7–12km ₹75
- Live map of remaining drops
- Offline queue — syncs when signal returns

### 4.2 The delivery confirmation screen — the anti-fraud core

**No auto-complete on proximity. Ever.**

| Element                                               | Purpose                                                  |
| ----------------------------------------------------- | -------------------------------------------------------- |
| Explicit **"Handed to recipient"** tap                | Can't be triggered by closing the app or arriving at GPS |
| Customer **OTP entry** (customer shows, rider enters) | Proves two-party contact                                 |
| **Delivery photo** against order ID                   | Evidence for the customer and for us                     |
| **GPS ping at drop coordinates**                      | Proves location at handover                              |
| Plant-condition quick check (3 states)                | Feeds the DOA model — **the number nobody publishes**    |

**Why this exact design:** Urvann's contract penalises fake delivery marking at ₹100 _because their pay structure makes it rational_. They can audit, they just can't remove the incentive. **We remove the incentive, and this screen is the audit trail we keep anyway.**

### 4.3 Route and earnings

- Shift summary: drops completed, km, earnings, bonus
- **Batch-fill feedback:** "3 more drops on this wave would have added ₹135" — because rider behaviour determines our margin, and we want them earning more by batching
- Weekly earnings, UPI settlement status

### 4.4 What the rider app must never do

- Auto-complete delivery on proximity or timeout
- Hide distance banding behind an internal formula
- Route by "nearest rider" (optimises rider convenience, breaks batching, destroys margin)

---

## 5. Support surface (WhatsApp-first console)

The competitive wedge. Urvann 2.1/5, Kyari 1.4/78, and nobody answering is the single most-documented failure in this category.

**Primary channel is WhatsApp Business, not a help centre.** Our own research put WhatsApp open rates at ~90%+, and photos land where the conversation is.

### 5.1 Console layout

- **Unified inbox** — WhatsApp, web chat, phone, email, marketplace DM
- **Queues:** care questions · delivery status · damage claims · corporate · spam
- **SLA clock visible per conversation** — target first response **<15 minutes**
- **Customer context panel** — care profile, quiz answers, order history, guarantee status, DOA history

### 5.2 Care diagnosis — the real product

Rooted ran a 24/7 SMS diagnosis line and had to degrade it to weekday hours email. **A human call is a material fraction of order value at a ₹300 plant.** So:

- Weekday-hours staffed, WhatsApp-native
- **Symptom-first knowledge base** — this is the durable asset. Bloomscape's app died; its 117 guides + 175 symptom-first pages survived and compounded. Build the content, not the app.
- Suggested responses from the care engine, human-approved — never auto-sent

### 5.3 Claim triage

- Inbox item auto-linked to the order and guarantee window
- Video/photo evidence attached inline
- **Adjudication gate with reason codes** — replacements only
- **Escalation path to the window decision**, visible to the customer

---

## 6. HQ admin surface (cross-city)

### 6.1 City control — the on/off switch

| City      | Status         | Contribution/order | Riders | Fill rate | DOA  | Licence              |
| --------- | -------------- | ------------------ | ------ | --------- | ---- | -------------------- |
| Bengaluru | 🟢 live        | ₹240               | 14     | 78%       | 4.1% | ✓                    |
| Hyderabad | 🟡 soft launch | —                  | 4      | —         | —    | ⏳ filed             |
| Delhi     | ⚪ pending     | —                  | —      | —         | —    | ❌ block: interstate |

**Licence status is a gate, not a note.** A city can't go green without a licence row.

### 6.2 Cross-city rollups

- Revenue and **contribution margin per city** (the number that decides expansion)
- AOV, refund rate, guarantee claim rate per city
- **Density index** — orders per km² per day, the leading indicator of break-even
- Comparative nursery productivity (₹ revenue per acre, per month)

### 6.3 Catalogue governance

- **Species** global, edited once
- **Seasonal availability matrix** — per city × species, because climate bands differ
- Planter library and ladder pricing rules
- **Legal Metrology declaration completeness audit** — a listing missing required fields can't go live

### 6.4 Compliance console

- Grievance officer register, Consumer Protection (E-Commerce) Rules 2020
- **DPDP consent log** (substantial provisions effective 13 May 2027 — architect now)
- Legal Metrology audit trail: declaration text + version per listing
- Guarantee terms versioning — a snapshot of what the customer agreed to at purchase, per order

### 6.5 Pincode & zone management

- CSV import: pincode → zone → distance band → serviceable yes/no
- **Serviceable pincode count and orders/pincode** as the density dashboard
- Bulk enable/disable ahead of season or capacity crunch

---

## 7. Data model — the core entities

```
GLOBAL                          CITY-SCOPED
─────────────────────          ──────────────────────────────
species                         city (licence, tax, capacity)
care_symptom_page               nursery
planter                         sku (species × size_tier)
                                nursery_stock (batch, qty, cost)
ZONE-SCOPED                     price_book (mrp, ladder, free-ship thr)
─────────────────────          city_config
zone                            rider_pool
pincode_zone                    city_pnl

ORDER-SCOPED                    PROOF-SCOPED
─────────────────────          ──────────────────────────────
order                           bench_photo (order_id, item)
order_item (sku, planter)       delivery_proof (otp, photo, gps)
subscription (refill)           claim (evidence, reason_code)
guarantee (start, expiry)       consent_log (DPDP)
```

**Three invariants to enforce in the schema, not the application:**

1. `sku` cannot publish without a traceable `batch` → the "never list what you can't trace" rule
2. `order` cannot exist for a `pincode` outside `pincode_zone.serviceable` → stops over-promising
3. `delivery_proof` requires all four fields before `order.status = DELIVERED` → no auto-complete, structurally

---

## 8. Build order

| Phase | Surface                                  | Why this order                                                                             |
| ----- | ---------------------------------------- | ------------------------------------------------------------------------------------------ |
| **0** | Pincode + zone + city config, HQ admin   | **The scaling primitive.** Every later feature depends on geo. Cheapest to get right first |
| **1** | Customer catalogue, PDP, cart, checkout  | Revenue path. PDP carries Legal Metrology from day one                                     |
| **2** | Nursery ops + packing bench              | Order fulfilment, and proof capture starts here                                            |
| **3** | Rider app + delivery proof               | **Do not ship phase 2 without phase 3.** Manual delivery works, manual proof doesn't scale |
| **4** | Support console + care engine            | The differentiator, but it needs real order volume to be worth staffing                    |
| **5** | Guarantee claim engine + DPDP compliance | Needs claim history to tune adjudication                                                   |
| **6** | Refill subscription                      | The margin engine. Phase 2+ — before this, plants alone must clear variable cost           |

**Phase 3 is not optional and not parallel.** A packing bench that captures proof with no delivery screen to consume it just accumulates unusable photos.

---

## 9. What we deliberately do not build

| Not building                          | Why                                                                                                                                                                                            |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Care app**                          | Vera was acquired by Bloomscape with $24M raised, was free end-to-end, monetised nothing, got delisted. **The container died, the content compounded.** Build symptom-first content + WhatsApp |
| **Plant subscription**                | Four mature operators, zero working subscriptions. Bloomscape exited with $24M raised; Urvann disabled the module. **Refill** subscription instead — no mortality risk                         |
| **COD anywhere**                      | The omission is the model. A COD return is 25–30 days forward-inverted and the plant is non-saleable — a total write-off                                                                       |
| **Multi-city from day one**           | Density takes 12–18 months per zip code and Urvann's nine failed launches prove the shortcut doesn't exist                                                                                     |
| **Custom tech / proprietary routing** | Urvann uses off-the-shelf SaaS. **No tech moat exists in this category** — don't spend on one                                                                                                  |
| **A reviews platform**                | Marketplace-native + Google + Instagram. Trustpilot barely reaches India. **The care engine is the moat, not the review stack**                                                                |
| **Auto-complete anywhere**            | The fraud vector, in code                                                                                                                                                                      |

---

_Product design derived from nine research files in `../research/`. Legal items marked ⚠️ require confirmation with a CA, State Horticulture Directorate, or PPQS in writing. Architecture diagram: `plant-platform-architecture.html`._
