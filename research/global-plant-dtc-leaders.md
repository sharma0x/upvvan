# Global Plant D2C Leaders — Bloomscape, The Sill, Rooted & the Subscription Model

**Research date:** 4 October 2026
**Method:** live page fetches (HTML scrape + Shopify `.js`/`.json` product and collection endpoints + WordPress REST API), help-centre article reads, and third-party sources (Trustpilot, Reddit, trade press, subscription-benchmark vendors).
**Accuracy rule:** every factual claim carries its URL. Anything I could not confirm on a live page is marked **UNVERIFIED**. Prices are snapshots as of 4 Oct 2026; these brands discount heavily and change prices often.

**Read this first — two headline findings:**

1. **Monster Plant could not be verified as a live plant retailer.** `monsterplant.com` resolves to parked infrastructure and its most recent Wayback capture redirects to a `/lander` page. See §1.4. Do not plan against it.
2. **No brand in this set publishes subscription revenue, subscriber counts, SKU counts, or retention rates.** Every financial figure below is either a third-party estimate (with wildly conflicting values) or absent. Section §11 lists what is genuinely unknown.

---

## 1. Who these brands are

### 1.1 Bloomscape — the greenhouse-to-door premium leader

| Item        | Detail                                                                                                                               | Source                                              |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| Founded     | 2017 (corporate entity 2018), Detroit, MI                                                                                            | https://www.zoominfo.com/c/bloomscape-inc/450257825 |
| HQ          | 5000 Grand River Ave, Detroit, MI 48208                                                                                              | https://bloomscape.com/terms/                       |
| Founder     | **Justin Mast**, five generations of greenhouse growers; family supplied young plants to US greenhouses                              | https://bloomscape.com/about/                       |
| Funding     | **$15M Series B Sept 2020** led by General Catalyst, bringing total to **~$24M**. Used partly to acquire the **Vera** plant-care app | https://www.zoominfo.com/c/bloomscape-inc/450257825 |
| Positioning | "the modern online garden center delivering the largest variety of quality houseplants directly from the greenhouse"                 | same                                                |
| Core claim  | Retail-channel plants spend ~4 weeks in uncontrolled warehouses; Bloomscape ships in **3–4 days**                                    | https://bloomscape.com/about/                       |

**Revenue — treat as unreliable.** Third-party estimates span a 30× range and should not be used for modelling:

| Estimate                                 | Source                                                                | Confidence                                 |
| ---------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------ |
| $6.5M online sales 2024, down 20–50% YoY | Accio/Gripsintelligence via https://www.accio.com/business/bloomscape | Low (likely a panel estimate, not filings) |
| $39.6M                                   | ZoomInfo                                                              | Low                                        |
| $40.0M                                   | Kona Equity                                                           | Low                                        |
| $180M, 41.5% gross margin                | ReportPrime                                                           | Very low — contradicts all others          |

Trailing-month figures from the same Accio source (Nov 2025): revenue **$291,547**, AOV **$200–225**, conversion **0.5–1.0%**, sessions **148,329**, **53% mobile / 47% desktop**. The sub-1% conversion rate is characteristic of high-AOV considered purchases and is the most useful number in that dataset.

### 1.2 The Sill — the pot-centric, design-led brand that has already pivoted

| Item            | Detail                                                                                                                                                                      | Source                                                                                      |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Founded         | 2012 by **Eliza Blank**; started with $5,000 savings + $12,000 Kickstarter                                                                                                  | https://daniel.guetta.com/files/cases/the_sill.pdf                                          |
| Funding         | $2.5M seed 2017 (Brand Foundry Ventures); **$5M Series A 2018**; total ~$7.7M; last round Jan 2024 equity crowdfunding via Wefunder raising >$1.7M                          | same                                                                                        |
| Retail          | 12 stores across 7 US markets (2014–2022); **last store closed 30 Sept 2024** → 100% e-commerce                                                                             | same                                                                                        |
| Strategic pivot | ~2024: added outdoor plants, trees, shrubs. Targets 50/50 indoor/outdoor                                                                                                    | https://fortune.com/2025/07/02/the-sill-houseplants-millennials-outdoors-gardening-new-ceo/ |
| Scale           | "eight-figures-in-revenue brand"; founder is "done" raising institutional capital                                                                                           | Fortune link above                                                                          |
| Offices/B2B     | Did the **BuzzFeed** office; _"We do a lot of offices — more offices than apartment deliveries."_ Office plant-care business crossed **$1M revenue** in its first few years | https://www.parachutehome.com/blog/the-sill-new-york, Guetta case                           |

**Revenue — contradictory.** PrivCo lists $380MM (2024), $250MM (2023), $90MM (2022) at exactly 50% gross margin — a suspiciously round series. LeadIQ estimates **$25M–$50M**. Fortune says "eight figures." **UNVERIFIED; do not use.** The $380MM figure is almost certainly wrong and would badly distort any benchmarking.

### 1.3 Rooted / Hey Rooted — the lowest-price, most faceted, originally B2B-led brand

**Rooted is now trading as Hey Rooted at heyrooted.com.** Note: `rooted.co.in` is an _unrelated_ Indian company of the same name — do not conflate them.

| Item                 | Detail                                                                                                                                                                  | Source                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Founded              | 2018, Brooklyn NY, by **Ryan Lee, Kay Kim, Johnny Wu**                                                                                                                  | https://www.honestbrandreviews.com/reviews/rooted-review/                              |
| Origin               | "Plant parties" in a Brooklyn apartment, hand-delivering plants                                                                                                         | https://www.heyrooted.com/pages/our-story                                              |
| Early model          | **$75,000/month revenue on a team of 11, of which 85% was offline** — one Williamsburg store plus plant installations/rentals for **Facebook, BuzzFeed, Chobani, Nike** | https://www.thepitch.show/74-stop-killing-your-plants                                  |
| Strategy at the time | Target 70–80% of sales offline long-term; raised **$2M** specifically to grow online; planned Bay Area + LA expansion. Stated **LTV ≈ $150 over 3 years**               | same                                                                                   |
| COVID pivot          | Shut all offline channels permanently; launched an **SMS line for 24/7 plant diagnosis** — customers text photos any hour, staff reply with diagnosis + treatment       | https://blog.fiverr.com/post/olivia-claparols-of-rooted-direct-to-consumer-houseplants |
| Today                | 100% online; plants grown at **own greenhouse in Central Florida**; all retail closed                                                                                   | https://www.heyrooted.com/pages/our-story                                              |

**The Rooted model is the most instructive failure-to-scale in this set:** it had a real B2B business, brand, and content engine, and still chose to abandon the profitable offline revenue to chase e-commerce scale — then relaunched years later under a new name with a much cheaper catalog (median product price **$29**).

### 1.4 Monster Plant — NOT VERIFIED; appears dead or never existed

This is a negative finding and it is well-evidenced:

- `monsterplant.com` and `www.monsterplant.com` both resolve to **76.223.54.146 / 13.248.169.48** — AWS/Global Accelerator parking infrastructure.
- Direct `curl` of the homepage and `/pages/how-it-works` returned **HTTP 000** (connection failure) on every attempt.
- `web_extract` returned `CRAWL_EMPTY_CONTENT` / `Unprocessable entity` on every path.
- The most recent Wayback capture (**12 Jul 2025**) contains a single script: `window.location.href="/lander"` — a parked-domain/for-sale pattern. The 2024-08-09 capture returned an empty body.
- Web search for the brand surfaces only: the _Habbo Hotel_ virtual pet "Monster Plant", a _Care Bears_ wiki page, a Japanese mobile game, and an Instagram-based rare-plant seller "MonsterPlants Hungary" that Reddit users repeatedly flag as a suspected scam.

**Conclusion:** there is no verifiable "Monster Plant" plant D2C retailer at that domain. It is excluded from all analysis below. **UNVERIFIED whether the brief intended a different brand.**

---

## 2. Plant finder / quiz onboarding — and why it converts

### 2.1 Bloomscape: the 1-minute plant quiz

- URL: **https://bloomscape.com/plant-quiz/**
- Meta description, verbatim: _"Tired of killing all your plants? Take our 1-minute plant quiz to find a houseplant that even you can keep alive."_
- Homepage hero, verbatim: _"Find your perfect plant / **What kind of plant parent are you?** Tell us about your space and we'll match you with plants that will thrive."_
- Homepage facet tiles: **Low Light** ("Thrives in shady spots"), **Pet-Friendly** ("Safe for furry friends"), **Statement Plants** ("Bold and dramatic"), **Easy Care** ("Hard to kill").

The quiz is delivered via **Typeform** (confirmed by the `_tp_id`/`_tp_s_*` cookie family on bloomscape.com), so question text is not in server HTML — it could not be extracted. Rooted's quiz questions are documented second-hand: _"It'll lead you through questions about your home, the type of light you've got going on, your growing skills, and if you travel often"_ — https://www.honestbrandreviews.com/reviews/rooted-review/. Rooted's homepage in 2020 also hosted a pop-up questionnaire/messenger using Typeform, per the Snowplow cookie note.

### 2.2 Why this converts — the mechanism

The quiz is not a gimmick; it solves three measurable problems in this category:

1. **Choice paralysis.** A mature catalog has 150+ plants (Rooted) to 250+ SKUs (The Sill). Choice paralysis is the dominant killer of plant-catalog conversion, because a visitor cannot evaluate "will _this_ plant survive in _my_ room." The quiz converts an unbounded decision ("which plant?") into a bounded one ("three plants that fit your stated constraints").
2. **Purchase-commitment risk.** The dominant buyer objection is _"I will kill this."_ Bloomscape's quiz copy attacks exactly this objection in the headline. Someone who completes a quiz has already made a small identity commitment ("I am a low-light, pet-safe person"), so the resulting recommendation feels self-authored rather than sold — dramatically lowering the psychological cost of paying $79–$199.
3. **First-party data.** Quiz answers are a structured care-profile (light level, skill, pets, children, travel frequency). That profile is the single most valuable asset for (a) post-purchase care emails, (b) B2B "plant stylist" consultations, (c) merchandise reporting, and (d) suppressing plants the customer cannot keep alive, which directly cuts return/refund cost. Rooted's founder explicitly described using phone GPS **aperture + location** to estimate a buyer's actual light exposure and filter the catalog accordingly — https://www.thepitch.show/74-stop-killing-your-plants. That is the endgame of the quiz.

**Transfer note:** for India the light-level question should be reframed as **room orientation + AC/artificial-light reality**, not lux. Indian urban buyers are far more likely to have zero natural light in a rented flat, and far more likely to be in a rented flat at all.

---

## 3. Size / spec framing

Both Bloomscape and The Sill use an identical three-axis spec frame: **height range in inches + a pot diameter + a maturity band.** This is the industry's most reusable merchandising idea.

### 3.1 Bloomscape size ladder

Codes observed live on PDPs: **XS, MD, LG, XL**, each carrying an explicit height range _including the pot_:

| Code | Height (incl. pot)           | Example                                        | Price     | Pot                              |
| ---- | ---------------------------- | ---------------------------------------------- | --------- | -------------------------------- |
| XS   | assorted 1–5"                | Air Plants (3/5/7/12-packs)                    | $15–$46   | none                             |
| MD   | 15"–20" (also stated 15–24") | Bromeliad Silver Vase, Tradescantia Nanouk     | $79       | 8" ⌀ × 7", saucer 6.5"           |
| LG   | 17"–24" / 20–26"             | Stromanthe Triostar, Philodendron Hope Selloum | $99       | 9.8" ⌀ × 8.6", saucer 7.1"/10.5" |
| XL   | 32"–46"                      | Money Tree                                     | $169–$199 | 11.8" ⌀ × 10.25", saucer 10.5"   |

Sources: https://bloomscape.com/product/bromeliad-silver-vase/, `/product/tradescantia-nanouk-md/`, `/product/stromanthe-triostar/`, `/product/philodendron-hope-selloum-1/`, `/product/air-plants/`, `/product/money-tree/`

### 3.2 The Sill size ladder

Small / Medium / Large / Massive, with a **published sizing guide that maps planter → grow pot**, which is the key piece that makes planter upsell work — https://www.thesill.com/products/zz-plant (verbatim):

> Small — Approximately 5" in diameter, fits plants in 4" grow pot or smaller
> Medium — Approximately 7" in diameter, fits plants in 6" grow pot or smaller
> Large — Approximately 10–12" in diameter, fits plants in 10" grow pot or smaller
> Massive — Approximately 12–14" in diameter, fits plants in 12" grow pot or smaller

Per-SKU size options carry height: Small `4.75"` grow pot / 9–12"; Medium `6"` / 20–26"; Large `9.25"` / 2–3 ft.

### 3.3 Hey Rooted

Simplest of the three: `size_1-small` tags plus a **single** Mystery Plant subscription variant ("Small / Standard", 4" pot, $29). Prices ladder by size: small spider plant $20, medium $30, large barrel cactus $160 in a 12" pot.

### 3.4 The maturity framing nobody advertises but everybody uses

"Ship a **mature, fully-grown, living-room-ready** plant" is the core Bloomscape claim, repeated on every page — _"our fully-grown and potted indoor plants"_, _"You're paying for a healthy plant to be selected for you, potted in quality soil and a stylish pot, and delivered safely"_. Rooted's PDPs make the same point: _"Our cacti aren't cuttings — they're fully rooted plants!"_ (The Sill) and Rooted's _"Each plant is unique; size and shape fluctuate by season so all measurements are shown as a range."_

**The insight:** the buyer is not buying a plant, they are buying _time_. A ₹250 nursery sapling that takes 2 years to look good and a ₹900 delivered 18-inch plant that looks finished today are the same object. Every brand prices the delivered-maturity, not the seedling.

---

## 4. Plant + potter bundling: why the pot is the upsell

### 4.1 The mechanism

The pot is the highest-margin, lowest-return-friction line on the whole P&L, and every brand knows it:

- **The Sill** makes the planter a mandatory variant axis on _every_ plant PDP: `Size → Planter → Color`. Planter styles: Isabella (6.25"), Grant (7"), Hyde (7.5"), Pallas (12"), Mexia (13"), plus naked "Grow Pot (6"/9.25")". Colours: Bubblegum, White Sesame, Midnight, Mustard, Black, Rust, White, Blush, Lavender, Sage, Cream — plus split-finish options (Top Half Mustard, Antique Teal, Almond, Dusty Rose). The subscription ships **plant + ceramic planter** as a single unit; the planter is _inside_ the price.
- **Bloomscape** splits the variant into pot _type_ × pot _colour_: EcoPot vs **Self-Watering** vs **Nursery Pot**, in Charcoal / Clay / Stone / Slate / Indigo. The Money Tree PDP offers **Nursery Pot at no premium** — an explicit opt-out, which is smart: it removes the "am I being upsold" objection while keeping the premium default.
- **Hey Rooted** sells planters standalone as their own product type (18 Planter SKUs): Ceramic Cylinder $23.40–$30.60 by colour, Classic Planter $30, Beech Wood Stand $55/$75/$100.

### 4.2 Four reasons the pot is _the_ upsell

1. **It is the only part of the bundle with near-zero mortality.** The plant might die and cost you a replacement. The ceramic will not. A customer who is 80% sure about the plant is 100% sure about the pot they keep when the plant dies — which is precisely why The Sill lets you **switch planter colour month to month on the subscription** without changing plant preference.
2. **It multiplies AOV without adding choice paralysis.** It's a 1-D axis (colour × 3 sizes) on an item the customer already decided to buy. Bloomscape's ~$200 AOV and The Sill's $99 median are both substantially a function of this axis.
3. **It solves a real problem the plant creates.** The nursery grow pot has drainage but is ugly; the decorative pot looks good but has no drainage. Both brands resolve this explicitly rather than pretending it away — The Sill's FAQ: _"the decorative planter serves as a saucer, catching excess water that drains out"_; for no-drainage planters they add _"a generous layer of lava rocks before the potting mix, to aid in proper water management."_ Bloomscape: EcoPot is 80% recycled plastic with a matched saucer.
4. **It is where brand expression lives.** Nobody gets attached to a grow pot. Nine to eighteen pot colours is a genuinely repeatable reason to return to the same brand and to buy a second plant.

### 4.3 The pot is a subscription retention lever, not just a one-time upsell

This is the most important and least obvious mechanic in the whole category, and it is worth being precise about, because the intuition is usually backwards.

**The intuition everyone starts with:** "the planter raises my average order value, so I should push planters harder."

**What the live policies actually show:** the planter is the lever that makes a _subscription_ viable, because it is the only element of the recurring shipment the subscriber can change their mind about without cancelling.

The Sill's help centre is unambiguous about what is and is not negotiable on a subscription (verbatim, https://help.thesill.com/en-US/articles/monthly-subscriptions-93651):

> "Subscriptions are a 3 or 6 plant delivery commitment. **At this time, you cannot skip a month or cancel your subscription.**"

> "Can I modify or swap my subscription? **No. At this time, we do not support modifying subscriptions, like changing your planter from one color to another or your subscription box type.**"

> "Do subscriptions come potted? **No. Plants ship in their grow pot, placed inside the ceramic planter.**"

> "Subscription costs include your plant, ceramic planter, and shipping. Our pet-friendly option is $2-3 more per month because non-toxic plant varieties are not as commonly grown and therefore harder to source."

Read that as a system. The subscriber's _plant_ is curator-chosen and locked. The subscriber's _planter colour_ is also locked once subscribed. The commitment is 3 or 6 months. What the subscriber actually owns, month to month, is a **collectible ceramic object that arrives on their doorstep on a predictable cadence** — and ceramic does not die, wilt, or need skipping.

So the planter is doing three jobs at once on the subscription:

1. **It is the physical subscription artefact.** The thing that shows up monthly is not a plant that might be dead; it is a pot that is definitionally fine, in a colour the customer chose. This makes a recurring shipment emotionally low-risk.
2. **It absorbs the "I want something different" impulse.** A subscriber who is bored can be nudged toward a new brand by a colour, not by a plant they cannot cancel.
3. **It is what makes the mystery-plant model sellable at $69.** Because the plant is a surprise, the customer needs _something_ they selected. The planter is the only selection on offer.

**Correction to what I wrote in §4.2.** I stated that The Sill lets subscribers "switch planter colour month to month on the subscription." That is **no longer true** — the current help-centre article explicitly says the opposite ("we do not support modifying subscriptions, like changing your planter from one color to another"). The colour-select-at-checkout model is real; month-to-month colour switching is not. This is a live-policy change or a legacy FAQ paragraph I picked up elsewhere; either way, **the current published policy is: no skip, no cancel, no swap.** Treat §4.2 point 1's second clause as retracted and use this section instead.

**Why this should worry anyone copying the model.** A subscription with no skip and no cancel is a **prepayment contract**, not a recurring purchase. It works only because (a) the AOV is high enough that $69–$207 feels like a gift commitment rather than a loan, (b) the brand is trusted enough that the customer accepts losing control, and (c) the physical artefact keeps arriving so the subscription feels like value delivered, not a charge. Review aggregators pick up exactly the friction this creates: "The three-month minimum commitment frustrates single-month triers" (https://whichsubscriptionbox.com/boxes/plants), and BBB reportedly shows an A (not A+) with 9 complaints around customer-service response times (https://bestboxpicks.com/box/the-sill). Third-party price trackers also disagree on the entry price — ZDNet has it at "$55 monthly for low-maintenance plants, $58 for pet-friendly" (https://www.zdnet.com/article/best-plant-subscription/) while the live storefront shows $69 (https://www.thesill.com/products/plant-of-the-month-club) — **the $55/$58 figures are UNVERIFIED against the current storefront.**

### 4.4 What India should copy from the bundling layer

| Mechanic                                            | Why it transfers                                                                                                                                                | Adaptation needed                                                                                                                                                |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Planter as a paid variant axis, not a free swap** | A ceramic/cachepot is the highest-margin, lowest-return-risk line; it survives the plant                                                                        | Ship in a plastic nursery pot + a separate colour-coded sleeve or nursery-pot sleeve in local colours. Do not ship heavy ceramic by default at the ₹ price point |
| **Sell the planter standalone**                     | Hey Rooted sells 17 planter SKUs, median $30 (https://www.heyrooted.com/collections/all-plants) — planters become their own revenue line, not just an accessory | This is the single easiest mechanic to copy; no shipping-damage risk, no mortality, high repeat                                                                  |
| **Publish a planter→grow-pot fit map**              | The Sill's Small/Medium/Large/Massive → grow-pot mapping is what makes upsell self-explanatory and kills "will it fit?" anxiety                                 | Use pot diameter in inches AND cm; Indian marketplaces sort by cm, so keep both                                                                                  |
| **Free nursery pot as explicit opt-out**            | Bloomscape lets the Money Tree ship as Nursery Pot at no premium, which defuses "am I being upsold?" while keeping the premium default                          | Make the ₹0 grow-pot visible on the PDP, not hidden                                                                                                              |
| **Bundle "pot + care kit" at a small premium**      | Rooted's Complete Plant Care Bundle is $53.85 vs a $17.95 plant food alone (https://www.heyrooted.com/products/mystery-plant) — attach rate, not discounting    | A ₹199-299 care kit (mister + fertilizer + moisture meter) is a natural AOV lift where a ₹49 plant alone will not clear courier economics                        |
| **Do NOT copy: no-skip / no-cancel**                | Indian consumers are far more likely to dispute an auto-debit-style commitment, and UPI mandates/chargeback behaviour differs from US card norms                | Ship a monthly plan that can be paused in one tap. Retention comes from the plant, not from trapping the customer                                                |

---

## 5. Care content depth — the per-plant data model

Care content is the least glamorous and most competitive part of this business. All three brands have invested in a structured per-plant record, not prose blog posts. This section documents the actual schema, extracted live.

### 5.1 Bloomscape's per-plant data model (the most complete I found)

Bloomscape runs a custom WordPress post type called `plant_species`, and its care record is a **7-field repeatable ACF group**. Field names and example content verified live via the REST API at https://bloomscape.com/wp-json/wp/v2/plant_species?slug=monstera:

| Field (verbatim ACF key)                                                  | Heading shown to user | What it contains (Monstera example, verbatim)                                                                                                                                                                                                |
| ------------------------------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plant_species_plant_care_details` → `plant_care_detail_heading: "LIGHT"` | LIGHT                 | "Your Monstera can grow just about anywhere in your home! It tolerates low light, but grows faster and becomes more dramatic in a spot with indirect bright light. That said, avoid strong, direct sunlight because it may burn the leaves." |
| …`"WATER"`                                                                | WATER                 | "Water your Monstera when the top **50–75% of the soil** is dry. Water until liquid flows through the drainage hole at the bottom of the pot and discard any water that has accumulated in the saucer."                                      |
| …`"HUMIDITY"`                                                             | HUMIDITY              | "…if you want to give it a special treat, gently mist it once a week… It's best to mist your Monstera in the morning so the water has plenty of time to evaporate before evening."                                                           |
| …`"TEMPERATURE"`                                                          | TEMPERATURE           | "Normal room temperatures between **60–80 degrees**… It will not tolerate temperatures under 55 degrees or sudden drops in temperature. Avoid cold drafts and direct airflow from heaters in the winter months."                             |
| …`"FOOD"`                                                                 | FOOD                  | "feed your plant once a month throughout the spring and summer… No fertilizer is necessary during the winter"                                                                                                                                |
| …`"TOXICITY"`                                                             | TOXICITY              | "Monstera leaves are **mildly toxic to pets and humans**. Typically, ingestion will cause mouth and stomach irritation and possible vomiting."                                                                                               |
| …`"ADDITIONAL CARE"`                                                      | ADDITIONAL CARE       | Leaf dusting, moss-pole staking, trimming guidance                                                                                                                                                                                           |

Plus a separate `plant_species_descriptions` group (About / Fun Fact / Pictured-Left captions) and a `plant_species_botanical_classification` field ("Monstera deliciosa").

**Three things to steal from this schema specifically:**

1. **Water is expressed as a soil-moisture percentage, not a calendar.** "Top 50–75% of the soil is dry" is a _testable, transferable_ instruction. "Water weekly" is neither. This is the single highest-value field in the whole model, because it is the one a confused beginner can actually execute.
2. **Toxicity is a first-class structured field, not a disclaimer.** It is what makes the pet-friendly filter trustworthy, and it is what allows The Sill to charge a **$2–3/month premium** for non-toxic picks with a stated reason (harder to source) rather than a vague "safer" claim.
3. **Every care paragraph cross-links to a purchasable accessory.** The LIGHT text links to a Grow Light; the HUMIDITY text links to a Mister; the FOOD text links to fertiliser; the ADDITIONAL CARE text links to Microfiber Dusting Gloves (https://bloomscape.com/plant-care-guide/monstera/). **Care content is an accessory-merchandising surface, not an SEO asset.** That is a much better business model than writing guides for traffic.

There is also a distinct `plant_guide` post type: **117 plant care guides** live at https://bloomscape.com/plant_guide-sitemap.xml (including the hub https://bloomscape.com/plant-care-guides/), and a `common_issue` post type with **175 symptom-first pages** at https://bloomscape.com/common_issue-sitemap.xml — e.g. `/common-issue/why-are-the-leaves-on-my-monstera-turning-yellow/`, `/common-issue/why-are-the-blades-on-my-sansevieria-curling/`, `/common-issue/why-is-my-cactus-shriveling-up-and-wrinkling/`.

**The symptom-first content strategy is the single most under-appreciated tactic here.** A page titled _"Why are the leaves on my ZZ plant turning brown on the tips?"_ is written for the exact moment a customer is frightened and needs reassurance. It ranks for high-intent problem queries, it intercepts the customer _before_ they write a complaint, and it is infinitely cheaper to produce than species guides. Note the taxonomy: `common_issue` entries are cross-linked from the relevant species page — each guide page lists its "Common Issues for your [plant]".

### 5.2 Per-plant care pages elsewhere

- **The Sill** maintains a **Care Library** as a named product/nav destination (https://www.thesill.com/pages/care-library), plus `plant-care-articles`, `common-plant-care-questions` and a `plant-care` landing page (all in the pages sitemap, https://www.thesill.com/sitemap_pages_1.xml). The Sill's FAQ explicitly promises lookup-by-name: _"Plant Care Library: Simply look up the name of your plant for easy-to-follow care instructions. Gift recipients receive instructions on how to care for their plants in their package, too."_ (https://www.thesill.com/pages/faq)
- **The Sill also ships a printed/vinyl care card**, referenced repeatedly: gift orders "include directions on how to access our digital Care Library", and the Bloomscape/rooted equivalents reference an "included care card". Rooted: _"Every plant comes with educational care guidance written by our in-house plant experts"_ (https://www.heyrooted.com/pages/our-story). A physical card is a low-tech retention asset: it keeps the brand present after the box is gone, at near-zero marginal cost.
- **Hey Rooted** encodes care as a **shoppable facet**, not just a guide. Their "Easy Care" collection is filtered by a product metafield: `filter.p.m.custom.watering_schedule=gid://shopify/Metaobject/73724330166` — i.e. a structured _watering schedule_ value attached to each product, which drives a collection. Alongside Pet Friendly, Low Light and Air Purifying collections (https://www.heyrooted.com/collections/pet-safe-plants, `/collections/low-light-houseplants`, `/collections/air-purifying-plants`). **This is the right way to do it:** care attributes as metafields that both filter the catalog and generate the guide.
- Rooted also now ships a companion app, "Rooted: Garden Companion", with camera ID and photo diagnosis (https://apps.apple.com/us/app/rooted-garden-companion/id6761402824) — note this is a _different, newer_ product line from the historic Rooted discussed in §1.3.

### 5.3 Vera, the app Bloomscape acquired — and its fate

Bloomscape acquired the **Vera** plant-care app as part of its ~$24M Series B (§1.1). What Vera did, per Bloomscape's own pages (https://bloomscape.com/vera/):

- **Care schedules:** "Easily set up watering reminders and fertilizing follow-ups for every plant."
- **Plant profiles:** "create profiles for each leafy friend, with their name, adoption date, and photos you take… Log your plant care activities over time."
- **Content library:** "The Library has all the plant care tips and tricks you'll ever need."
- **Expert layer:** "See care tips for each plant and read expert advice from Bloomscape's Grow-How® Team."
- **Activity feed:** "Log activities with your plant family, like the last time you repotted, your daily misting."
- Unlimited plants and photos (https://bloomscape.com/vera-faq/).

**The critical fact for planning: Vera is dead.** Bloomscape's own FAQ still says it is _"only available to users located in the United States"_ and _"as of November 2020"_ (https://bloomscape.com/vera-faq/), but the app has been delisted: not on the US App Store as of a 29 July 2026 search, removed from Google Play around February 2024, with Bloomscape reportedly telling users work is paused indefinitely (https://www.getgrowli.app/blog/plant-care-app). Bloomscape's website _still carries the promotional page with download links that lead nowhere_ (https://bloomscape.com/vera/).

**Read this as a business lesson, not a technology lesson.** Vera was **free end-to-end, with no in-app purchase and no subscription** — it was funded purely as a marketing channel for plant sales (https://www.getgrowli.app/blog/plant-care-app). A free app that carries no revenue and whose only measurable value is attributed elsewhere (to plant sales) is exactly the kind of asset that gets deprioritised in a downturn. It was acquired with funding raised in 2020 and quietly dropped by 2024.

**The correct conclusion is not "don't build an app." It is: build care tooling that is either monetised or is measured in retained revenue, and never let it be a free-standing acquisition whose ROI can't be attributed.** Note also that Bloomscape's _web_ care infrastructure survived and improved (117 guides + 175 symptom pages), while the _app_ died — the durable asset was the content, not the container.

### 5.4 Email/push care reminders vs. human diagnosis

Three different answers to the same problem, and they are not equally good:

| Brand      | Mechanism                                                                                                                                    | Cost                                 | Source                                                                                                                                                                                                                                        |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bloomscape | Owned app (Vera, **now dead**) + Klaviyo email flows; cookie table on bloomscape.com lists `klavyio` tracking and `_kla_id` 13-month cookies | Low, but now dormant on the app side | https://bloomscape.com/ (cookie table); https://bloomscape.com/vera/                                                                                                                                                                          |
| The Sill   | "Grow-How®"-style expert content + email; gift recipients get Care Library access by email. Klaviyo not observed on the Sill site            | Low                                  | https://www.thesill.com/pages/faq                                                                                                                                                                                                             |
| Rooted     | **24/7 SMS diagnosis line — humans**                                                                                                         | Highest                              | https://blog.fiverr.com/post/olivia-claparols-of-rooted-direct-to-consumer-houseplants; still offered as "a friendly support team that's always happy to look at a photo and talk you through it" (https://www.heyrooted.com/pages/our-story) |

Rooted's SMS line is the most interesting mechanic and it is now **misremembered as a feature that was dropped**. The historic version (2020) let a customer text a photo at any hour and get a human diagnosis plus treatment plan. What survives today is email-with-photos plus a weekday-hours support team — the Rooted FAQ is candid about the degradation: _"We're real humans with plants of our own to take care of, so sometimes customer inquiries will take a little longer to receive a response. We aim to always respond within one business day, but are active on weekdays from 10AM to 6PM EST"_ (https://www.heyrooted.com/pages/faqs).

**The trade-off is structural, not a matter of effort.** A 24/7 human SMS line is a genuinely great retention mechanic, but it is a linear cost against a small, high-mortality product. At $29 median product price (see §10), a single human diagnosis call is a material fraction of order value. It works only at scale with heavy triage volume — which is exactly why it was attractive to Rooted at 85%-offline volume and hard to sustain at smaller DTC scale.

**For India the right answer is neither.** Use WhatsApp bot + a small in-house human escalation window (e.g. 10am–7pm IST, when your customers are awake and your plant people are staffed), and route only "I think this one is dead" to a human. That preserves the trust benefit of the Rooted mechanic at a cost closer to The Sill's.

### 5.5 Care-as-marketing, summarised

Care content in this category is not a cost centre. It is simultaneously:

1. **The objection-remover** that lets a $149 plant convert (the buyer's fear is "I will kill this", §2.2).
2. **A paid-media landing surface** — every symptom page is a high-intent query.
3. **An accessory storefront** (§5.1 point 3).
4. **The filter layer for personalization** — light level, toxicity and watering schedule are the fields the quiz (§2) and the collection facets (§5.2) both run on.
5. **The reason the brand survives the delivery.** A brand that answers "why is my plant dying?" for free after the sale has converted a complaint into retention.

---

## 6. Subscription mechanics — the actual published terms

### 6.1 Side-by-side

|                      | **The Sill** — Plant of the Month Club                                                                                                    | **Hey Rooted** — Mystery Plant                                                                                    | **Bloomscape**                      |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Product              | https://www.thesill.com/products/plant-of-the-month-club                                                                                  | https://www.heyrooted.com/products/mystery-plant                                                                  | **Not currently offered** — see 6.5 |
| Price                | **$69/mo** across all 26 live variants (Classic and Pet Friendly both $69)                                                                | **$29/mo** Small (4" pot); gift terms $87/3mo, $174/6mo; one-time $29                                             | —                                   |
| Cadence              | _"subscriptions will recur every 30 days until 3 or 6 shipments in total have been made"_                                                 | _"charged right away for the first month, and subsequent charges will occur every 30th day"_                      | —                                   |
| Term                 | **3 or 6 shipments. No single month.**                                                                                                    | Cancel _"anytime after two shipments"_                                                                            | —                                   |
| Skip                 | **No.** _"At this time, you cannot skip a month or cancel your subscription."_                                                            | **Yes.** _"You may skip a month anytime."_                                                                        | —                                   |
| Cancel               | **No** (per the article)                                                                                                                  | After 2 shipments                                                                                                 | —                                   |
| Swap / modify        | **No.** _"we do not support modifying subscriptions, like changing your planter from one color to another or your subscription box type"_ | Rescheduling only for remaining plants; first plant ships immediately                                             | —                                   |
| Plant choice         | Curated by Sill ("curating new easy-care and non-toxic p[lants]")                                                                         | True mystery — _"Plant varieties change monthly, and all plants are grown in advance by Amelia, our lead grower"_ | —                                   |
| Pot included         | Yes — _"plant, ceramic planter, and shipping"_                                                                                            | No pot; ships in 4" nursery pot                                                                                   | —                                   |
| Potted?              | **No.** _"Plants ship in their grow pot, placed inside the ceramic planter"_                                                              | Yes, 4" pot                                                                                                       | —                                   |
| Pet-friendly variant | **Yes, +$2–3/mo** — _"non-toxic plant varieties are not as commonly grown and therefore harder to source"_                                | **Yes**, at the same $29 (_"Pet-friendly: Non-toxic picks only"_)                                                 | —                                   |
| Discounts            | **No** — _"Discounts cannot be applied to subscriptions unless otherwise stated"_                                                         | **No** — _"Discounts are not applicable for this product"_                                                        | —                                   |
| Giftable             | Yes, 3- or 6-month, recipient address at checkout                                                                                         | Yes, 3mo $87 / 6mo $174                                                                                           | —                                   |

Sources: https://help.thesill.com/en-US/articles/monthly-subscriptions-93651 (The Sill, all quotes); https://www.thesill.com/products/plant-of-the-month-club and https://www.thesill.com/pages/faq; https://www.heyrooted.com/products/mystery-plant and https://www.heyrooted.com/pages/subscriptions (Hey Rooted).

### 6.2 Two completely opposite retention philosophies

This is the sharpest strategic contrast in the dataset, and both brands are rational.

**The Sill: maximise revenue per subscriber, sacrifice control.** Locked term, no skip, no cancel, no swap, no discount. $69 × 6 = $414 of prepaid, non-cancellable revenue. The planter is included and _unexchangeable_, so the monthly artefact is a collectible rather than a variable. The pet-friendly surcharge is itemised and explained rather than hidden.

**Hey Rooted: maximise subscriber goodwill and lifetime length, sacrifice contractual lock-in.** $29/mo, skip any month, cancel after two shipments, gift terms at a straight 10% discount ($87 for 3, $174 for 6), and a pet-friendly option **at no extra cost**. Also ships _free every month_ on the subscription. The Mystery Plant is explicitly positioned as a fun surprise, not a curated benefit, and it names the grower.

**Rooted's is the better business for a price-sensitive, high-uncertainty category.** A customer who kills the first plant has a natural reason to skip rather than cancel. The Sill's design assumes the customer always wants another plant — which is true for someone who just got their first planter and false for someone whose third plant died.

### 6.3 The planter swap mechanic, restated precisely

Because §4.2's version of this was wrong (§4.3), here is the accurate current picture:

- **At checkout:** planter _style_ and _colour_ are freely selectable on the Plant of the Month Club. 26 live variants = 2 box types (Classic / Pet Friendly) × 3 planters (Isabella 6.25", Grant 7", Hyde 7.5") × colourways, all at $69.
- **After checkout:** immutable. No colour change, no box-type change.
- **Rooted's equivalent:** there isn't one — Rooted's subscription has no planter at all, only a size (Small 4" / Medium 6") and a type (Standard / Pet-friendly).

### 6.4 Public commentary on retention and churn

No brand in this set publishes retention, churn, MRR, LTV or subscriber counts. What exists is third-party and mostly unhelpful:

- **The Sill's BBB:** reportedly **A (not A+)** with **9 complaints**, "primarily around customer service response times", per https://bestboxpicks.com/box/the-sill. **UNVERIFIED against BBB directly.**
- **Subscription-box review aggregators:** "✗ Widely seen as pricey for the plant size you get", "✗ The three-month minimum commitment frustrates single-month triers", https://whichsubscriptionbox.com/boxes/plants (retrieval 4 Oct 2026).
- **Price-point disagreement across trackers:** ZDNet says "$55 monthly for low-maintenance plants, $58 for pet-friendly varieties, and escalate to $88 per month for orchids" (https://www.zdnet.com/article/best-plant-subscription/); WhichSubscriptionBox says "from **$55/mo**" (https://whichsubscriptionbox.com/boxes/plants); the live storefront says **$69**. A third-party reviewer reports "$55.00/month" (https://bestboxpicks.com/box/the-sill). **The $55 and $58 figures are UNVERIFIED and contradicted by the current live price of $69.** Treat them as historical.
- **Reddit sentiment** on plant subscriptions is mostly about price-vs-plant-size and impulse: https://www.reddit.com/r/plants/comments/esw8ik/
- **Rooted's stated LTV:** ~$150 over 3 years, from a founder interview in 2020 (https://www.thepitch.show/74-stop-killing-your-plants) — historic, pre-shutdown, and **UNVERIFIED today**.

### 6.5 Bloomscape has apparently exited the subscription business

This is a negative finding worth flagging plainly, because plan against it:

- A `Best Sellers Subscription` PDP was indexed by search engines at `https://bloomscape.com/product/best-sellers-subscription/` with a price shown as **$500** (Google snippet via web search, 4 Oct 2026).
- **That URL now returns a Bloomscape 404** — live fetch renders _"Oops! Looks like we can't find that page."_
- Bloomscape's **`product-sitemap.xml` contains 186 product URLs and not one containing "subscription", "club", "monthly" or "mystery"**.
- The WooCommerce Store API returns **zero** results for `?search=subscription`.
- Bloomscape's homepage contains no subscription merchandising; nav has no Subscriptions link.
- Bloomscape's own customer-service sitemap exposes **no subscription or cancellation-policy article** (https://support.bloomscape.com/ lists Orders, Shipping, Payments, Gifts, Returns, Plants, Care Products, Guarantee, Winter + Packaging, Plant Care).

**Conclusion: UNVERIFIED-but-well-evidenced — Bloomscape's consumer subscription appears to be discontinued as of Oct 2026.** A third-party list still prices it at "From $35" (https://hellosubscription.com/subscriptions/plant-subscriptions/), which I could not reproduce and is likely stale or misattributed.

**The strategic reading is consistent with §1 and §5.** Bloomscape's money is now in one-off premium sales at a $200 AOV (§1.1), corporate/trade programs (https://bloomscape.com/trade-program/, https://bloomscape.com/corporate/), and self-watering pots as a product line (https://bloomscape.com/self-watering-pots/). It has killed the Vera app (§5.3) and, on this evidence, the subscription. **A brand that had the best subscription _content_ in the group ended up dropping the subscription.** Do not model Bloomscape as a subscription business.

---

## 7. Guarantees and damage claims

### 7.1 Verbatim guarantee wording

| Brand      | Wording                                                                                                                                                                                            | Window                                                    | Source                                                                                                                                        |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Bloomscape | _"We guarantee that every plant will arrive in good health, and all plants are guaranteed for **30 days after arrival**."_                                                                         | 30 days plants; **14 days** for care products/accessories | https://support.bloomscape.com/the-bloomscape-guarantee                                                                                       |
| The Sill   | "30-Day Happiness Guarantee" / "30-Day Customer Happiness Guarantee"; _"applies to all online and in-store purchases within the first 30 days"_                                                    | 30 days                                                   | https://www.thesill.com/pages/faq; https://help.thesill.com/en-US/flows/01HFAJKR6Q8QC3Q3D5ZTB3R33V                                            |
| Hey Rooted | "**30 Day Happiness Guarantee**" / "30 Day Risk-Free Guarantee"; _"every order is backed by our 30 Day Happiness Guarantee. If your plant arrives damaged or isn't thriving, we'll make it right"_ | 30 days                                                   | https://www.heyrooted.com/pages/shipping-returns; https://www.heyrooted.com/pages/our-story; https://www.heyrooted.com/products/mystery-plant |

All three converge on **30 days**. That is a category-standard, and it is meaningfully longer than a general e-commerce return window — it is a _survival_ warranty, not a change-of-mind window.

### 7.2 How photos are handled — the universal rule

All three require photographic proof, and all three specify what makes a photo usable:

- **Bloomscape:** _"please capture a few photos of your damaged item. Then, contact Customer Success via our support form with your order number and photos of the damaged item… **Photos are required as proof of damage** in order for us to help with your replacement. Please note that **the replacement will only be for the damaged portion of your order**."_ (https://support.bloomscape.com/the-bloomscape-guarantee)
- **The Sill** is more specific about photo framing — _"To expedite your request, please send photos of the damage, including **one close-up pic and one at a distance**. The guarantee applies to all online and in-store purchases within the first 30 days. We require photos as proof of damage and to help us improve our packaging process. Otherwise, we cannot offer returns or exchanges at this time."_ (https://www.thesill.com/pages/faq; https://help.thesill.com/en-US/flows/01HFAJKR6Q8QC3Q3D5ZTB3R33V)
- **Hey Rooted:** _"Just send us a note within 30 days of receiving your order, along with pictures of the problem to hello@heyrooted.com, and we'll take care of you right away!"_ (https://www.heyrooted.com/pages/shipping-returns)

**The close-up + distance requirement is the best-practice mechanic here and should be copied verbatim.** A distance shot proves the item's overall condition and scale; a close-up proves the specific damage. Requiring both at intake kills the back-and-forth and pre-qualifies the claim. It also creates a structured artefact that feeds straight back into packaging QA — The Sill says so explicitly: photos "help us improve our packaging process."

### 7.3 Replacement vs. refund — the detail that matters

**Every brand resolves damage claims as a replacement, and every one of them restricts refunds.**

| Situation                | Bloomscape                                                                                                                                                | The Sill                                                                                                                                                                  | Hey Rooted                                                                                                                                                         |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Plant arrives damaged    | Replacement, **only the damaged portion of the order**                                                                                                    | Replacement or refund, coordinate by email (cold-damage case)                                                                                                             | Replacement; _"If we cannot send an exact replacement, we will work with you to get another similar plant"_                                                        |
| Plant arrives dead       | Free replacement, **arrives in a grower pot** — _"You can simply repot this plant into your original Ecopot, or another same-sized pot of your choosing"_ | Not separately stated                                                                                                                                                     | Covered                                                                                                                                                            |
| Pot / accessory damaged  | Replacement or store credit, **14 days**                                                                                                                  | —                                                                                                                                                                         | "we'll take care of you"                                                                                                                                           |
| Refund allowed at all    | _"We are unable to process refunds after 30 days"_                                                                                                        | Refund in the cold-damage case                                                                                                                                            | _"We don't accept returns on plants, accessories, supplies, or merchandise"_ — only damage claims                                                                  |
| Same variety unavailable | _"if a plant is out of stock we are not able to offer the same plant as a replacement"_                                                                   | —                                                                                                                                                                         | _"we will work with you to get another similar plant"_                                                                                                             |
| Winter/cold damage       | Covered under 30-day guarantee                                                                                                                            | _"If your plant arrives with signs of cold damage, you're covered under our 30-Day Guarantee. Email us photos right away, and we'll coordinate a replacement or refund."_ | **NOT covered** unless you paid for winter packaging: _"we do not offer refunds or replacements for cold damage if you do not add winter packaging to your order"_ |

Sources: Bloomscape https://support.bloomscape.com/the-bloomscape-guarantee and https://support.bloomscape.com/my-plant-or-pot-arrived-damaged-what-do-i-do; The Sill https://www.thesill.com/pages/faq; Rooted https://www.heyrooted.com/pages/shipping-returns and https://www.heyrooted.com/pages/faqs.

### 7.4 Four clauses worth studying

1. **The grower-pot replacement.** Bloomscape sends replacements in a _nursery pot_, not the customer's decorative pot, and then publishes a 7-step repotting guide (https://bloomscape.com/caring-for-your-replacement-plants/). This is elegant: it de-risks the replacement (no ceramic to break), and it turns a refund into a second plant-plus-accessory interaction. It also solves the inventory problem of matching a coloured pot.
2. **"Repotting within 30 days voids the guarantee — unless it is a replacement."** Bloomscape: _"Repotting your indoor plant into a new container within the first 30 days will void our 30-Day guarantee unless it is a replacement plant."_ This is a genuinely clever clause: it prevents the customer from killing a plant in its nursery pot and then blaming the grower, but it keeps the channel open for the plant Bloomscape itself sent in a grower pot.
3. **Weather holds.** All three will _delay_ rather than ship into lethal conditions: The Sill — _"If temperatures drop too low, we may hold your order until it's safe to ship. You'll receive an email update"_; Rooted — _"during periods of inclement weather, shipments may be delayed for the safety of your plant"_, plus custom winter packaging _"which includes thermal protection. Think of it as a blanket for your plant's cold journey"_; Bloomscape — a dedicated _"Winter + Packaging"_ support section and, per https://bloomscape.com/terms/, _"Plant orders are charged a non-refundable fee, plus tax, during the winter season."_ **A weather hold is a margin decision disguised as a customer-service one. Copy it without hesitation.**
4. **Rooted's paid winter packaging is the one place the guarantee is explicitly conditional on spend.** Cold damage is only covered if you bought the packaging add-on. This converts packaging from a cost into a product — and it is the correct model for anyone shipping in a punishing climate.

**No carrier-claims data is published by any of the three brands.** Claims data, damage rates and freight costs are treated as trade secrets or simply never discussed. See §11.

---

## 8. Reviews, UGC and community

### 8.1 Review volumes and ratings (retrieved 4 Oct 2026)

| Platform               | The Sill                                                                                                                                                   | Hey Rooted                                                                                                                                                       | Bloomscape                                                                                                                                               |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Trustpilot**         | **4.3 / 5** — 472 reviews (Google snippet also showed 460 on a JP locale and 452 on a third-party site)                                                    | **3.8 / 5** — 84 reviews                                                                                                                                         | **2.8 / 5** — 100 reviews                                                                                                                                |
| On-site product rating | Not exposed in machine-readable form on Shopify `products.json`                                                                                            | Not exposed                                                                                                                                                      | **4.5 / 5** on Money Tree Braid, `reviewCount: 64` in page source; all 118 products carry an `average_rating`/`review_count` field via the Woo Store API |
| BBB                    | **A (not A+)**, 9 complaints, mostly customer-service response times (via https://bestboxpicks.com/box/the-sill — **UNVERIFIED**, not checked against BBB) | —                                                                                                                                                                | —                                                                                                                                                        |
| Other                  | —                                                                                                                                                          | Thingtesting: **2.3**, 19 reviews, "21% of reviewers would recommend to a friend" (https://thingtesting.com/brands/rooted/reviews) — far harsher than Trustpilot | —                                                                                                                                                        |

Sources: https://www.trustpilot.com/review/thesill.com, https://www.trustpilot.com/review/heyrooted.com, https://www.trustpilot.com/review/bloomscape.com; https://bloomscape.com/product/money-tree-braid/ (page source, `ratingValue` 4.5 / `reviewCount` 64).

**The on-site vs. Trustpilot gap is the most useful signal here.** Bloomscape is **4.5/5 on-site with 64 reviews on a hero SKU, but 2.8/5 on Trustpilot.** Hey Rooted is 3.8 on Trustpilot but 2.3 on Thingtesting. The pattern: **Trustpilot disproportionately captures fulfilment and service failures, while on-site widgets (Yotpo on Bloomscape, per the `yotpo_pixel` cookie) capture post-delivery plant satisfaction.** Anyone evaluating these businesses — or planning their own review strategy — should read both, and should not treat a high on-site rating as evidence of a good operation.

### 8.2 What customers actually complain about (verbatim, Trustpilot)

These are more valuable than the ratings:

- **Size mismatch — the exact risk created by §3's spec framing.** Bloomscape, 1-star → 2-star: _"I ordered a parlor palm that came **laughably small for the container it was in**. The container was water logged and had nats… Bloomscape sent me a replacement, which was **still way smaller than advertised**. It was in a slightly smaller nursery pot, but one still far too big for the plant. **I honestly don't think they have plants in the sizes they're selling them.**"_ (https://www.trustpilot.com/review/bloomscape.com). This is the single most important negative datapoint in the whole report: **the height-range spec, if the grower doesn't hit it, actively increases returns**, because the spec makes a shortfall a provable breach.
- **Transit damage.** Hey Rooted, 1-star: _"one of the plants completely came out of the planter pot they put it in and is ruined… I then dig further and see that **I'm completely missing a plant**."_ Also Sill, 4-star: _"It was **chewed up looking with brown crispy edges, torn and shredded leaves**."_ (https://www.trustpilot.com/review/heyrooted.com, https://www.trustpilot.com/review/thesill.com)
- **Replacement friction — the policy works but the execution doesn't.** Rooted, 1-star: the customer accepted two damaged/missing plants and asked for a comped upgrade; _"They responded asking for pictures which I told them I already sent. I've sent numerous emails asking for help and even called their sister company."_ Note the customer had to email **repeatedly**. The guarantee is only as good as the median first-response time, and Rooted's own FAQ admits a one-business-day target with 10am–6pm weekday staffing (§5.4).
- **Split shipments on gifts.** Sill, 2-star: _"I was not happy to have my order **shipped in multiple packages and at different dates** as this was a gift. I won't be using this website again."_ (https://www.trustpilot.com/review/thesill.com)
- **The offsetting positive.** Bloomscape, 5-star: _"All plants arrived in perfect condition after being packaged with obvious care… customer service who **reached out on a holiday weekend** to make sure everything was remedied."_ Rooted's Trustpilot summary praises "support team… exceptionally helpful, responsive." (https://www.trustpilot.com/review/bloomscape.com, https://www.trustpilot.com/review/heyrooted.com)

**Service recovery is the visible differentiator in every 5-star review.** Not the plant. Not the pot. The person who answered.

### 8.3 Structured review fields and photo reviews

- **Bloomscape** runs **Yotpo** (confirmed by the `yotpo_pixel` cookie on bloomscape.com, duration "9 hours", description "Yotpo pixel is used to track conversions to optimize advertising performance") and exposes structured `average_rating` + `review_count` on **all 118 products** via the Woo Store API. Each product page carries JSON-LD with `ratingValue` and `reviewCount`. I did **not** verify whether photo reviews are enabled — **UNVERIFIED**.
- **The Sill** does **not** expose rating JSON-LD in its `products.json` or on the PDP HTML I fetched. Reviews surface as an on-page widget, but I could not determine the vendor or the schema — **UNVERIFIED**.
- **Hey Rooted** likewise exposes no rating markup I could read.
- Trustpilot's own **top-mention tags** are a free sentiment taxonomy, and they differ meaningfully by brand: The Sill — _"Delivery service, Order, Quality, Product, Customer service, Location, Customer communications, Recommendation, Service, Instructions"_; Hey Rooted — _"Order, Customer service, Customer communications, Delivery service, Solution, Quality, Refund, Price, Website, Value for money"_; Bloomscape — _"Order"_ only. (https://www.trustpilot.com/review/thesill.com, `/review/heyrooted.com`, `/review/bloomscape.com`)

Rooted's mention list is the most actionable: **"Solution" and "Refund" ranking as top-mentioned terms means resolution is a large share of the conversation** — consistent with a high-mortality product.

### 8.4 Social presence

| Channel              | Bloomscape                                                                                                                                                             | The Sill         | Hey Rooted       |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ---------------- |
| Instagram            | **133,000** — doubled during 2020, "growth appears organic not from purchased followers" (via https://www.accio.com/business/bloomscape — **UNVERIFIED**, third-party) | Linked in footer | Linked in footer |
| TikTok               | **9.7K+ followers**, "Official Shop" storefront live on TikTok Shop US (https://shop.tiktok.com/us/store/bloomscape/7495528381464545754)                               | Linked in footer | Linked in footer |
| X / Twitter          | @bloomscape, **5,652 followers** (https://x.com/bloomscape)                                                                                                            | @thesill         | —                |
| YouTube              | —                                                                                                                                                                      | Linked in footer | Linked in footer |
| Facebook / Pinterest | @TheSillNYC                                                                                                                                                            | Both             | Facebook         |

All three sites carry **Instagram, TikTok and YouTube** in footer links. Note the asymmetry: Bloomscape has a genuinely **TikTok Shop US storefront** (a commerce channel, not just marketing), which is a materially different commitment from having a TikTok account.

**Honest assessment:** no brand in this set has built a large owned community. Social is used as an acquisition and UGC surface, not as a retention channel. The Trustpilot top-mentions — full of _Delivery service_, _Quality_, _Refund_ — suggest most public conversation happens on **review platforms and Reddit, not on brand channels.** That is a lesson: in this category your reputation accrues where you don't control it.

---

## 9. B2B and services

### 9.1 What each brand actually offers

| Capability                             | Bloomscape                                                                                                                                                                                                  | The Sill                                                                                                                                                                                                              | Hey Rooted                                                                                                  |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Corporate gifting**                  | https://bloomscape.com/corporate-gifting/ — _"Premium, gift-ready plants for employee appreciation, client thank-yous, onboarding, and team milestones—**shipped to one office or hundreds of doorsteps**"_ | https://www.thesill.com/pages/corporate-gifting — _"whether you're sending gifts to **15 people or 500**, we provide flexible support and specialty pricing"_; bulk gift cards at **25+ units**                       | https://www.heyrooted.com/pages/corporate-gifting — routed via livelyroot.com for live-plant corporate gift |
| **Bulk thresholds**                    | —                                                                                                                                                                                                           | **15% discount over $10,000**; custom inserts min **50** units (custom Sill insert min **100**); customer sticker min **100**; own card min **50**, **$2/card**, card ≤ 4×6 in; gift cards 25+                        | _"If you are sending plants to 15+ different locations, click here and we'll help you set up a bulk order"_ |
| **Workshops / events**                 | Workshop pages exist (`/workshop-faq/`); workshops are consumer-facing                                                                                                                                      | **Complimentary Plant 101 workshops** for corporate gift recipients — _"so every recipient not only gets a beautiful plant, but also the know-how to help it thrive"_; https://www.thesill.com/pages/workshops-events | —                                                                                                           |
| **Virtual plant-stylist consultation** | `Grow-How® Team` / `Talk to Grow-How Team` (https://bloomscape.com/talk-to-grow-how-team/) — free support, not sold                                                                                         | **Virtual Plant Appointment — sold at $25 / 15min, $42 / 30min, $55 / 45min** (https://www.thesill.com/products/virtual-plant-appointment)                                                                            | Support team reviews photos                                                                                 |
| **Trade / interior-project program**   | https://bloomscape.com/trade-program/ — 11 products tagged "Trade Program"                                                                                                                                  | "Office" positioning historically (§1.2)                                                                                                                                                                              | Historic B2B now closed (§1.3)                                                                              |
| **Office / workplace plants**          | Collection "Plants for the Office" / `office-plants` (10 products); an "Office Plants" shop page                                                                                                            | Collection "Best Plants for Home & Corporate Offices"; historical office business crossed **$1M revenue**, _"more offices than apartment deliveries"_ (§1.2)                                                          | None                                                                                                        |
| **Shipping terms for B2B**             | Free standard shipping over **$150**; $10 flat-rate per address; 48 contiguous states                                                                                                                       | Free nationwide contiguous-US shipping on corporate orders                                                                                                                                                            | Contiguous 48 states only                                                                                   |

Sources as linked; Sill figures from https://www.thesill.com/pages/faq and https://www.thesill.com/blogs/ask-the-sill/why-corporate-gifting-with-plants-is-a-game-changer-and-how-we-make-it-easy; Rooted from https://www.heyrooted.com/pages/faqs; Bloomscape from https://support.bloomscape.com/shipping-costs-and-time.

### 9.2 The plant-stylist consultation is the underrated product

The Sill sells a **15/30/45-minute virtual plant appointment at $25/$42/$55** (https://www.thesill.com/products/virtual-plant-appointment). This deserves attention because it is the only explicitly _monetised human expertise_ in the entire dataset, and it sits in the same category as Rooted's free SMS line (§5.4) and Bloomscape's free Grow-How support.

The three points on that curve imply roughly a **$100/hour fully-loaded rate**, which is low for a specialist — meaning it is priced to be an easy impulse add-on to a plant purchase, not as a standalone consultancy. That is the smart part: it monetises the _care_ relationship that the free support line creates, at a moment when the customer is already motivated.

**Every mechanic in the human-support category, ranked by evidence of working:**

| Model                                     | Brand                  | Evidence                                                                 | Verdict                                           |
| ----------------------------------------- | ---------------------- | ------------------------------------------------------------------------ | ------------------------------------------------- |
| Paid video consultation                   | The Sill               | Live SKU, three price points                                             | Best commercial model                             |
| Human photo review (email, weekday hours) | Rooted                 | Trustpilot 3.8, top-mentions "Solution"/"Refund", support praised        | Works, but leaks time and frustrates at volume    |
| Human SMS, 24/7                           | Rooted (2020)          | Historic; degraded to email                                              | Excellent when you can staff it; did not scale    |
| Free expert chat                          | Bloomscape (Grow-How®) | 4.5 on-site rating, 2.8 Trustpilot; _"reached out on a holiday weekend"_ | Very good, and a strong differentiator in reviews |

### 9.3 Hotel and restaurant accounts, maintenance contracts

**Not publicly documented for any of the three current businesses, and I want to be explicit about that rather than implying coverage.**

- **Rooted's B2B history is the only substantive evidence in this dataset**, and it is well documented (§1.3): $75,000/month revenue with **85% offline**, one Williamsburg store plus **plant installations and rentals for Facebook, BuzzFeed, Chobani and Nike**, via https://www.thepitch.show/74-stop-killing-your-plants — and then permanently abandoned in the COVID pivot (https://blog.fiverr.com/post/olivia-claparols-of-rooted-direct-to-consumer-houseplants).
- **The Sill's office business** crossed **$1M revenue** in its first few years and did the BuzzFeed office (https://www.parachutehome.com/blog/the-sill-new-york, Guetta case). That is _plant service for offices_, which is adjacent to but not the same as hospitality maintenance contracts. **I found no current hotel or restaurant program page on thesill.com.**
- **Bloomscape** has a trade program and a corporate-gifting line but **no maintenance-contract or hospitality program page** in its 41-page sitemap or its support-site navigation (§6.5).
- The 2015-era trade press describes a separate startup (Bloom & Wild / the Observer piece, https://observer.com/2015/10/meet-the-startup-designing-breathtaking-office-plant-displays-for-tech-giants/) charging tech firms "as much as $100K each" for office plant displays — **that is a different company and not one of the three in this report; do not attribute it to The Sill.**

**Conclusion: recurrent maintenance contracts, hotel accounts and restaurant accounts are absent from all three brands' current public offerings. UNVERIFIED whether they exist privately under NDA.** This is a genuine white space, and the reason it is a white space is that a maintenance contract requires a physical presence in the service city — which is exactly what Rooted had and then deliberately gave up.

---

## 10. Pricing bands in USD — observed prices, not list psychology

**Method and caveat.** Every figure in this section was extracted from live structured endpoints on 4 Oct 2026, not from marketing copy:

- **The Sill** — Shopify `https://www.thesill.com/products.json` (915 products / **8,723 variants**; median entry price **$79**, p25 **$59**, p75 **$119**). 382 Indoor Plant SKUs, 451 Outdoor Plant SKUs, 20 Planter SKUs, 25 Accessories.
- **Bloomscape** — WooCommerce Store API `https://bloomscape.com/wp-json/wc/store/v1/products` (118 products priced in cents; median **$64.50**, p25 **$39.75**, p75 **$99**, min **$12**, max **$200**). Product sitemap lists 186 URLs. Prices returned in cents — divided by 100 below.
- **Hey Rooted** — Shopify `https://www.heyrooted.com/products.json` (250 products; **205 plant SKUs** across Plant/Arid/Tropical/Air/Edible/Herbal types; plant entry-price median **$29**, top-of-range median **$54**).

Entry price = cheapest variant (usually the plastic grow pot). Ceiling = dearest variant.

### 10.1 Plants by size band

| Band                   | Bloomscape                                                                                              | The Sill                                                                                                   | Hey Rooted                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **XS / smallest**      | **$15–$39** — Extra Small median **$39** (n=11, range $15–79); "Plants under $39" collection median $49 | **$39** entry — Small Money Tree grow pot $39; Small Olive Tree $39; Snake Plant Hahnii Small grow pot $39 | **$18** entry; Small median **$39** (n=639 variants, range $18–98)        |
| **Small**              | Small Indoor median **$49** (n=23, $39–149)                                                             | Small: $39 grow pot → **$79** potted (Money Tree, Olive Tree)                                              | Small **$39** median                                                      |
| **Medium**             | Medium Indoor median **$84** (n=28, $69–129)                                                            | Medium: **$69** grow pot → **$89** potted                                                                  | Medium **$54** median (n=692 variants, $30–132)                           |
| **Tabletop / mid**     | Tabletop median **$69** (n=32, $39–149)                                                                 | —                                                                                                          | —                                                                         |
| **Large**              | Large median **$99** (n=7)                                                                              | Large Money Tree $129 → **$249**; Large Olive Tree $99 → $219                                              | Large **$69** median (n=121, $32–95)                                      |
| **XL**                 | XL median **$149** (n=7, $139–169); "GIANT Plants" median **$149** (n=17, $99–199)                      | XL Money Tree $259 → **$379**; XL Olive Tree $229 → $349                                                   | Extra Large median **$138** (n=167); XXL median **$150** (n=25, $130–155) |
| **Trees**              | —                                                                                                       | Olive Tree 6–7ft (5G) **$299** grow pot only; Black Olive Tree XL **$299–419**                             | —                                                                         |
| **Entry-price median** | **$64.50**                                                                                              | **$79** (all) / **$84** (indoor only)                                                                      | **$29**                                                                   |
| **Observed max**       | **$200**                                                                                                | **$6,499** (a faux tree; real-plant ceiling ≈ **$419**)                                                    | **$155** (XXL)                                                            |

### 10.2 Planters, standalone

| Planter                                                                 | Price                                                                                                                                                                                                                                                                  |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sill** — Upcycled, Hyde, Grant, Round Two, Isabella, Westcott, Rancho | **$34–124** — Upcycled $34; Grant Small $40 / Medium $44; Westcott $42; Hyde Small $44 / Medium $59; Isabella 4" $49, 6" $59 (45 colour variants, $34–89); Round Two $38–124; Rancho $44–68                                                                            |
| **Sill** — mid tier                                                     | Modern Square $99; Balboa $99; Solid Goods w/ saucer $55–199; European Round $129–169; Helena $148; **Agnes $139–159** (with bamboo stand $159); **Mexia $159–249**; **Pallas $159–299**; Solid Goods w/ stand $219; **Revival w/ saucer $69–399** (8" $99 → 17" $399) |
| **Sill** — median standalone planter                                    | **$65.50** (n=20 SKUs)                                                                                                                                                                                                                                                 |
| **Bloomscape** — Ecopots (80% recycled plastic, per §4.1)               | Round Pot **6" $25**, **8" $35**, **10" $40**, **12" $45**; Saucer on wheels 13" $35. 5 Pot Color options: Charcoal (default), Clay, Stone, Slate, Indigo                                                                                                              |
| **Bloomscape** — repotting kits (kit + pot + tools)                     | 6" **$35**, 8" **$45**, 10" **$50**, 12" **$70**                                                                                                                                                                                                                       |
| **Hey Rooted** — 17 planter SKUs, median **$60**                        | Ceramic Cylinder **$23.40–$30.60** (Blue/White/Mustard/Pink/Sage/Burgundy/Black); Classic Planter **$30–119** (Rose Pink/Oat/Polar White/Charcoal); Fat Lip **$40–120**; Porcelain $33; Eco-friendly Stone $28                                                         |
| **Hey Rooted** — stands                                                 | Beech Wood Stand **Medium $55 / Large $75 / X-Large $100**                                                                                                                                                                                                             |

### 10.3 Accessories, care, and services

| Item                               | Brand             | Price                                                                                         |
| ---------------------------------- | ----------------- | --------------------------------------------------------------------------------------------- |
| Houseplant fertiliser              | Sill              | $19 (Transplant Boost/DIEHARD), $25 (Bloomscape 15-30-15), $17.95 (Rooted Instant Plant Food) |
| Complete care bundle               | Rooted            | **$53.85**                                                                                    |
| Moisture meter                     | Rooted            | from $6.00                                                                                    |
| GrowScripts House & Patio Care Kit | Sill              | $29                                                                                           |
| Self-watering plant globes         | Sill              | $20                                                                                           |
| Adjustable plant stand             | Sill / Bloomscape | $40 / $50                                                                                     |
| Plant Mom tote                     | Sill              | $15                                                                                           |
| **Virtual plant appointment**      | Sill              | **$25 (15min) / $42 (30min) / $55 (45min)**                                                   |
| Sill consumables median            | Sill              | $19 (n=7, $10–20)                                                                             |
| Sill accessory median              | Sill              | $20 (n=25, $8–350)                                                                            |

### 10.4 The planter premium, measured

This is the cleanest number in the report, because it comes from the same SKU at two variants:

**The Sill, Money Tree** (https://www.thesill.com/products/money-tree, 74 variants):

| Size                | Grow pot | Potted                                      | Premium  | Uplift            |
| ------------------- | -------- | ------------------------------------------- | -------- | ----------------- |
| Small (12"–16")     | $39      | $69 (Grant 5") / $79 (Isabella 4.5")        | +$30–40  | **+77% to +103%** |
| Medium (16"–19")    | $69      | $89 (Isabella 6.25")                        | +$20     | **+29%**          |
| Large (20"–26")     | $129     | $209 (Agnes + bamboo stand) / $249 (Pallas) | +$80–120 | **+62% to +93%**  |
| Extra Large (5'–6') | $259     | $379 (Mexia 13")                            | +$120    | **+46%**          |

**The Sill, Olive Tree** (93 variants): Small $39 → $79 (**+103%**); Medium $69 → $89 (+29%); Large $99 → $219 (**+121%**); XL (5'–6') $229 → $349 (+52%).

**The pattern:** the planter uplift is **+29% to +121%**, and it is **largest at the small end** where the absolute dollars are smallest. That is the opposite of where a plant business "should" concentrate, and it is why the planter is the AOV lever: **a $39 plant becomes a $79 order.** The uplift compresses at the top (46% on a $259 XL) because the plant's own biomass cost dominates.

**Strategic implication:** a plant business can roughly double revenue per unit without growing a single extra plant. That is the single most transferable economic fact in this report.

---

## 11. What is genuinely unknown

This section exists because planning against invented numbers is the main risk in this category. For each item: what is unknown, why no reliable public number exists, and what proxy (if any) is available.

| #   | Unknown                                                                       | Why no reliable number exists                                                                                                                                                                                                                                                                                                                     | Best available proxy                                                                                                                                                                                                                             |
| --- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Subscription revenue** (all three)                                          | Neither Bloomscape, The Sill nor Hey Rooted is a public company. The Sill raised via Wefunder equity crowdfunding (> $1.7M, Jan 2024) but has published no financials; Bloomscape's last disclosed round was the 2020 Series B. **Bloomscape's subscription appears discontinued entirely (§6.5), so its figure may be $0.**                      | PrivCo and LeadIQ estimates exist but conflict so badly they are unusable (§1.2)                                                                                                                                                                 |
| 2   | **Subscriber counts**                                                         | Never published. The Sill commits customers to 3- or 6-month blocks, so "subscribers" is not even a stable unit — it is shipments.                                                                                                                                                                                                                | Total catalog size as a weak scale proxy: The Sill 915 products / 8,723 variants                                                                                                                                                                 |
| 3   | **SKU counts** — no official figures exist, but **the platforms expose them** | Brands don't publish them; the storefront APIs do. This one is _solvable_ and I solved it.                                                                                                                                                                                                                                                        | **Measured, not estimated:** The Sill **915 products / 8,723 variants** (382 indoor + 451 outdoor plant SKUs); Rooted **250 products, 205 plant SKUs**; Bloomscape **118 priced products** in the Store API, **186** URLs in the product sitemap |
| 4   | **Retention / churn / repeat rate**                                           | Purely internal commerce data. No brand publishes it. Rooted's ~$150 LTV over 3 years is a **2020 founder statement**, pre-shutdown, and UNVERIFIED today (https://www.thepitch.show/74-stop-killing-your-plants).                                                                                                                                | Trustpilot "top mentions" and BBB complaint counts are directional only (§8.3)                                                                                                                                                                   |
| 5   | **Contribution margin / plant cost**                                          | A grower will not disclose what a plant costs to produce. This is the most valuable single number in the business and it is the most protected.                                                                                                                                                                                                   | None credible. Do not estimate from retail price.                                                                                                                                                                                                |
| 6   | **Damage / mortality rate in transit**                                        | Never published; treated as commercially sensitive. My searches surfaced only low-quality supplier-blog claims (e.g. "30–60% of shipped plants lost" at https://www.alibaba.com/product-insights/how-to-ship-plants-safely-expert-guide-for-90-survival-rate.html) which are **marketing content from a seller, not audited data — do not cite.** | Inferable from guarantee structure: all three offer only _replacement_, never refunds (§7.3), because a refund at $149 loses more than a replacement                                                                                             |
| 7   | **Carrier claims rate and freight cost per order**                            | Contractual and confidential. Bloomscape publishes its _customer-facing_ shipping tiers (§12.1) but not its negotiated carrier rate.                                                                                                                                                                                                              | Bloomscape's tiered list is the closest public proxy for real freight economics                                                                                                                                                                  |
| 8   | **Bloomscape's current revenue**                                              | Four third-party estimates spanning **$6.5M to $180M** — a 30× range (§1.1). At that spread, no modelling is possible.                                                                                                                                                                                                                            | Accio panel data: AOV $200–225, conversion 0.5–1.0%, sessions 148,329, 53% mobile — Nov 2025                                                                                                                                                     |
| 9   | **The Sill's current revenue**                                                | PrivCo says $380M (2024), $250M (2023), $90M (2022); LeadIQ says $25M–$50M; Fortune says "eight figures". **A $380M / 50%-gross-margin series that grows 4× in one year is almost certainly a data error. UNVERIFIED; do not use.**                                                                                                               | Catalog composition is the reliable signal: 451 outdoor vs 382 indoor SKUs (§10) corroborates the outdoor pivot (https://fortune.com/2025/07/02/the-sill-houseplants-millennials-outdoors-gardening-new-ceo/)                                    |
| 10  | **Whether Vera (app) had any users**                                          | Discontinued with no metrics published (https://www.getgrowli.app/blog/plant-care-app).                                                                                                                                                                                                                                                           | None                                                                                                                                                                                                                                             |
| 11  | **Hotel / restaurant / maintenance-contract revenue**                         | Not offered publicly by any of the three (§9.3). Rooted's historic B2B ($75k/mo, 85% offline) was abandoned.                                                                                                                                                                                                                                      | None                                                                                                                                                                                                                                             |
| 12  | **Headcount**                                                                 | Only The Sill has a public figure: **83 employees**, per https://builtin.com/company/sill. Bloomscape and Rooted unknown.                                                                                                                                                                                                                         | BuiltIn                                                                                                                                                                                                                                          |

**Two things I could resolve that are usually listed as "unknown":** SKU counts (§10, measured from the storefront APIs) and shipping price tiers (§12.1, published by Bloomscape and The Sill). Anything you plan against should start from these measured values rather than from trade-press estimates, which in this category are reliably wrong.

---

## 12. Packaging and reverse-logistics economics

### 12.1 Published shipping price tiers — the best public proxy for freight economics

**Bloomscape** (https://support.bloomscape.com/shipping-costs-and-time) — free standard shipping over **$150**:

| Item                                    | Base freight |
| --------------------------------------- | ------------ |
| Extra Small plants                      | **$3**       |
| Collections, Small, Medium, Rare Blooms | **$5**       |
| Large plants                            | **$10**      |
| X Large plants                          | **$15**      |
| XX Large plants                         | **$20**      |
| Tree size                               | **$50**      |
| Care items and tools                    | **$6–$9**    |
| Care bundles                            | **$5–$11**   |

Stated policy: _"Below is the freight base price. Your actual shipping cost will be dependent on zip code."_ Note the customer pays roughly **7–10% of a $49–$149 plant** at small/medium sizes, but the $50 tree tier against a $299 olive tree is ~17% — freight scales super-linearly with volume, which is the core courier problem in this category.

**The Sill** (https://www.thesill.com/pages/faq): **"$10 flat rate shipping per individual mailing address for all standard orders"**, plus optional **$5 cold-weather packaging**.

**Hey Rooted** (https://www.heyrooted.com/pages/shipping-returns): **$8 flat**, free over **$95** — but the FAQ states _"Shipping cost varies based on distance traveled and total cart size, starting at $4"_ (https://www.heyrooted.com/pages/faqs). **These two pages conflict ($8 flat vs. from $4); the $8 flat figure on the shipping-returns page is the more specific and current-looking statement. Both are cited; treat Rooted's shipping as UNRESOLVED between $4 and $8.** Rooted also excludes XL plants and orchids from the free-shipping threshold: _"FREE SHIPPING ON ORDERS $95+ … Excludes Extra Large (XL) plants & Orchids."_

### 12.2 What they actually pack plants in

| Brand      | Packaging approach                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Source                                           |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Bloomscape | _"Our unique packaging technology — made mostly from recycled and/or biodegradable materials — holds your plant securely in place so it arrives safely and without the mess"_ (https://bloomscape.com/shop/). Heat packs and biodegradable shipper liners seasonally. Dedicated _"Winter + Packaging"_ support section, incl. _"What do I do with the heat packs in my order"_ and _"Are your packing materials recyclable?"_ (https://support.bloomscape.com/)                        | verbatim                                         |
| The Sill   | **Ships in the nursery grow pot, never pre-potted** — _"Our plants ship in their nursery grow pot to allow for a safe and comfy ride… helps reduce the risk of stress and shock that could happen if they were to be potted in a new planter before leaving the greenhouse."_ Grow pot _"securely nestled inside"_ the ceramic planter — **except** _"For large plants and planters, including faux plants, the planter will ship separately from the large plant due to its weight."_ | https://www.thesill.com/pages/faq                |
| Hey Rooted | _"We hand-pick, clean, and package your plant"_ taking **1–2 business days**; _"We've developed custom packaging for winter and cold months that includes thermal protection"_; **winter packaging is a paid add-on product**                                                                                                                                                                                                                                                          | https://www.heyrooted.com/pages/shipping-returns |

**The universal decision: ship in the plastic grow pot, never in the decorative pot.** Every brand independently arrived at this. It is the single most important packaging decision in the category, because pre-potting is what makes a plant fragile (root ball disturbance, heavier, ceramic bonded to a swinging mass).

### 12.3 Transit time and the survival strategy

| Brand      | Handling                                                                                                                                      | Transit                                                                                       | Source                                                          |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Bloomscape | Ships in **3–4 days** from greenhouse; plants held rather than shipped into lethal weather                                                    | —                                                                                             | https://bloomscape.com/about/; https://support.bloomscape.com/  |
| The Sill   | Winter hold: _"If temperatures drop too low, we may hold your order until it's safe to ship"_; plants that won't ship are marked **pre-sale** | —                                                                                             | https://www.thesill.com/pages/faq                               |
| Hey Rooted | **1–2 business days** to hand-pick and pack; _"we may decide to hold the order until it is warm enough to ship"_                              | **1–5 business days** standard; 2-day expedited; _"Expedited shipping… cannot be guaranteed"_ | https://www.heyrooted.com/pages/shipping-returns, `/pages/faqs` |

**The survival strategy is speed + weather, in that order.** Nobody pads boxes with elaborate bracing; they ship in the grow pot, ship fast, and _stop shipping_ when conditions are lethal. Rooted holds orders _"until it is warm enough"_ — the same policy applied to a 45°C Indian April would black out an entire season, which is the central logistics problem for the Indian version of this business (§13).

### 12.4 How damages are paid for

The economics: **replacement, not refund, almost always.** Bloomscape sends a replacement _"in a grower pot"_ and repots the customer themselves; Hey Rooted _"send[s] replacements right away, and also share[s] tips on how to revive any damaged foliage"_; The Sill coordinates _"a replacement or refund"_ only in the cold-damage case. Rooted's own FAQ: _"We don't accept returns on plants, accessories, supplies, or merchandise."_

**Why replacement beats refund financially:** a dead plant has **already cost** the soil, the pot, the grower time and the freight. Refunding returns none of it. A replacement costs a plant that was already grown and would otherwise be discarded — so for a plant that died _in transit_, **the marginal cost of the replacement approaches the cost of the plant itself**, and the destroyed unit is written off. The pot, which is the high-margin item, is returned to inventory or replaced. This is why every brand's guarantee is generous (30 days, no photo fuss) while its refund policy is stingy.

**Carriers are never named as liable.** Rooted: _"We ship via USPS, UPS, or Fedex depending on the address provided. We are unable to take specific shipping service requests."_ Rooted also holds orders up to two weeks, with a memorable reason: _"Any longer than that and the plant probably won't fit in the box anymore"_ (https://www.heyrooted.com/pages/faqs). Bloomscape's terms: _"You are responsible for all shipping costs associated with returned packages due to failed delivery"_ (https://bloomscape.com/terms/).

**No carrier-claims data is published by any brand.** Every damage dollar is absorbed as cost of goods. **UNVERIFIED and unknowable from public sources** (§11 item 7).

---

## 13. What transfers to India

The constraint set is completely different, so "transfers" means _the mechanism transfers, and the price point does not_. Indian reality that shapes every row:

- **Price sensitivity:** a $69 plant is ~₹5,800 and a $29 plant ~₹2,400. Buyers compare to a ₹200–400 nursery plant, not to a US price.
- **Volumetric-weight courier economics:** a 15" plant + ceramic pot is a large, light, fragile box. Indian 3PLs bill on **volumetric weight (D×W×H/5000 or /6000)**, so an airy box is billed as if it were dense. A US brand pays ~$5 to ship a $69 plant; the Indian equivalent can cost more to ship a ₹900 plant.
- **COD still dominates** and cash-on-delivery return rates are structurally higher.
- **Rented flats with zero natural light** — a much larger share of urban buyers than in the US, and apartment turnover is fast.
- **Summer (March–June) heat at 40–46°C** is a harder constraint than US winter cold, and it is the dominant season.
- **UPI instead of cards**, plus GST and mandatory invoice details on every shipment.

| #   | Global mechanic                                                                      | Indian adaptation                                                                                                                                                                       | Why it must change                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **30-day live-plant guarantee** (all three, §7)                                      | **14-day replacement guarantee**, photo-verified, replacement-not-refund, plus a **7-day "still alive" check-in**                                                                       | Indian customers distrust long guarantees and the disputes arrive slower; a shorter window with an active check-in is easier to honour and generates better signal |
| 2   | **Close-up + distance photo proof** (The Sill, §7.2)                                 | **Same requirement, in WhatsApp** — not email. Single template photo: whole plant in frame + close-up of damage                                                                         | Email-first damage claims lose the dispute to silence; WhatsApp has ~90%+ open rates and the photos arrive where the conversation already is                       |
| 3   | **Ship in the grow pot, decorate on arrival** (§12.2)                                | **Ship in nursery plastic + a separate colour sleeve or a ₹150–350 painted terracotta pot.** Offer pot dressing as an add-on, not a default                                             | Pre-potting makes the box heavier and fragile, which on volumetric-weight billing is doubly expensive                                                              |
| 4   | **Size ladder XS→XXL with height ranges** (§3)                                       | **Three bands only: Small (6–12"), Medium (12–24"), Large (24–36")**, priced in **cm**, with the pot diameter in **cm and inches**                                                      | Indian marketplaces (Amazon, Flipkart) filter in cm; four-plus bands with inch-only labels will simply not filter correctly                                        |
| 5   | **Soil-moisture-% watering instructions** (§5.1)                                     | **Adopt verbatim** — "water when top 50–75% of soil is dry." Add a **finger test** and a **moisture-meter ₹99 upsell**                                                                  | This is the highest-value single field in the report: testable, transferable, and language-neutral                                                                 |
| 6   | **Symptom-first care pages** (175 on Bloomscape, §5.1)                               | **Fewer, bigger, in Hinglish and Hindi, indexed for voice/WhatsApp search** — e.g. _"meri patiyan kharab ho rahi hain"_                                                                 | A 175-page English symptom library is worthless to the actual buyer; the mechanic transfers, the language must be localised                                        |
| 7   | **Light-level faceting and quiz** (§2)                                               | **Reframe the question as "which room and does the AC run"** — not lux. Ask: rented or owned? north/south/west-facing? artificial light? AC on 24/7?                                    | Most urban Indian buyers have **no natural light**, so the US question "how bright is your window?" produces a false negative for most of the market               |
| 8   | **Toxicity as a structured, priced field** (§5.1, §6.1)                              | **Pet/kid-safe as a first-class filter, and charge a small premium** — because non-toxic availability is genuinely limited                                                              | Indian buyers with children and dogs are a large segment; the surcharge is honest because supply is genuinely constrained                                          |
| 9   | **Planter as the AOV lever, +29% to +121% uplift** (§10.4)                           | **The single most valuable mechanic to copy.** A ₹399 plant at ₹699 potted. Use **fibreglass, terracotta or painted plastic**, ₹150–800                                                 | It doubles revenue per unit with no extra growing; it survives plant death; and it is the only route to clearing volumetric-weight freight                         |
| 10  | **Sell planters standalone** (§4.4)                                                  | **Yes, immediately — 8–15 planter SKUs as their own collection**                                                                                                                        | No mortality, no damage claims, pure margin, and it gives you a ₹200–400 basket that can ride free with a plant                                                    |
| 11  | **Care kit attach** (Rooted $53.85 bundle, §10.3)                                    | **₹199–299 kit: mister + fertiliser + moisture meter + neem oil**                                                                                                                       | At a ₹499 plant, AOV will not clear courier economics without an attach                                                                                            |
| 12  | **Plant-stylist consultation, paid** (The Sill $25/$42/$55, §9.2)                    | **₹499 for 30 min on WhatsApp video**, then upsell the recommended plants                                                                                                               | Human expertise is the cheapest differentiator in the category and monetises the care relationship; but it must be _paid_ or it becomes an unbounded support cost  |
| 13  | **Subscription with monthly skip** (Rooted, §6.2)                                    | **Monthly, ₹699–999, skip-anytime, cancel-anytime, UPI autopay via Razorpay/PhonePe mandate**                                                                                           | The skip-anytime design is the one that fits Indian behaviour. See §14 for why the no-skip model must not be copied                                                |
| 14  | **Weather holds** (§7.4, §12.3)                                                      | **Mandatory seasonal shipping calendar: stop shipping March–June for non-hardy species; substitute hardy/succulent SKUs instead of pausing the whole business**                         | Rooted's "hold until warm enough" is a fine US tactic and a catastrophic Indian one — it would shut the business for a third of the year. Substitute, don't pause  |
| 15  | **Subscription / mystery plant** (§6)                                                | **Monthly, ₹299–499 for a 4" mystery plant** with named grower framing (Rooted's "grown in advance by Amelia")                                                                          | Entry-price anchor below the main SKU; the grower story is what makes a mystery box feel trustworthy rather than cheap                                             |
| 16  | **Corporate gifting at volume** (§9.1)                                               | **Diwali/onboarding bulk gifting to IT parks and GCCs in Bengaluru, Hyderabad, Pune, Gurugram, Noida.** The Sill's thresholds translate well: min 15 units, 15% over a high value order | Indian IT campuses are exactly The Sill's "we do a lot of offices" customer, with a corporate-gifting budget already allocated                                     |
| 17  | **Workshops attached to B2B** (The Sill's free Plant 101, §9.1)                      | **Free 20-min "care clinic" on Google Meet with bulk orders**                                                                                                                           | Same play, and it solves the landlord/office-manager objection that plants die because nobody owns them                                                            |
| 18  | **Free-shipping threshold as a bundling lever** (Bloomscape $150, Rooted $95, §12.1) | **Free shipping over ₹999, set _below_ the potted-plant price** so planters push orders over the line                                                                                   | Bloomscape's threshold ($150) is ~2× its $64.50 median plant; the equivalent is a deliberate AOV target, not a shipping decision                                   |
| 19  | **Review/social proof on Trustpilot** (§8)                                           | **Google reviews + Instagram, and platform-native reviews on Amazon/Flipkart.** Trustpilot has no Indian market presence worth modelling                                                | Copy the close-up/distance photo requirement into the review prompt                                                                                                |
| 20  | **Care reminders** (§5.4)                                                            | **WhatsApp-first, not app-first.** Vera is dead (§5.3) and Rooted's 24/7 SMS did not survive scale — a no-P&L, no-attribution app is a trap. Build WhatsApp nudges tied to order data   | Cheaper than an app, far higher engagement in India, and measurable against repeat orders                                                                          |
| 21  | **Grow-your-own / nursery-direct provenance** (§1.2, §1.3)                           | **Lean into it hard — "grown at our own nursery in [Punjab/Haryana/Kerala]"**                                                                                                           | Indian buyers are deeply value-driven and provenance is the cheapest trust signal available; Rooted and The Sill both use exactly this framing                     |
| 22  | **Outdoor/edible pivot** (The Sill, 451 outdoor SKUs, §10)                           | **Balcony and terrace edible kits — chilli, tomato, tulsi, mint — in the same pots and same boxes**                                                                                     | This is where Indian urban demand already is, and it dodges the AC-flat-no-light problem entirely                                                                  |

**What NOT to copy from this table's price logic:** nothing in §10 converts. A $69 plant is ₹5,800. The planter-uplift _ratio_ transfers; the planter _price_ must be re-set against a ₹200–400 local reference price, which means the uplift has to come from a smaller absolute pot, not a ₹4,000 ceramic one.

---

## 14. What does NOT transfer

Same rigour, and this section is more useful than §13 because these are the ideas most likely to be copied uncritically.

1. **The US dollar price ladder.** $39/$69/$99/$149 → $199/$299 becomes ₹1,700/₹2,500/₹4,200/₹12,400. Indian buyers anchor on a ₹200–400 nursery plant, and delivered-maturity premium (§3.4) is real but much smaller: it is roughly **2–4× a nursery price, not 10×.** The whole category is structurally cheaper here, and a business built on a ₹5,800 plant is a business for a tiny slice of the market.

2. **The no-skip / no-cancel subscription.** The Sill's §6.1 terms — 3- or 6-month lock-in, no skip, no cancel, no swap — are viable only because US card culture tolerates a $414 prepayment and the AOV makes it feel like a gift. In India, auto-debit/mandate disputes, UPI chargeback friction and consumer-protection expectations make this a **trust liability and a support-cost liability**, not a retention strategy. Also note what the aggregators already say about it _in the US_: "the three-month minimum commitment frustrates single-month triers" (https://whichsubscriptionbox.com/boxes/plants). Copy Hey Rooted's skip-anytime design instead (§13 row 13).

3. **Pre-potting in ceramic.** Every US brand ships in the grow pot (§12.2) partly for survival, but shipping a _finished_ ceramic-pot plant is fatal in India because volumetric-weight billing charges the air around a heavy pot. Do not model US "plant arrives in the beautiful pot" imagery.

4. **A 24/7 human SMS/photo diagnosis line.** Rooted's version was excellent and is now degraded to weekday-hours email (§5.4) — it did not survive scale at a $29 median price. At Indian price points with Indian wage costs the unit economics are worse. Use WhatsApp + a bounded human window (§13 rows 12, 20).

5. **Acquiring a care app.** Vera was acquired with 2020 funding and delisted by 2024 (§5.3). It was free, monetised nothing, and its only value was attribution to plant sales. The durable asset was the 117 guides + 175 symptom pages, not the app. **Build content and a WhatsApp channel; do not acquire or fund an app.**

6. **Winter as the only seasonal constraint.** All three brands' weather logic is built around _cold_ (heat packs, $5 winter packaging, weather holds, cold-damage exclusions). India's lethal season is **March–June heat at 40–46°C**, plus monsoon humidity and fungal rot. A heat pack is useless; an insulated box is actively dangerous. The whole seasonal packaging programme must be rebuilt around heat and humidity, not cold. Rooted's "hold until warm enough" would black out a third of the year (§13 row 14).

7. **COD-default checkout.** US checkouts are card-first with prepaid options. COD will be demanded by a large share of Indian buyers, and COD refusal rates in this category are structurally high because a buyer who receives a damaged plant simply refuses the parcel — which means **the plant dies in the box and you absorb both the plant and the freight.** Offer prepaid-first with a small discount, and treat COD as a cost-approval line, not a default.

8. **Heavy ceramic planter catalogs.** The Sill's 20 planter SKUs run **$34–$399**, with a 45-colour Isabella and a $399 Revival floor planter. Fragile, heavy, high-volumetric-weight, high-return. In India this range collapses to **₹150–800 and mostly non-ceramic** — fibre, terracotta, painted plastic, or steel. A ₹4,000 handcrafted porcelain planter is not a product here; it is a curiosity.

9. **The outdoor-plant pivot at The Sill's scale.** The Sill's outdoor push is credible in the US suburban context. In India, "outdoor plant" means balcony edible kits and terrace growers, and the market is served intensely by local nurseries at ₹50–200 a plant. The Sill's 451 outdoor SKUs at a $89 median entry price do not map onto a market where the substitute is ₹150.

10. **Trustpilot as the review destination.** Zero relevance in India. Use Google reviews + Instagram + marketplace-native reviews, and put the photo-verification habit into the prompt (§13 row 19).

11. **"Fully-grown, living-room-ready" as a premium at US price points.** The maturity framing (§3.4) transfers as a _concept_ — the buyer is buying time, not a seedling — but the willingness to pay a 10× premium for maturity does not survive price sensitivity. Offer a genuine 2–3× maturity premium and be honest that the plant is 12–18 months grown, not 30.

---

## 15. Ten observations to steal or beat

1. **Publish a soil-moisture-% watering spec per plant, and make it the core care field.** "Water when the top 50–75% of the soil is dry" is testable, language-neutral, and beats "water weekly" on every dimension (§5.1). Then sell a ₹99 moisture meter that makes the instruction executable. **Beat it:** express it as a finger-depth test with an image.

2. **Build the symptom-first content library — it is the cheapest acquisition channel in the category.** 175 pages at Bloomscape, all titled as customer anxieties ("Why is my cactus shriveling up and wrinkling?") (§5.1). Write them in Hinglish/Hindi. **Beat it:** make them WhatsApp-shareable cards and answers to the questions your support inbox actually receives.

3. **Use the planter as the entire AOV strategy.** Measured uplift: **+29% to +121%**, largest at the small end, where a $39 plant becomes $79 (§10.4). It survives plant death, it has no damage-claim risk, and it is the only lever that clears volumetric-weight freight economics. **Beat it:** sell the planter as the durable artefact the customer keeps forever, and price it against the ₹200–400 nursery reference rather than against US ceramics.

4. **Require close-up + distance damage photos at intake, over WhatsApp.** Adopted by all three brands; The Sill specifies both framings and uses them for packaging QA (§7.2). This single rule eliminates claim back-and-forth and converts a complaint into structured QA data. **Beat it:** auto-classify the photo and pre-approve the replacement before the customer asks.

5. **Replace the app with a WhatsApp care channel tied to order data.** Vera was acquired and then died (§5.3); Rooted's 24/7 SMS degraded to weekday email (§5.4). Both outcomes are the same lesson: unattributed care tooling gets defunded. **Beat it:** make every care nudge measurable against repeat purchase, so it can never be cut as "just a marketing cost."

6. **Make the guarantee replacement-only, 14 days, photo-verified — and say so in bold.** Every US brand resolves damage as replacement, never refund, because a dead plant has already consumed soil, pot, grower time and freight, so refunding returns none of it (§12.4). **Beat it:** add the free "care clinic" call that comes _before_ the claim is filed — it converts a damage claim into a save.

7. **Build a hard seasonal shipping calendar and substitute, don't pause.** Rooted's "hold until warm enough" is a good US tactic and a business-ending one in India (§13 row 14). Publish an explicit ship/no-ship calendar per species, and swap to heat-tolerant SKUs in the dead months so revenue never stops.

8. **Turn the light question into a rental/AC/room-orientation question.** The US quiz asks how bright your window is (§2); most Indian urban buyers have none, so that question produces a false negative for most of the market (§13 row 7). Ask about rent vs. own, window direction, and whether the AC runs. **Beat it:** offer to sell a grow light _inside_ the quiz flow the moment you learn they have no window — same mechanic as Bloomscape's care-text accessory links (§5.1 point 3).

9. **Sell the guarantee of _matching size_ or nothing.** The loudest Bloomscape complaint in the entire dataset is that the plant was _"laughably small for the container it was in"_ and the replacement _"was still way smaller than advertised"_ — the reviewer concluded _"I honestly don't think they have plants in the sizes they're selling them"_ (§8.2). The height-range spec (§3) actively **increases** return rate when the grower misses it, because it turns a shortfall into a provable breach. Either hit the size band or photograph the actual plant against a ruler and ship that photo. **Beat it:** make the pre-ship photo mandatory in your QC.

10. **Take the B2B route that all three abandoned — because they had no choice, and you may not.** Rooted had real B2B (Facebook, BuzzFeed, Chobani, Nike; $75k/mo, 85% offline) and deliberately killed it to chase DTC (§1.3); none of the three now offers maintenance contracts, hotel or restaurant accounts publicly (§9.3). Rooted gave up a business that requires a physical presence in the service city — which is the one thing a shipping-DTC model cannot have. If you are building in a single metro, **local office/hotel contracts are a defensible, uncontested position that every global leader in this report has vacated.** Monetise it with the paid plant-stylist consultation format (The Sill's $25/$42/$55 ladder, §9.2), scaled to ₹499 per 30 minutes.

---

## Appendix — sources that were blocked or failed

Recorded for transparency, per the method note:

| Source                                                                                                                    | Outcome                                                                                                                                                                                                   | Fallback used                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `monsterplant.com` (all paths)                                                                                            | DNS resolves to AWS/Global Accelerator parking; HTTP 000 on every `curl`; `CRAWL_EMPTY_CONTENT` on every `web_extract`. Latest Wayback capture (12 Jul 2025) is a `window.location.href="/lander"` script | Wayback captures; concluded dead (§1.4)                                                                                                                                                                 |
| `https://www.thesill.com/pages/subscription`, `/pages/subscriptions`, `/pages/sizing-guide`                               | HTTP 404 — no such pages                                                                                                                                                                                  | Sitemap (`/sitemap_pages_1.xml`, 64 pages) + Shopify `products.json`; subscription terms from `help.thesill.com`                                                                                        |
| `https://bloomscape.com/pages/subscription-plan/`, `/collections/subscriptions`, `/pages/guarantee`, `/workplace-plants/` | HTTP 404                                                                                                                                                                                                  | WP REST API (`/wp-json/wp/v2/pages?slug=…`), `support.bloomscape.com`, and the live footer (which lists only Corporate Gifting + Trade Program)                                                         |
| `https://bloomscape.com/product/best-sellers-subscription/`                                                               | HTTP 404 "Oops! Looks like we can't find that page" — an indexed subscription PDP is gone                                                                                                                 | Product sitemap (186 URLs, none subscription), Woo Store API search returns `[]` → concluded discontinued (§6.5)                                                                                        |
| Bloomscape quiz question text (`https://bloomscape.com/plant-quiz/`)                                                      | Delivered via **Typeform** (`_tp_id`/`_tp_s_*` cookies); questions not in server HTML                                                                                                                     | Rooted's documented quiz questions via https://www.honestbrandreviews.com/reviews/rooted-review/; Rooted's own GPS-aperture light-estimation from https://www.thepitch.show/74-stop-killing-your-plants |
| `web_extract` on `support.bloomscape.com/*`                                                                               | Intermittent `403 Forbidden` (keyless Firecrawl quota)                                                                                                                                                    | Direct `curl` with browser UA, HTML stripped                                                                                                                                                            |
| `https://bloomscape.com/plant-care-guide/monstera/` body copy                                                             | Page renders care copy via JS from a custom post type; ACF body groups are mostly empty                                                                                                                   | `plant_species` ACF group via `/wp-json/wp/v2/plant_species?slug=monstera` → the full 7-field care model (§5.1)                                                                                         |
| The Sill help-centre accordions                                                                                           | Text truncated mid-sentence in HTML (`css-mnj2g5` line-clamp)                                                                                                                                             | Direct `curl` of the article and regex extraction of the `<p>` bodies (§6.1)                                                                                                                            |
| `https://www.thesill.com/pages/corporate-gifting` via `web_extract`                                                       | Returns near-empty body (JS-rendered)                                                                                                                                                                     | Sill FAQ + the corporate-gifting blog post (§9.1)                                                                                                                                                       |
| Bloomscape / The Sill / Rooted — subscription revenue, subscribers, retention, contribution margin, carrier claims        | **Not published anywhere.** See §11                                                                                                                                                                       | None available. Marked UNVERIFIED rather than estimated                                                                                                                                                 |
| Bloomscape and Rooted headcount                                                                                           | Not published                                                                                                                                                                                             | The Sill only: **83 employees**, https://builtin.com/company/sill                                                                                                                                       |
| Monster Plant as a real retailer                                                                                          | No such brand found; only a Habbo Hotel pet, a Care Bears wiki page, a Japanese mobile game, and a Hungarian Instagram seller that Reddit flags as a suspected scam                                       | Excluded (§1.4)                                                                                                                                                                                         |

**End of report.**
