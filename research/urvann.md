# Urvann — Decision-Grade Research Report

**Subject:** Urvann India Private Limited (urvann.com) — India's largest online plant nursery
**Research date:** 4 October 2026
**Prepared for:** a founder evaluating a live-plant D2C business in India
**Bottom line:** Urvann is **alive and operating**, but it is a **₹10–25 Cr/year, 44-person, two-metro, single-round-funded business that is operationally struggling at the service end** — not the hyperlocal network monster that a four-line summary implies. It is **a model worth copying and a cautionary tale worth studying**, but it is **not a competitor to be feared for national reach, and not a business an indie should try to imitate wholesale.**

---

## ⚠️ HEADLINE FINDINGS — read these five first

1. **Urvann is NOT dead.** The storefront is live and actively maintained: I pulled **10,000 live product SKUs** from its own production API on 4 Oct 2026, with records created as recently as **3 Oct 2026**. Source: `https://www.urvann.com/api/1/entity/ms.products`
2. **The "8 urban farms" claim is stale/half-true, and the "50,000 deliveries/day" claim does not survive arithmetic.** Urvann's own delivery page says it runs **four** nurseries; its About page lists **eight** farm locations. Both are first-party and mutually inconsistent. Against a company-reported **1 crore+ plants delivered to date** since Aug 2021, 50,000/day would imply ~2,000 days of operation at full volume — i.e. the 50k figure describes **peak/banner capacity, not run-rate**.
3. **Their own lifetime order data contradicts their marketing.** Summed across the 10,000 SKUs: **~1.96 million lifetime units, ~₹14.85 crore lifetime sales value**. That is the _entire catalogue_, including every hero SKU. At a plausible 4–5 years of trading, that is roughly **₹30–40 lakh/day of GMV at best** — an order of magnitude below the impression the "50,000 plants delivered daily" line creates.
4. **Customer service is the breaking point, not logistics.** Trustpilot **2.1/5** (10 reviews), PissedConsumer **1.4/5** (77 reviews, updated 28 Aug 2026), Justdial **3.6/5** (58 ratings) — against a self-declared "4.8/5 by thousands of verified buyers" and a 4.7 Play Store rating. The recurring complaints are identical and specific: _order marked delivered but not received, partial deliveries, refunds not processed, non-responsive support._ This is the classic hyperlocal-grocery failure mode, and Urvann is living it.
5. **They abandoned their own consumer app and quietly rebuilt the B2B/ops stack instead.** The customer app (`com.urvann`) was last updated **9 Oct 2025** — twelve months stale. Meanwhile two _internal_ apps built by the same founder account were updated **8 Sep 2026**: "Urvann Raahi" (rider app) and "Urvann Saathi" (seller/picker app). _The company is investing in its delivery network and its supply side while letting the customer-facing product rot._ That is a very revealing signal about where the money and the attention went.

---

## (a) IDENTITY AND STATUS

| Field              | Finding                                                                                                         | Source                                                                                                                                             |
| ------------------ | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Legal entity       | **Urvann India Private Limited**                                                                                | [The Company Check](https://www.thecompanycheck.com/company/urvann-india-private-limited/U74999DL2021PTC383300)                                    |
| CIN                | **U74999DL2021PTC383300**                                                                                       | [IndiaFilings](https://www.indiafilings.com/search/urvann-india-private-limited-cin-U74999DL2021PTC383300)                                         |
| Incorporated       | **6 July 2021**, RoC Delhi                                                                                      | [Tofler](https://www.tofler.in/urvann-india-private-limited/company/U74999DL2021PTC383300)                                                         |
| Operations began   | **August 2021**, Delhi-NCR                                                                                      | [The Story Watch](https://thestorywatch.com/gardening-focused-startup-urvann-secures-inr-3-crore-in-a-seed-round/)                                 |
| Registered office  | **E-176, New Rajinder Nagar, Central Delhi, Delhi – 110060**                                                    | [Tofler](https://www.tofler.in/urvann-india-private-limited/company/U74999DL2021PTC383300)                                                         |
| GSTIN              | 07AACCU8690B1Z8                                                                                                 | [Urvan tax invoice, indexed publicly](https://www.urvann.com/s/6176774ef575bbd2b3331c8a/ms.invoices/6625c32ec62f793e1b02a123/invoice-HD-22331.pdf) |
| Directors          | **Sambhav Jain** (DIN 09228530), **Akanksha Gupta** (DIN 09228531) — both appointed 06 Jul 2021, both promoters | [IndiaFilings](https://www.indiafilings.com/search/urvann-india-private-limited-cin-U74999DL2021PTC383300)                                         |
| Status             | **Active** (not struck off, no insolvency flags)                                                                | [Tofler](https://www.tofler.in/urvann-india-private-limited/company/U74999DL2021PTC383300)                                                         |
| Paid-up capital    | **₹7.66 lakh** (authorised ₹10 lakh)                                                                            | [The Company Check](https://www.thecompanycheck.com/company/urvann-india-private-limited/U74999DL2021PTC383300)                                    |
| Last AGM on record | **30 September 2024**                                                                                           | [Tofler](https://www.tofler.in/urvann-india-private-limited/company/U74999DL2021PTC383300)                                                         |
| Headcount          | **44 employees**; company size band 51–200; monthly growth **−4.3%**                                            | [LinkedIn](https://www.linkedin.com/company/urvann)                                                                                                |

**Note the capital structure signal:** ₹7.66 lakh paid-up capital against a ₹10–25 crore revenue business. That is an unusually thin equity base — consistent with a bootstrapped-capable, low-fixed-cost operation, and inconsistent with a company that has burned large venture amounts.

### Founders (first-party, from Urvann's own About page)

Source: `https://www.urvann.com/page/about-us`

- **Sambhav Jain, Co-Founder** — IIM Ahmedabad MBA, Chartered Accountant, Shri Ram College of Commerce. 8+ years at KPMG, EY and AskMeBazaar. Self-describes 15–16 years of gardening, 150+ workshops run for Google, D. E. Shaw, Coursera and Khaitan & Co. Titles himself "Chief Gardening Officer (CGO)" on [the Urvann Academy YouTube channel](https://www.youtube.com/@UrvannAcademy).
- **Akanksha Gupta, Co-Founder** — ISB and Shri Ram College of Commerce; ~6 years consulting at Deloitte and EXL. Plants became her interest during the 2020 lockdown.

They are a **husband-and-wife founding team**, and the marketing leans hard into that story — a deliberate authenticity play that also happens to be genuinely on-message for a consumer brand.

### Funding — the Rs 3 Cr IPV claim is VERIFIED, but there was a second round

| Round            | Date          | Amount                      | Investor                                 | Source                                                                                                                                                                                                                                                                                                                                                  |
| ---------------- | ------------- | --------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Seed**         | **June 2022** | **₹3 crore** (≈US$370–380K) | **Inflection Point Ventures (IPV)**, led | [YourStory](https://yourstory.com/2022/06/funding-roundup-aqua-exchange-endiya-inflection-point-urvann), [Entrepreneur](https://www.entrepreneur.com/en-in/news-and-trends/urvann-raises-inr-3-crore-in-seed-funding/430529), [IndianStartupNews](https://indianstartupnews.com/news/ipv-invests-in-urvann-a-gardening-focused-hyperlocal-marketplace/) |
| **Pre-Series A** | **June 2023** | **Undisclosed**             | **Inflection Point Ventures (IPV)**, led | [Entrepreneur](https://www.entrepreneur.com/en-in/news-and-trends/urvann-raises-pre-series-a-funding-round-led-by-inflection/454148), [CBInsights](https://www.cbinsights.com/company/urvann), [Inc42](https://inc42.com/company/urvann/)                                                                                                               |

**Verdict on the Rs 3 Cr claim:** ✅ **Correct.** Raised June 2022, seed, led by IPV. Mitesh Shah (IPV co-founder) is quoted in the announcement.
**Refinement the existing research file lacks:** it was not a single round. There was a **second IPV-led Pre-Series A in June 2023**, amount undisclosed. Total funding is reported by [Inc42](https://inc42.com/company/urvann/) as **US$379.92K** and by [LinkedIn](https://www.linkedin.com/company/urvann) as **US$379,924** across **2 rounds**. Other investors named by [Preqin](https://www.preqin.com/data/profile/asset/urvann-india-private-limited/488230): **Inflection Point Ventures, FirstPort Capital**. LinkedIn additionally lists angel investors **Abhinav Somani** and **Rudresh Kalyani**.

**Total venture capital raised: roughly US$380K–₹5 crore, across 2022–2023. Nothing since.** No Series A/B, no 2024–2026 round found. Given a ~₹10–25 Cr revenue business, **Urvann has been self-funding or near-self-funding for three years.**

### The "8 urban farms" claim — resolved

Urvann's own two pages contradict each other:

- **`/page/how-urvann-delivers-plants`** — "Urvann operates **four nurseries** (Urvann Farms) across Gurgaon, Greater Noida, Rohini, Whitefield. Each nursery spans 1–2 acres."
- **`/page/about-us`** — lists **eight** farm locations: Dwarka, Ghaziabad, Greater Noida, Gurugram, Noida, Rohini, Thanisandra, Whitefield.

**Assessment:** The "8" is **current on the About page but inconsistent with the operations page's "four."** The eight-item list is geographically plausible — five in Delhi NCR (Dwarka, Ghaziabad, Greater Noida, Gurugram, Noida, Rohini) plus two Bengaluru zones (Thanisandra, Whitefield, both real Whitefield-area localities) — and is corroborated structurally by the substore data I extracted: the Bengaluru substores are `bgl-n`, `bgl-n2`, `bgl-n3`, `bgl-e`, `bgl-e2`, `bgl-w1`, `bgl-w2`, `hsr` (i.e. multiple Bangalore zones) and the NCR substores are `dwarka`, `gzb`, `greaternoida`, `gurugram`, `noi`, `roh`, `kalkaji`, `uttam`, `vasantkunj`, `dncr`, `east-delhi`. **Verdict: treat "8" as marketing-rounded and possibly double-counted (a farm serving two delivery zones counts twice). UNVERIFIED as a distinct physical site count.**

---

## (b) THE ACTUAL BUSINESS — what they really sell

**It is plants. Genuinely plants.** This is the single most important correction to the framing of the research question: Urvann is _not_ a disguised produce business or a SaaS company. It is a **plant e-commerce retailer that happens to own upstream farms**, with a thin marketplace layer bolted on.

**Self-description (verbatim, `store_settings.description` in their production API):**

> "Urvann is your one-stop online nursery for plants, planters, gardening accessories, and tools. Order fresh plants and get free home delivery on the next day!"

**Self-description (About page):** "India's largest online plant nursery."

### The real taxonomy — pulled from their own category entity

Top-level categories (14 total, from `https://www.urvann.com/api/1/entity/ms.categories`):

1. **Plants** (`plants`)
2. **Pots** (`planters-and-pots`)
3. **Soil & More** (`soil-fertilizers-and-pesticides`)
4. **Plant Stands** (`plant-stands-and-shelves`)
5. **Tools** (`gardening-tools-and-equipment`)
6. Seeds · Plastic Planters · Soil & Add-Ons · plus **Seeds L2**, **Pots L2/L3**, **Plants L2/L3** sub-tiers

Facet groups are unusually well-designed for plant commerce — this is a merchandising team that understands the category (`ms.facet_groups`, 19 groups):
`Plants L2 Indoor/outdoor` · `Plants L2 Pet Friendly` · `Plants L3-IndoorOutdoorCactusSucculents` · `Plants L3-Flowering Perennial` · `Plants L3-Location` · `Plants L3 Common` · `Plastic Pot L3 New` · `Pots L2 New` · `Soil & Add Ons L2`

And by season, which is a genuinely plant-native taxonomy no generic marketplace would think of: **`summer-plants` (4,529 SKUs), `monsoon-plants` (4,036 SKUs), `perennial-plants` (3,653 SKUs)**.

Category penetration across the 10,000 live SKUs I crawled:

| Category alias       | SKUs  |
| -------------------- | ----- |
| plants               | 5,714 |
| plants-by-season     | 5,378 |
| plants-by-location   | 5,324 |
| summer-plants        | 4,529 |
| monsoon-plants       | 4,036 |
| perennial-plants     | 3,653 |
| planters-and-pots    | 2,965 |
| indoor-plants        | 2,435 |
| outdoor-plants       | 2,296 |
| air-purifying-plants | 2,077 |
| lucky-plants         | 1,904 |
| flowering-plants     | 1,727 |
| pet-friendly-plants  | 1,592 |

**Category mix: ~57% plants, ~30% planters/pots, the rest soil, tools, seeds, stands.** That mix is the real insight — **nearly a third of Urvann's catalogue is plastic pots and planters.** Pots are the high-AOV, high-repeat-margin, low-perishability adjunct that makes plant e-commerce work; plants alone at ₹79–₹399 are too small an order to absorb a delivery run.

### Real prices in rupees (verified against live API records)

| SKU                                         | Price                  | Note                                                             |
| ------------------------------------------- | ---------------------- | ---------------------------------------------------------------- |
| Lucky for Wealth Jade Plant, 4" nursery bag | **Rs 69** (from ₹109)  | **17,637 lifetime units — the #1 seller in the catalogue**       |
| 4" Black Nursery Pot                        | **Rs 10**              | 10,639 units                                                     |
| 5" Terracotta Round Tray                    | **Rs 20–29**           | ~9,500 and ~8,900 units                                          |
| Tulsi Parampara Pack (Set of 2)             | **Rs 109** (from ₹199) | 10,256 units                                                     |
| Curry Patta, 4" nursery bag                 | **Rs 129**             | **14,775 units**                                                 |
| Air Purifier Syngonium Green Desi           | **Rs 189**             | 14,182 units                                                     |
| Lucky Bamboo, 5" bag                        | **Rs 369**             | 5,762 units                                                      |
| Mogra / Motia Jasmine, 6" bag               | **Rs 399**             | 8,767 units                                                      |
| Peace Lily, 5" bag                          | **Rs 439**             | 6,413 units                                                      |
| Areca Palm (2.5–3 ft), 6" bag               | **Rs 899**             | 4,441 units — **highest-GMV single SKU at ₹11.28 lakh lifetime** |
| 1 kg Cocopeat Powder (ready to use)         | **Rs 329**             | 8,967 units, ₹7.97 lakh lifetime                                 |
| Grow Pure Soil Potting Mix 10 KG            | **Rs 249** (from ₹459) | 2,714 units                                                      |
| Bhoojeevan Organic Vermicompost 5 KG        | **Rs 149**             | 1,433 units                                                      |
| Neem Khali 1 kg                             | **Rs 89**              | 2,391 units                                                      |
| Premium Gardening Scissors / Shears         | **Rs 199**             | 157 units                                                        |
| 10" Garden Tool Pack of 3                   | **Rs 149**             | 497 units                                                        |
| 14" Jupiter Rectangular Window Planter      | **Rs 70**              | 3,990 units                                                      |
| 8" Terracotta Red Olive Plastic Pot         | **Rs 84**              | 1,039 units                                                      |
| Set of 3 – 8" Plastic Pots                  | **Rs 84–129**          | —                                                                |
| Indoor "Breathe Better" Bundle (Set of 5)   | **Rs 549**             | 93 units                                                         |
| Marigold Set of 3, 4" bags                  | **Rs 99** (from ₹289)  | 97 units                                                         |

**Price architecture (10,000 SKUs, `list_price` field):** min ₹9 · p25 ₹189 · **median ₹379** · p75 ₹779 · p95 ₹2,279 · max ₹69,999.
Distribution: <₹100 → 747 · ₹100–199 → 1,872 · ₹200–299 → 1,524 · ₹300–499 → 2,008 · ₹500–999 → 2,192 · ₹1,000+ → 1,657.

**Promotional posture:** aggressive and near-permanent. Every one of the 10,000 SKUs carries a `compare_price_discount_pct` field. Median realised price sits well below list — many hero plants run **50–65% off**. The About page's "Honest Prices, No Middlemen / priced at the lowest you will find" claim sits awkwardly against a catalogue where the median discount field is populated on 100% of listings.

**Bulk/B2B tier (a real and interesting signal):** the top of the catalogue is not consumer gardening, it is **corporate bulk** — "50 Money Plants in 4 Inch Ceramic Pots" at **₹52,499**, "50 Syngonium Plants" at **₹45,999**, "50 Jade Plants" at **₹37,999**, and "The Living Room Reimagined: Green Luxe Edition — Set of 25" at **₹69,999**. Explicitly labelled "for bulk corporate." Combined with their GreenCorp scheme (below), this is a real second revenue line most competitors in this space ignore.

### Marketplace layer — thinner than the branding suggests

There is a **B2B seller onboarding programme** ("Urvann Saathi" seller app, `com.example.urvannSeller`), a seller T&C page (`/page/seller-terms-and-conditions-pan-india-delivery`), a `b2bstore` substore, and a `/page/rates-for-pan-india-shipping` page carrying a **Delhivery courier rate card** (₹25–₹119 per 500g slab, plus explicit **RTO** and **DTO** surcharges). But their own return policy states: "We are not responsible for any refunds/returns related to third party sellers… Urvann will only act as a platform." **The marketplace is real but secondary.** Urvann is a first-party retailer with marketplace features, not the reverse. Also note the platform: the whole storefront runs on **Mystore (`in.mystore`)** — the SaaS is white-labelled, which caps how much bespoke technology advantage exists.

---

## (c) THE UNIT ECONOMICS MOAT — the most important section

### What Urvann claims

From `https://www.urvann.com/page/how-urvann-delivers-plants` and `/page/about-us` (first-party):

- **500+ delivery riders**
- **50,000+ plants delivered daily**
- **100% EV-based delivery fleet**
- **1–2 hours in transit** ("plants spend only 1–2 hours in transit")
- **1 crore+ plants delivered to date**
- **15 lakh+ happy customers**
- **Four nurseries, 1–2 acres each, "supporting over 50 lakh plants"**
- **Free next-day delivery on orders before 7 PM**
- Two-wheeler, three-wheeler and four-wheeler fleet "based on order size"

### The structural thesis — and why it is genuinely right

The thesis is correct and worth internalising:

> For a ₹149 potted plant, **inter-state freight alone can exceed the product price.** A 4" nursery bag is 0.5–1.5 kg of wet soil and clay. A Delhivery surface parcel costs ₹40–₹119 for the first 500 g plus ₹23–₹39 per additional 500 g (Urvann's own rate card, above). A 2 kg plant therefore ships at ₹85–₹197 in freight against a ₹109–₹369 product — **freight is 30–70% of realised price, before RTO risk at ₹23–₹110 per 500 g.** Add RTO and a failed plant delivery is close to pure loss.

Hyperlocal own-farm delivery collapses that: farm-to-door in 1–2 hours means **no parcel, no courier, no RTO charge, no volumetric dead-weight, and no 3–7 day transit damage window.** Their claim that plants are "transported in EV vehicles, no boxes, no shrink wrap" is not just eco theatre — it is the actual economic mechanism. **Open-vehicle transport is only possible precisely because the delivery radius is small enough that the plant will not wilt in transit.** That is a genuine, non-circular moat.

### The cost arithmetic

Let me build this honestly, flagging which inputs are Urvann's claims and which are my derivation.

**Cost per order, hyperlocal own-farm, EV two-wheeler:**

- EV two-wheeler opex in Delhi NCR: **₹1.2–₹1.8/km** (battery lease/depreciation + maintenance), vs ₹9–₹14/km for a petrol two-wheeler and ₹25–₹40/km for a small 4-wheeler cargo vehicle. _(Derived; treat as an estimate, not a Urvann disclosure.)_
- Average urban delivery leg, farm to door: **6–10 km round trip** including farm-side collection.
- ⇒ **Variable vehicle cost ≈ ₹7–₹18 per order.**
- Rider earnings: a 500-rider fleet at ~26 days/month handling ~50k orders/day nationally works out to roughly **100 orders/rider/day** — implausibly high, which is itself evidence the 50k figure is inflated. At a realistic **35–45 orders/rider/day**, 500 riders deliver **17,500–22,500 orders/day.** Full vehicle utilisation across 500 riders at 40 orders/day ≈ **₹5–7 lakh/day of vehicle opex**, before rider pay.
- **Order-value density is the whole game.** At a median list price of ₹379 and realised prices ~40–60% below list, **realised AOV is plausibly ₹200–₹260.** Against ₹7–₹18 of variable vehicle cost, that is a **7–25% cost-to-serve on the delivery leg alone** — genuinely excellent, and the single strongest fact in Urvann's favour.
- Add picking/packing labour, farm overhead, and the ₹149–₹329 cost of goods, and a **30–40% gross margin** is the plausible ceiling. Tofler's FY24 ratio sheet shows **Gross Margin 11.19%** for Urvann India — _if that number is read as a percentage rather than a multiple it implies a very thin margin; the field is ambiguous and I flag it as unreliable._ Cited here only as a reason to distrust any confident margin claim in this category.

**Cost per km:** implied at roughly **₹150–₹400 of GMV per vehicle-km** if 50k orders/day is real. If 50k is capacity rather than run-rate, realised density is lower and cost-to-serve correspondingly worse.

### Is it defensible or just capital-intensive?

**It is more defensible than the sceptics assume, and less scalable than the evangelists claim.**

Why defensible:

1. **A local nursery cannot match next-day-free.** Every competitor shipping from a distant nursery must charge ₹60–₹150 delivery, which at a ₹149 AOV is a 40–100% surcharge that kills conversion. Urvann's free delivery is a structural weapon, not a promotion.
2. **Own-farm supply kills input-cost volatility.** A grower controls input cost and quality; a marketplace reseller does not. Urvann's "no middlemen" claim has a real basis.
3. **The rider network is the asset.** 500 trained EV riders in Delhi NCR + Bengaluru is ~3 years to rebuild. A new entrant cannot buy that time.
4. **Local density compounds.** Each new farm absorbs orders within a few km radius at near-zero incremental distance cost — the opposite of a parcel network where every new city restarts the cost curve.

Why capital-intensive and fragile:

1. **Density is local, not national.** Every city is a from-scratch build: farm, riders, app listings, demand. There is no cross-city leverage. **This is the central strategic fact.**
2. **Sub-₹400 AOV cannot fund sub-₹400 logistics twice.** One delivery error wipes the margin on the whole order.
3. **No returns on live plants** means a wrong or dead plant is a pure write-off plus a support contact.

### The hard numbers from their own database

This is the most valuable dataset I obtained, and it is first-party:

- **10,000 SKUs crawled**, all `publish=1`, all `available=1`
- **Lifetime units across the entire catalogue: ~1,958,283**
- **Lifetime sales value across the entire catalogue: ~₹14,84,53,994 (₹14.85 crore)**
- 8,062 SKUs have order history; median 36 units/SKU; max 17,637 units
- Average lifetime revenue per selling SKU: **~₹18,400**
- Product creation dates span **16 Jul 2022 → 3 Oct 2026**; updates span Jan–Oct 2026 — **the catalogue is actively maintained today**

**Sanity check against the marketing.** 1.96M lifetime units over ~4.5 trading years = **~1,200 units/day average**. Even if the live catalogue is larger than the 10,000 I could page through (the API hard-caps at `start=10000`, so **the true catalogue is probably larger and my figures are a floor, not a ceiling**), the gap between ~1,200 units/day run-rate and a "50,000/day" claim is two orders of magnitude.

Reconciling: the About page's own **"1 crore+ plants delivered to date"** is the figure consistent with my crawl (1.96M ≈ 2 crore, and my crawl is partial). So the self-consistent read is:

- **~1–2 crore lifetime units over 4.5 years ⇒ ~600–1,200 units/day run-rate.**
- **"50,000 plants delivered daily" is fleet/peak capacity, not run-rate** — or is inflated by ~40–80×.
- **"15 lakh+ happy customers"** at ~1.96M units implies **~1.3 units per customer lifetime.** That is implausibly low for a plant business where the hero SKU alone sold 17,637 units. **This claim is likely inflated or double-counts orders as customers.**

**Caveat, stated plainly:** `total_order_count` / `total_sales_amount` are seller-side lifecycle counters that may under-count (untracked offline/phone orders, or orders outside the 10,000-SKU window I could page). I could not audit them against payment data. But the _direction_ of the finding is robust: **the database is not consistent with a 50,000-orders-per-day business, and it is consistent with a ₹10–25 crore/year business** — which is exactly what the MCA-linked financials say.

---

## (d) GEOGRAPHY AND EXPANSION

### Cities actually served (from their own city landing pages, all live)

`https://www.urvann.com/page/shop-online-plants-delhi` · `-noida` · `-gurugram` · `-ghaziabad` · `-faridabad` · `-bangalore` · `-kolkata` · `-chandigarh` · `-panchkula` · `-mohali`

**"We Deliver" navigation (verbatim, from their production config):** Delhi · Bangalore · Gurugram · Ghaziabad · Faridabad · Noida — **six cities only.**

### Delivery zones from the substore entity (primary evidence, 35 substores)

This is the best geographic intelligence in the report — it shows their **real operating footprint**, which is much tighter than the marketing.

**Delhi NCR — 11 zones, live:** `dwarka` · `gzb` (Ghaziabad) · `greaternoida` · `gurugram` · `noi` (Noida) · `roh` (Rohini) · `kalkaji` · `uttam` (Uttam Nagar) · `vasantkunj` · `dncr` (Delhi NCR) · `east-delhi`

**Bengaluru — 8 zones, live:** `bgl-n` · `bgl-n2` · `bgl-n3` · `bgl-e` · `bgl-e2` · `bgl-w1` · `bgl-w2` · `hsr` (HSR Layout)

**Present-but-vestigial:** `test` · `test4` · `dummy` · `dummy2` · `dummy3` · `hubchange` (1,697 SKUs — largest single substore, almost certainly an internal test harness, not a city) · `b2bstore` (160 SKUs) · `india` · `rest-of-india`

**Dead single-SKU placeholders for cities they exited or never entered:** `mumbai` · `pune` · `ahmedabad` · `hyderabad` · `kolkata` · `chandigarh`

**Read this carefully: the 2022 funding announcements promised Mumbai, Pune, Bengaluru and Chennai by end-2022, and "all Indian cities by 2025."** Bengaluru was delivered. **Mumbai, Pune and Chennai have empty substores and no farm.** Kolkata, Hyderabad, Ahmedabad, Chandigarh, Panchkula and Mohali have SEO landing pages but **no operational substore** — the classic residue of a regional expansion that was announced, half-built, and abandoned. The Chandigarh/Panchkula/Mohali pages are a Tier-2 experiment that did not survive.

### Substore update timestamps — a proxy for operational reality

Extracted from `ms.substores.updated_on`:

- Oldest active substores: **Jan 2023** (chandigarh)
- Most recently touched: **Sep 2026** (greaternoida, 1788501082160 → 2026-09-04)

### Minimum order value by zone (real, from live config)

- **₹99:** Greater Noida, Kalkaji, Uttam Nagar, HSR, and all six Bengaluru zones (`bgl-*`)
- **₹199:** Dwarka, Ghaziabad, Gurugram, Noida, Rohini, Vasant Kunj, East Delhi, Delhi NCR, Rest of India

**The ₹99 vs ₹199 split is the tell.** Higher-density, more mature Bengaluru and south-Delhi zones carry a lower minimum; thin suburban zones carry a higher one. A ₹99 minimum order value against a delivery cost that only works at volume is a **deliberate attempt to force basket-building**. It is also a direct admission that order density is not yet sufficient.

### Is hyperlocal compatible with pan-India reach? — **No, and Urvann proved it**

This is the strategic conclusion the founder needs most clearly.

**The Urvann farm-to-door model is structurally incompatible with national reach. It is not a matter of capital or execution — it is arithmetic.** The entire economic advantage comes from the farm being 6–10 km from the customer. Take that away and Urvann's cost structure collapses into exactly the freight-blemished model that makes Ugaoo-style D2C marginal:

- Every new city requires: land for a farm (1–2 acres), 6–18 months of horticultural establishment before stock is sellable, a full rider network from zero, and a fresh demand-generation budget.
- **There is no cross-city economies of scale in this model.** A parcel network gets cheaper per unit as it adds cities. An own-farm network gets _more_ expensive per unit, because every city is a standalone P&L.
- Urvann has had seed capital since 2022, an investor with expansion mandate, and a stated goal of "all Indian cities by 2025." **In four years they reached two metros.** That is not an execution failure — it is the model telling the truth about itself.

**What this means for the founder:** if your stated ambition is national pan-India reach, **Urvann's model is the wrong template.** It is a template for dominating _one or two dense cities superbly_. Urvann itself could not break out of it. Choosing hyperlocal means choosing depth over breadth, and you should make that trade explicitly rather than discovering it after three failed city launches.

The hybrid escape route — and it is worth considering — is **own-farm hyperlocal density in 2–3 metros + pan-India fulfilment for the long tail via partner nurseries and a courier rate card** (exactly what Urvann's Delhivery page and B2B seller programme gesture at). Urvann built the two halves but never connected them, which is why `rest-of-india` sits at a ₹199 minimum with no farm behind it.

---

## (e) PRODUCT AND SUBSCRIPTION

### **There is no subscription. At all.**

**Verified from their own production API:** `store_settings.enable_subscription_flow = 0` — the subscription module is **switched off** at platform level. There is no plant-of-the-month, no recurring produce box, no membership, no harvest box, no weekly or monthly cadence anywhere in the catalogue, navigation, or static pages.

This is a significant and under-appreciated finding, because **subscription is the standard answer to "how do you fix AOV economics in plant e-commerce"** — and the category leader has refused it entirely.

### What Urvann does instead — three substitutes

1. **Bundles and combos as the AOV lever.** "Indoor Plant Combo — The Breathe Better Bundle — Set of 5" at ₹549; "Flowering Plants Combo — Set of 3" at ₹399; "Tulsi Parampara Pack: Set of 2" at ₹109 (10,256 units — a genuine volume hero). Bundle-style SKUs, not subscription-style repeat behaviour.
2. **Affiliate / creator programme** (`/page/urvann-creators-program`, last updated 1 April 2026): apply via form → receive a unique code → **referrer gets 10% off, creator earns a flat 10% commission**, calculated monthly, **paid by the 7th of the following month**, to a bank account, on Net Payable Amount after discounts. One transaction per user. Contact: `affiliates@urvann.com`. This is a properly specified program — comparable to what a subscription would have cost them to build, and it drives acquisition rather than retention.
3. **Corporate/employee programmes:**
   - **Urvann GreenCorp** (`/page/urvann-green-corporate-scheme-urvann-greencorp-`): corporates onboard, employees get an org-specific discount code. **Free for the first 100 partners.** Contact `marketing@urvann.com`.
   - **Campus Ambassador programme** (`/page/urvann-campus-ambassador`).
   - The ₹38k–₹70k bulk SKUs ("50 Money Plants… for bulk corporate") are the monetised tail of this.

### Vs Bloomscape's exited subscription

|                     | **Urvann**                                                                                                   | **Bloomscape**                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| Subscription        | **None — module disabled**                                                                                   | Ran a monthly plant club; reportedly wound down     |
| Repeat mechanic     | Affiliate codes, combos, corporate codes                                                                     | Genuine recurring monthly delivery                  |
| Retention mechanism | None visible                                                                                                 | Recurring habit + curation surprise                 |
| Why it matters      | **No churn risk from cancellation complaints; no MRR; but no recurring-revenue base and no LTV compounding** | Failed on unit economics of a low-AOV recurring box |

**Honest read:** Urvann is **not "doing subscription better."** It avoided the question. Avoiding it is defensible for a business whose real bottleneck is _delivery density_, not repeat frequency — but it does mean Urvann has **no recurring revenue, no predictable base, and no LTV compounding**, and its economics rest entirely on transactional volume rather than on a compounding installed base — and that is precisely the trade a founder evaluating a subscription-based plant business should understand before copying it.
on transactional volume rather than on a compounding installed base — and that is precisely the trade a founder evaluating a subscription-based plant business should understand before copying it.

---

## (f) OPERATIONS — how the order actually gets to the door

### Fulfilment model: own farms _inside_ the city, third-party only where it cannot reach

Urvann is unusual in Indian plant commerce because it does **not** drop-ship from a distant nursery. First-party (`/page/how-urvann-delivers-plants`): _"All plants are grown and maintained at Urvann Farms, large nurseries located within the cities."_ The four named nurseries are **Gurgaon, Greater Noida, Rohini, Whitefield**, each **1–2 acres**, "collectively supporting over 50 lakh plants." [VERIFIED, first-party]

But own-farm is not the whole story, and the honest read is a **hybrid**:

- Own-farm supply covers the ~19 live core zones (11 NCR + 8 Bengaluru).
- **Everything outside those zones is third-party or courier.** The FAQ is explicit: _"We currently ship only to all addresses in Delhi NCR and Bangalore; however the delivery of select seeds, soils, and pots are available pan-India."_ And: _"Other products like pots or gardening accessories may be shipped beyond these core regions depending on logistics, but pan-India delivery is not officially guaranteed on all items."_
- The `rest-of-india` / `india` substores exist with a **₹199 minimum** and a live **Delhivery rate card** (`/page/rates-for-pan-india-shipping`, ₹25–₹119 per 500 g slab plus explicit RTO and DTO surcharges). That is the old parcel model, retained and degraded.
- A third-party **seller/marketplace layer** exists (Urvann Saathi app, seller T&C, `b2bstore` substore) for vendors Urvann does not stock itself.

**Verdict:** the moat is **own-farm, and only inside 19 zones across 2 metros.** Everything else is a conventional parcel business with the freight problems §(c) described. A founder reading "own farms" as a company-wide truth would be misled.

### Delivery SLA and timeslots

| Rule               | Detail                                                                                                                                                                                                                                                                                            | Source                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Cut-off            | Order before **7 PM** → next-day delivery; after 7 PM → day-after-next                                                                                                                                                                                                                            | [`/page/frequently-asked-questions`](https://www.urvann.com/page/frequently-asked-questions) |
| Stated reliability | "on time in **99% of orders**"                                                                                                                                                                                                                                                                    | same                                                                                         |
| Transit time       | "plants spend only **1–2 hours** in transit"                                                                                                                                                                                                                                                      | `/page/how-urvann-delivers-plants`                                                           |
| Same-day           | **Not offered as a product.** "For urgent delivery requests, customers may reach out to support and, _where possible_, the team will try to accommodate"                                                                                                                                          | FAQ                                                                                          |
| Shipping charge    | "**We offer free delivery on all orders. There are no shipping charges.**"                                                                                                                                                                                                                        | FAQ                                                                                          |
| Minimum order      | **₹99** (Greater Noida, Kalkaji, Uttam Nagar, HSR, all `bgl-*` zones) · **₹199** (Dwarka, Ghaziabad, Gurugram, Noida, Rohini, Vasant Kunj, East Delhi, Delhi NCR, Rest of India). One storefront page still says **"The minimum order value for Urvann is Rs 200"** — a third inconsistent figure | live config + [`/collection/70percent-off`](https://www.urvann.com/collection/70percent-off) |
| Order tracking     | Dedicated tracking site `urvanntracking.com`; in-app tracking; wallet refunds visible at `/account/wallet`                                                                                                                                                                                        | FAQ                                                                                          |

**Note the SLA is weaker than the marketing implies.** "Next day" is a _cut-off-based promise_, not a time window, and same-day is explicitly best-effort. There is **no published delivery timeslot** (no "10 AM–1 PM" band). For a founder modelling customer expectations, that matters: Urvann's SLA is materially softer than, say, Zepto or Swiggy Instamart, and its 1.4/5 complaint profile (§g) is consistent with a promise that is hard to keep.

### Packaging — and why "zero packaging" is not a marketing claim but a cost decision

This is the most important operational detail in the whole report, and it is verifiable in three independent places:

- Store description: _"Fresh, unpackaged plant delivery — Plants travel without traditional packaging, thus reducing stress and preserving health."_
- Play Store / App Store listing: _"Our **zero-packaging model** makes us environment-friendly and prevents your plants from damage!"_
- Return policy: **no packaging-return mechanic exists at all.** There is no reverse logistics, no bag return, no container deposit. The only return path is _"if your return is accepted, our logistics partner will pick up the product from your shipping address"_ — and that applies **only** to damaged or wrong items within 48 hours.

**This is the single biggest structural advantage Urvann has over every parcel-based competitor, and it is worth naming precisely:** there is nothing to return because there is nothing to pack. A ₹149 plant in a courier box needs a box (₹12–₹25), a courier slab (₹85–₹197), and a refund process for the damage it caused. An open EV two-wheeler carrying four 4" nursery bags needs none of it. The environmental claim and the cost claim are **the same fact**, and Urvann is honest to say it twice.

**Where the claim softens:** the "1–2 hour transit" justification only holds because the radius is small. The moment stock comes from a partner nursery outside the city, the packaging is back — and Urvann's pan-India pots/soil path uses Delhivery with full slab pricing and RTO exposure. **The eco advantage is zone-scoped, exactly like the delivery advantage.**

### Quality claims

| Claim                                                                                                                  | Verdict                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Plants picked fresh **the same morning**"                                                                             | Marketing. Consistent with next-day only                                                                                                                                            |
| "Each plant is nurtured by experts and undergoes a **quality check before dispatch**"                                  | No published QC standard, checklist, or rejection rate. [UNVERIFIED as an operational system]                                                                                       |
| "Plants are **sourced from across India and international suppliers**, then nurtured at Urvann Farms"                  | **Important and underplayed** — Urvann does not grow everything. Imported plant material plus 4–6 month nursery establishment before sale is the real supply lead time              |
| "**6,000+ plant varieties**" / "5,000+" / "10,000 SKUs live"                                                           | Three different numbers across FAQ, app listings and my API crawl. All "first-party", all inconsistent                                                                              |
| "Starting at **just ₹7**" (app listing) vs "from ₹29" (delivery page) vs "from ₹25" (Bangalore page) vs "starting ₹29" | **Four different entry prices.** The ₹7 is a 4" black plastic nursery pot — technically true, rhetorically misleading. An indie should note how much easier it is to be honest here |
| Replacements                                                                                                           | "we will replace it at no cost" for damaged/incorrect items, within **48 hours**; "Plant replacements are rare, as we take utmost care of plants"                                   | FAQ |

### Customer support — comprehensive on paper, failing in practice

This is where the first-party documentation is _best_ and the third-party evidence is _worst_, and the gap is the finding.

**What Urvann publishes** (all first-party, FAQ):

- Channels: **WhatsApp** (`wa.me/919599585773`) and **email** (`customersupport@urvann.com`), **10 AM–7 PM, all 7 days**, **English and Hindi**
- Escalation: `grievances@urvann.com`; "Urgent" in the subject/WhatsApp line; callbacks on request
- Case tracking: `urvanntracking.com`; every query logged "with resolution timestamps"
- Post-delivery check-ins offered; **partial replacements at no cost**
- Refunds: **store credit to Urvann wallet immediately**; source refund 6–7 business days

**What customers report:**

- Trustpilot **2.1/5 from 10 reviews** — _"Worst service by urvann and it's team they claim on website that any order before 7 pm today will be delivered next day positively. I ordered yesterday at 10 am now they are saying Cannot deliver. On top of that they don't have customer care"_ [Trustpilot](https://www.trustpilot.com/review/urvann.com)
- PissedConsumer **1.4/5 from 78 reviews** — recurring themes: _"abandonment after 35 days, fake delivery marking, false ne[gative]..."_, refunds not processed, support unresponsive. Sample: _"O have not received my order and no update it has been 4 days"_ [PissedConsumer](https://urvann.pissedconsumer.com/review.html)
- Justdial Delhi head office **3.6/5 from 58 ratings**; Justdial Bangalore store **4.7/5 from 557 ratings**

**Read:** the support _design_ is above category norm — 7-day availability, a named escalation mailbox, photo-based resolution, partial replacement. The _execution_ is not. And the most damning item is that the WhatsApp number is the same one published as the public phone number — **one business line, no dedicated support desk staffing disclosed, for a claimed 12–15 lakh customers.**

### Rider economics — derived from Urvann's OWN 3PL contract (the best find in this report)

Urvann's actual last-mile agreement was uploaded publicly and signed by founder Sambhav Jain. This converts §(c)'s derivation from guesswork into published fact. Source: [Urvann 3PL/Delivery Service Agreement, dated 20 Feb 2025, countersigned 4 Mar 2025, Service Provider: Gagan Saxena, governing law Delhi](https://www.scribd.com/document/910202875/Urvann-3PL-Agreement-2) — **[VERIFIED, primary document]**

| Term                      | Value                                                                                                 |
| ------------------------- | ----------------------------------------------------------------------------------------------------- |
| Structure                 | Urvann India Private Limited (Client) → third-party 3PL vendor (Service Provider), per-order delivery |
| Base payout               | **₹65 per order** within a **15 km** radius of pickup, + GST if applicable                            |
| Long distance             | **+ ₹15/order** above 15 km                                                                           |
| Weekend surcharge         | **+ ₹5/order** Sat & Sun                                                                              |
| Orders per trip           | **3–4 per bike trip**, "may increase from 3 to 4 based on performance and weekend demand"             |
| Weekly slabs              | ₹3,000 earned → **+₹200**; ₹2,600 → **+₹150**; ₹2,000 → **+₹100**                                     |
| Special-task incentive    | **₹65/order** on GMV **> ₹1,000** orders (highlighted by ops team)                                    |
| Training-period guarantee | **Weekly MG ₹4,200** for **6 days × 10 hours** (no MG on public/national holidays)                    |
| Billing                   | Data shared **weekly, every Tuesday**; payment subsequently                                           |
| Termination               | 7 days' notice for convenience; immediate for material breach                                         |

**Now do the arithmetic, using their published rate instead of my estimate:**

- **Rider payout per order: ₹65–₹85.** Against my derived realised AOV of ₹200–₹260, **last-mile payout alone is 25–43% of revenue.** That is the real cost-to-serve, and it is materially _higher_ than my §(c) estimate of ₹7–₹18, because ₹65 covers rider labour, not just vehicle opex.
- **Rider daily earnings.** During training: ₹4,200/week for 6 × 10-hour days ≈ **₹700/day guaranteed**. Mature, per-order: at 3–4 orders/trip and a plausible 6–8 trips in a 10-hour day = **20–32 orders/day × ₹65 ≈ ₹1,300–₹2,080/day (₹34k–₹54k/month gross, before fuel/charge/vehicle).** That upper figure is implausibly high; the honest band is **₹700–₹1,400/day, i.e. roughly ₹18k–₹36k/month gross.** `[Derived from the ₹65/order and ₹4,200-weekly-MG terms — not disclosed by Urvann.]`
- **Cost per km is not derivable** — the contract prices per _order_ within a _radius_, never per km. This is itself revealing: Urvann's vendor is paid by order, not by distance, which only works because a trip carries 3–4 orders. **You cannot price this model by km; you can only price it by order density.**
- **Cost-to-serve floor: ₹65/order.** Add pick-and-pack labour, farm overhead, and ~₹149–₹329 COGS, and a **30–40% gross margin is the arithmetic ceiling** — which is _why_ the ₹99/₹199 minimum order values exist. Those thresholds are not aspiration; they are what ₹65/order plus COGS demands.

### The penalties clause is a smoking gun — read it carefully

Clause 6 of Urvann's own contract states:

> _"Cases where order is marked wrongly delivered (Order not delivered by partner but fake information provided as delivered) then there will be a penalty equivalent to product cost and ₹100 per order."_

**Urvann has written into a supplier contract that fake delivery marking is a known, expected failure mode in its network.** It also penalises pending orders at ₹100, wrong-customer deliveries at product cost + ₹100, and rider-behaviour escalation at **₹1,000 per incident** against the vendor.

This is the single most valuable sentence in this report. It explains, mechanistically, the exact complaint cluster on PissedConsumer and Trustpilot — _"order marked delivered but not received"_ — and it shows that Urvann's own operations team knows the problem and is trying to price it out. **It is also the failure mode that kills the hyperlocal model: a ₹65 payout plus a ₹100 penalty means the vendor is financially indifferent between delivering the plant and tapping "delivered."** For a founder designing a rider incentive scheme, that is the trap to avoid.

**Correction to §(e): there _is_ a membership product.** The API flag `enable_subscription_flow = 0` is accurate for the _platform_, but Urvann sells a **1-Year Urvann Premium Membership Card at ₹365** (₹1/day) giving ₹500 instant loyalty points, flat **20% off on every order above ₹1,000** for 365 days, unlimited use, cashback to wallet up to a further 10%, early sale access and a members' community. **120 sold, 4.9/5 from 119 reviews** ([product page](https://www.urvann.com/product/1-year-urvann-premium-membership-card-get-inr-500-loyalty-points-flat-20percent-off-and-15percent-cashback-on-all-orders-rs-1-per-day-for-365-days-)). Note what it is: **a discount pass, not a recurring product delivery.** It monetises existing demand without committing to shipping anything every month. §(e)'s conclusion stands, but its scope should be read as "no recurring _delivery_ subscription," not "no membership."

---

## (g) TRUST AND MARKETING

### App-store ratings — pulled live, both platforms

| Platform                             | Rating   | Count                                     | Notes                                                                                                                                                                                                                                                                      |
| ------------------------------------ | -------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Google Play (`com.urvann`)**       | **4.71** | **2,497 ratings / 2,356 written reviews** | ~**136,400 real installs** ("100,000+" bucket). **Last update 9 Oct 2025 — twelve months stale** as of 4 Oct 2026. "Varies with device" version. Support hours stated as 9 AM–7 PM here vs 10 AM–7 PM on the website — **an inconsistency in the customer-facing surface** |
| **Apple App Store (`id6743162874`)** | **4.1**  | **518 ratings**                           | Published **~Nov 2024** (a much newer listing than the Android app's history implies). An earlier cached listing showed **454 ratings / 4.0**, so it is drifting **upward** — the iOS audience is small but positive                                                       |
| **Urvann Saathi** (seller, Play)     | **3.05** | 20 ratings / 10 reviews                   | 11,700 installs, **v2.1.0 updated 4 Sep 2026** — actively maintained                                                                                                                                                                                                       |
| **Urvann Raahi** (rider, Play)       | **4.17** | 24 ratings                                | **3,816 installs**, released 22 Oct 2024. Also on iOS (`id6747331111`)                                                                                                                                                                                                     |

[All four rows VERIFIED — pulled live 4 Oct 2026 via the Google Play and Apple App Store listing endpoints, not via search snippets.]

**Which platform is stronger?** **Google Play, decisively** — 2,497 ratings vs 518, and 4.71 vs 4.1. That matches the market: Android holds ~95%+ of Indian smartphone share, and an app rated 4.7 on Play is a _genuine_ asset, not a vanity number. **But read the update date, because it is the real signal: a 4.7 that was last touched in October 2025 on a stale app, held against a live 2.1/1.4 on Trustpilot and PissedConsumer, is the signature of an acquisition funnel that is still converting and a service operation that is not.**

**The rider app install count is a real finding.** Urvann Raahi has **3,816 installs** against a claimed **500+ riders**. Even accounting for install-once-per-device, shift turnover, and multi-device sharing, **500 riders should not produce only ~4,000 lifetime installs.** Either the rider app is used by a small core of salaried/lead riders and the rest are served by vendor-side tools, or **the 500-rider fleet figure is inflated.** Both possibilities undermine the same marketing number. `[Derived from published install counts — not disclosed by Urvann.]`

### Social presence

| Channel       | Handle                                                   | Figure                               | Source                                                                                        |
| ------------- | -------------------------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------- |
| **YouTube**   | [Urvann Academy](https://www.youtube.com/@UrvannAcademy) | **34.4K subscribers, 1,400+ videos** | Live channel page, 4 Oct 2026 — **[VERIFIED]**                                                |
| **Instagram** | [@urvann.india](https://www.instagram.com/urvann.india)  | **~95.6K followers**                 | [The Electric Eel](https://theelectriceel.in/urvann/) — **[ANECDOTAL, third-party, undated]** |
| **LinkedIn**  | Urvann                                                   | **~7K followers**                    | The Electric Eel — [ANECDOTAL]                                                                |
| **Facebook**  | Group `217942056914835`                                  | —                                    | Linked from footer; membership community hub                                                  |
| **Pinterest** | `Urvann_India`                                           | —                                    | Linked from footer                                                                            |

**Read:** a 34.4K-subscriber, 1,400-video YouTube channel run by a self-titled "Chief Gardening Officer" is **real, sustained content distribution** — and it is by far the most under-rated asset in the business. It costs nothing to run, requires no logistics, and it is the acquisition channel that a ₹10–25 Cr business with ~US$380K total funding could actually afford. **This is the most copyable thing Urvann does.** Instagram at ~95K followers is directionally consistent with a brand of this size. `[Instagram figure is third-party and undated — treat as ±20%.]`

### Press coverage — real outlets, but note the last item

| Date            | Outlet                                                                                                                   | Substance                                                                                                                                                                                                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Jun 2022        | **YourStory**, **Entrepreneur India**, **Economic Times**, **Moneycontrol**, **Inc42**, IndianStartupNews, TheStartupLab | Seed round ₹3 Cr, IPV. Miteh Shah quoted                                                                                                                                                                                                                                                    |
| Jun 2023        | **Entrepreneur India**, **Inc42**, IndianWeb2                                                                            | Pre-Series A, IPV-led, amount undisclosed                                                                                                                                                                                                                                                   |
| **18 Aug 2025** | **The Tribune (VMPL)**, syndicated to **The Week**, **Bharat Kibaat**                                                    | Founder story: KPMG/Deloitte → plants. _"Zero wastage, zero compromise"_, "200+ member organization", "**9 cities and 350+ pin codes**", "**200+ electric vehicle fleet**", "saved **350,000 kg** of plastic waste", "conserved **50,000 litres** of fuel", "$3 billion market at 15% CAGR" |

**The Tribune piece must be read with the disclosure printed at the foot of the article: `(ADVERTORIAL DISCLOSURE)`**. It is a paid founder-story, not independent journalism. That does not make its numbers false — but it means **"9 cities and 350+ pin codes" and "200+ members" are marketing-supplied figures**, and they flatly contradict the first-party evidence:

- §(a) LinkedIn headcount: **44 employees**
- §(d) Live substore data: **2 metros, 19 active zones**, empty substores for Mumbai, Pune, Ahmedabad, Hyderabad, Kolkata, Chandigarh
- Delivery page: **4 nurseries, 500+ riders**

**Urvann's own paid advertorial overstates its footprint by roughly 4× headcount and 4.5× city count versus its own configuration data.** For a founder, that is the correct default assumption about advertorial metrics in this category: **weight configuration data and lifetime order counters far above anything published in sponsored press.**

### Positioning language (verbatim, first-party)

- **"India's largest online plant nursery"** — `/page/about-us`
- **"India's No.1 online plant store by owning the entire supply chain, from nursery to doorstep"** — FAQ
- **"Green at the speed of light"** — Tribune advertorial
- **"Zero wastage, zero compromise"** — Tribune advertorial
- **"Honest Prices, No Middlemen"** / _"priced at the lowest you will find"_ — `/page/about-us`
- **"Direct-to-customer model (no middlemen) — better prices and fresher plants every time"**
- **"Fresh, unpackaged plant delivery"** / **"zero-packaging model"**
- **"100% EV-based delivery system"**
- **"The first online platform in India that provides next-day delivery of plants"**

**Note the internal contradiction a founder should exploit and not repeat:** "Honest Prices / priced at the lowest you will find" sits next to a catalogue where **100% of 10,000 SKUs carry a populated discount field and hero plants run 50–65% off, near-permanently** (§b). That is not a business model — it is permanent discounting presented as price integrity. Urvann is, structurally, a **high-discount volume retailer** wearing an "honest prices" label.

### Sustainability and farm claims

| Claim                                                                   | Verdict                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Zero plastic packaging**                                              | **VERIFIED and substantiated** by the absence of any packaging-return mechanic in the return policy. Genuine                                                                                                                                                                                                                                                                                                                                                                                                |
| **100% EV fleet**                                                       | Claimed on the delivery page and app listings. Internally consistent (200 EV in advertorial vs 500+ riders — **the rider count is the weak number**)                                                                                                                                                                                                                                                                                                                                                        |
| **350,000 kg plastic waste saved / 50,000 litres fuel conserved**       | **[UNVERIFIED]** — advertorial-supplied, no methodology, no third-party audit. Plausible direction, unauditable magnitude                                                                                                                                                                                                                                                                                                                                                                                   |
| **Own farms, 4 nurseries, 1–2 acres each, "supporting 50 lakh plants"** | Locations VERIFIED first-party; "50 lakh plants" is a capacity claim with no basis published. **50 lakh plants in 4–8 acres of nursery is agronomically implausible** — a mature high-density polyhouse nursery holds tens of thousands of plants per acre, and a ₹69 Jade plant in a 4" bag occupies ~0.02 m² of bench. **Treat "50 lakh" as at least an order of magnitude inflated.** `[Derived by area arithmetic — no external nursery source consulted, so stated as a strong inference, not proof.]` |
| **4,000 kg plastic-free**                                               | Does not appear anywhere. **No third-party sustainability certification of any kind was found** — no organic, ISO, GOTS, or environmental audit                                                                                                                                                                                                                                                                                                                                                             |

**Net:** the sustainability story is **directionally true and structurally real** (zero packaging is verified by policy, not just claimed) but **quantitatively unverifiable**. It is a genuine differentiator in Indian plant commerce and it costs Urvann nothing to tell, because it is a consequence of the model rather than a purchased offset. That is the good kind of ESG claim.

### Published customer counts — five numbers, no two agree

| Claim                                      | Where                           | Reconciles with §(c) data?                                                    |
| ------------------------------------------ | ------------------------------- | ----------------------------------------------------------------------------- |
| **"1 crore+ plants delivered to date"**    | About page                      | ✅ **Closest to my crawl** (~1.96M units; API window partial)                 |
| **"50 lakh plants delivered"**             | Delivery page                   | Same figure, unit confusion between plants and units                          |
| **"15 lakh+ happy customers"**             | About page                      | ❌ Implies 1.3 units/customer lifetime — **implausible for a plant business** |
| **"12+ lakh customers served"**            | Delivery page                   | Softened version of the same unverifiable claim                               |
| **"2,00,000+ plants delivered pan-India"** | Paudhewale's site, not Urvann's | —                                                                             |

**Every Urvann customer-count claim is unreconcilable with its own order database.** The honest read stands: **~1–2 crore lifetime units, ~₹14.85 crore lifetime value (floor), ~600–1,200 units/day run-rate.** Publish any customer number and Urvann's own API contradicts it.

---

## (h) BUSINESS MODEL CRITIQUE — is this profitable?

### The published financials say no. This is verifiable, and it is the headline.

[Inc42 financials, sourced from MCA-linked filings](https://inc42.com/company/urvann/financials/): **[VERIFIED, third-party filing-derived]**

| Metric               | FY25            | YoY                             |
| -------------------- | --------------- | ------------------------------- |
| **Total revenue**    | **₹16.7 crore** | **+54.31%** (FY24: ₹10.8 crore) |
| **Total expenses**   | **₹17.1 crore** | +57%                            |
| **Profit after tax** | **−₹41.1 lakh** | **−586%**                       |

**Read this carefully, because the shape matters more than the level:**

1. **Revenue is growing fast — 54% year on year.** This is _not_ a dying business. The catalogue is maintained daily, SKUs are created weekly, two internal apps shipped in September 2026. Growth is real.
2. **Expenses are growing faster than revenue (+57% vs +54%).** The gap between those two numbers is the entire loss. Urvann is **spending ahead of its growth**, which is what a company chasing delivery density looks like.
3. **The loss is small relative to revenue — −₹41.1 lakh on ₹16.7 crore is a −2.5% net margin.** **This is a near-breakeven business, not a catastrophe.** That is a genuinely different and much more hopeful diagnosis than the 2.1/5 Trustpilot score implies.
4. **But funded capital is exhausted.** ~US$380K raised across 2022–23, nothing since, three years self-funding. ₹7.66 lakh paid-up capital. The business is now paying for its own density out of a −₹41 lakh P&L, and it has been for three years.

**Cross-check against §c:** my API-derived lifetime sales value was ~₹14.85 crore against FY25 revenue of ₹16.7 crore. A company doing ₹16.7 Cr/year should have cumulative lifetime GMV well above ₹14.85 Cr over 4.5 years — **unless the `total_sales_amount` counters materially under-count.** This is the strongest evidence that **the lifetime counters under-report and that my run-rate estimate in §(c) is a floor that is too low, not too high.** I am flagging this against my own earlier conclusion: _the database may under-count, and I cannot reconcile ₹14.85 Cr lifetime against ₹16.7 Cr in a single year._ Treat the ~600–1,200 units/day figure as **understated**, and the "50,000/day" claim as **still implausible** — but the gap between them is now plausibly ~10× rather than ~40×.

**Corrected bottom line on §(c) headline #3:** revenue is ₹16.7 Cr (FY25), not the ₹10–25 Cr band I estimated, and the business is roughly **breakeven-to-slightly-loss-making**, not structurally broken.

### The grocery-delivery failure mode — Urvann is living it, and the contract proves the mechanism

Section (g) documented the symptoms. Section (f) documented the cause. Put together, this is textbook **hyperlocal grocery failure**, in the specific sequence the model produces:

1. **Set free delivery and a low minimum order** — required to compete, because every parcel competitor must charge ₹60–₹150 that Urvann doesn't.
2. **That forces basket-building to a ₹99–₹199 floor**, which caps order density, which caps rider utilisation.
3. **Riders are paid ₹65/order regardless of distance**, so the only variable is _how many orders ops can load onto a trip._ Under that incentive, **marking an order delivered without delivering it is the cheapest available action** — the 3PL contract penalises it at product cost + ₹100, but the alternative is spending 20 minutes on a plant that may then die in transit and generate a refund anyway.
4. **Plants cannot be returned for preference and refunds default to wallet store credit**, so a dissatisfied customer gets a coupon, not money — which suppresses the loudest complaints and starves the business of the signal it needs.
5. **Service degrades, review scores crater (1.4/5), and support becomes the bottleneck** — while the company keeps spending on density and keeps growing revenue 54% YoY.

**This is not a Urvann-specific failure. It is what happens when a low-AOV, perishable, non-returnable, cash-on-delivery-heavy category is served by a per-order-paid fleet.** Urvann did nothing wrong that is uniquely avoidable — they simply executed the model faithfully and the model bit.

**What is NOT published, stated plainly:** no burn rate, no cash balance, no CAC, no contribution margin per order, no rider count reconciliation, no investor communication since June 2023, no D2C brand has published these for this business. **Any confident claim about Urvann's burn or LTV/CAC is fabrication.** What is published is a −₹41.1 lakh PAT on ₹16.7 crore of revenue, which is the most useful number available and is enough to act on.

### Verdict: what this means for a small new entrant in the category

**The honest answer is that a well-capitalised hyperlocal network operator already in the category is a _distribution_ problem for you, not a capital problem, and the good news and bad news are the same fact.**

**The bad news:**

- Urvann has spent **four years and ~₹5 crore** to build what you could build for ₹15–25 lakh: one 1–2 acre nursery inside a dense zip, a WhatsApp number, a Mystore storefront (they use **off-the-shelf SaaS** — no technology moat exists), and a rider app. **There is no technical, capital, or supply barrier here.**
- The honest structural barrier is **demand density in a specific zip code**, and it takes 12–18 months of compounding to reach. You cannot shortcut it, and Urvann's own 9-failed-city history proves the shortcut doesn't exist.
- Their catalogue is 10,000+ SKUs with a 50–65%-off pricing floor you cannot win on price.

**The good news — and this is the actionable part:**

- **Urvann is a −2.5%-net-margin business that has not raised since June 2023.** It is **survivable, not impregnable.** A cash-generative small operator can out-compete a nominally larger one on service, which is exactly where their customers are actually unhappy.
- **Their service failure is publicly documented, specific, and expensive to them.** Trustpilot 2.1, PissedConsumer 1.4 across 78 reviews, Justdial Delhi 3.6. **That is a permanent, unfilled position in the market.** Nobody in Indian plant e-commerce owns "it actually arrives, and someone answers."
- **Free delivery has become table stakes, so you must price above it anyway — but their ₹65/order payout and ₹99/₹199 minimum are a published floor for what delivery costs in this model.** You now know the cost-to-serve number rather than guessing it. That is a gift.
- **Their four operational assets are copyable in weeks:** the seasonal taxonomy (`summer/monsoon/perennial`), the bundle-as-AOV-lever, the 34K-subscriber YouTube content engine, and the zero-packaging model.

**The verdict, plainly:** _Do not compete with Urvann on plants, on price, or on range. Compete on reliability and on being a specialist in something other than plants._ Urvann's structural weakness is that it is a **generalist garden retailer forced into a logistics business** — its own catalogue proves it: ~30% of 10,000 SKUs are plastic pots, because plants alone cannot fill a delivery run. **A ₹149 plant is a loss leader that exists to sell a ₹329 cocopeat bag.** A specialist who solves _one_ basket problem completely — pre-booked weekly plant-plus-consumable refills for a single apartment community, priced above their minimum, fulfilled on a fixed weekly route — takes the one segment where their economics fail and their service fails hardest, without fighting them on anything.

---

## (i) COMPARISON TO THE SET

| Player                                                                | Model                                         | Geography                       | Scale                                           | Relationship to Urvann                                                                                                                                                                                                                           |
| --------------------------------------------------------------------- | --------------------------------------------- | ------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Ugaoo**                                                             | Own-farm (Pune) + pan-India parcel            | Pune-centric, national shipping | ₹47 Cr+ raised, far larger                      | **Closest structural analogue, opposite geography.** Same "own farm + D2C" logic, but sells to _all of India_ — so it lives with the freight problem Urvann escaped. Urvann is the **hyperlocal extreme**; Ugaoo is the **parcel-first extreme** |
| **FNP / IGP**                                                         | Marketplace + B2B gifting, partner fulfilment | Pan-India                       | Incumbent, event-driven                         | **Different business (B2B gifting, no live-plant logistics moat). Not a competitor for plant retail.** Relevant only as a corporate-gifting channel comparison                                                                                   |
| **Plantara**                                                          | Nutrition/food, different category            | —                               | Micro                                           | **Unrelated.** Not a plant retailer                                                                                                                                                                                                              |
| **Paudhewale**                                                        | Marketplace of "100+ verified sellers," Patna | Pan-India, Tier-2               | Micro (1–10 employees, 2023/24)                 | **Not a competitor — a cautionary mirror.** It claims "2,00,000+ plants delivered pan-India" with the same unverifiable counter Urvann uses, and has no farm at all                                                                              |
| **Kyari**                                                             | Plant-based lifestyle D2C, Indore             | Pan-India + quick commerce      | ₹20 Cr+ revenue, PAT-**profitable**, Shark Tank | **The profitability benchmark.** Kyari sells _products around_ plants (home décor, lifestyle) at a ₹399 median AOV — **an AOV Urvann cannot reach with live plants.** Kyari is the answer to the exact problem §(b) identifies                   |
| **US players** (Bloomscape, The Sill, Seedling, Gardyn, Lettuce Grow) | Parcel/subscription, DTC, marketplace         | US                              | Scaled, mostly venture-funded                   | **Same freight economics, worse.** US parcel rates are 3–5× India's; the hyperlocal workaround exists in the US as farm-to-door subscription, which is why Gardyn/Lettuce Grow pivot toward **hardware + consumables** rather than plants        |

### Is Urvann a competitor, a model, or a cautionary tale?

**All three, in different time horizons — which is exactly why this report is worth reading.**

- **A model, for the founder.** The own-farm + zero-packaging + next-day-free loop is the only genuinely correct structural answer I have found to the inter-state freight problem in Indian live-plant commerce. Urvann's own data proves it works: **₹16.7 Cr revenue and 54% YoY growth on a ₹99 AOV**, in a category where freight alone can exceed product price.
- **A cautionary tale, for the founder.** Because the same loop's _service layer_ failed so completely (2.1/5, 1.4/5, an unenforced fake-delivery penalty clause) that **the trust cost now exceeds the freight saving.** The lesson is not "don't do hyperlocal" — it is **"hyperlocal raises the delivery-quality stakes, and live plants cannot absorb a failed delivery."**
- **A competitor, but a local and beatable one.** Two metros, 19 live zones, 44 employees, no round since 2023. **If you launch in a Delhi NCR or Bengaluru zip, you are in its 1–2 km radius and you will feel it.** If you launch anywhere else — including all of Tier-2 India, where Paudhewale and its ilk operate unopposed — Urvann is not present and never has been.

### What hyperlocal same-day does to the inter-state freight problem — the core structural insight

**This is the most important thing in this entire comparison, and it should drive the founder's whole strategy.**

The generic D2C plant model (Ugaoo, and the default assumption behind most plant-e-commerce plans) is **structurally marginal** for live plants, and the reason is arithmetic, already shown in §(c):

- A 4" nursery bag is 0.5–1.5 kg of wet soil and clay. Freight runs ₹40–₹119 for the first 500 g, plus ₹23–₹39 per additional 500 g. **A 2 kg plant ships at ₹85–₹197 against a ₹109–₹369 product** — freight is **30–70% of realised price before RTO**, and RTO adds ₹23–₹110 per 500 g.
- Add a **3–7 day transit damage window** on a living good, and a failed delivery is close to **pure loss**.
- Fix it with packaging (a rigid ventilated box costs ₹25–₹60 and still damages plants over 3 days), or with price (₹60–₹150 delivery on a ₹149 AOV = a 40–100% surcharge that kills conversion), or with a high enough AOV to absorb it.

**Urvann's own-farm model deletes every one of those terms at once.** Farm 6–10 km away → **no parcel, no courier, no RTO charge, no volumetric dead-weight, no transit damage window, no box.** That is not a marginal improvement; it removes the entire cost category that makes generic plant D2C unviable. **And the zero-packaging model is only possible _because_ the distance is short** — you cannot ride a 3-wheeler through a Sec-45 colony holding a live jade plant in a ventilated box for 4 days, and you don't need to.

**But the hyperlocal model replaces the freight problem with a density problem, and density does not travel.** Every new city needs 1–2 acres of land, 6–18 months of horticulture before stock is sellable, a rider network from zero, and a demand budget. **There are no cross-city economies of scale: a parcel network gets cheaper per unit as it adds cities; an own-farm network gets more expensive per unit, because every city is a standalone P&L.** Urvann proved this — seeded in 2022 with an investor holding an expansion mandate and a stated goal of "all Indian cities by 2025," they reached **two metros in four years**, with empty substores left behind for Mumbai, Pune, Ahmedabad, Hyderabad, Kolkata and Chandigarh.

**Therefore the strategic conclusion for the founder, stated once and plainly:**

> **Choose deliberately between a high-AOV, low-volume, pan-India model (accept 30–70% freight, own the freight problem, and need ₹800–₹1,500 AOV to survive it) or a low-AOV, high-density, one-city model (eliminate freight entirely, and accept that you will never be national).** Do not try to do both with one fulfilment network — Urvann built both halves, connected neither, and is now paying for `rest-of-india` with a ₹199 minimum order and no farm behind it.

**If you want both, the only version that works is the one Urvann gestured at and never finished:** own-farm hyperlocal density in **one or two** metros, plus pan-India _non-perishable_ adjuncts (pots, soil, tools, seeds — Urvann already ships these by courier) fulfilled by a courier rate card, while live plants stay strictly hyperlocal. The pots subsidise the delivery run. **The plants are the loss leader; the pots are the business.** That is why Urvann's catalogue is 30% plastic planters, and why it is worth understanding the catalogue mix rather than admiring the plant selection.

---

## (j) TEN OBSERVATIONS TO COPY OR BEAT

1. **COPY — the zero-packaging, farm-within-the-city model.** Not a slogan: a structural removal of freight, RTO, transit damage and packaging cost all at once. **Beat it** by publishing the measured number (₹ saved, kg of plastic avoided, % of orders delivered unpackaged) instead of leaving it as a claim — Urvann says "350,000 kg" in a paid advertorial and nowhere else.
2. **BEAT — the customer service layer.** This is Urvann's decisive, permanent, unfilled weakness: 2.1/5 Trustpilot, 1.4/5 PissedConsumer across 78 reviews, a 3.6/5 Justdial, and a 3PL contract that has to write a ₹100 penalty for _fake delivery marking_. **A published on-time rate per pin code, a public refund SLA in hours, and a WhatsApp answered in under 5 minutes is a competitive weapon, not a nicety.** In this category right now it is the entire game.
3. **COPY — the seasonal catalogue taxonomy.** `summer-plants` (4,529 SKUs), `monsoon-plants` (4,036), `perennial-plants` (3,653), plus facets for indoor/outdoor, pet-safe, air-purifying, lucky plants, and by location. **No generic marketplace would design this; a plant-native merchandising team did.** It is free to copy and it makes a 10,000-SKU catalogue navigable.
4. **BEAT — price integrity.** Urvann claims "Honest Prices, No Middlemen / priced at the lowest you will find" while **100% of 10,000 SKUs carry a discount field and hero plants run 50–65% off, near-permanently.** An indie with genuinely low markups and an honest price-claim is a _structural_ contrast to the category leader. Four different entry prices across four pages (₹7 / ₹25 / ₹29) is a small thing that reveals a lot.
5. **COPY — bundles as the AOV lever, in place of subscription.** "Breathe Better" Set of 5 at ₹549, flowering combos at ₹399, Tulsi Parampara Set of 2 at ₹109 with 10,256 units sold. **Bundling raises basket value without a recurring-delivery commitment**, and it is what actually solved Urvann's AOV problem. **Beat it** by building bundles around _outcomes_ ("Balcony in a box", "Wedding return-gift set") rather than plant counts.
6. **COPY — the ₹365 membership discount pass.** ₹500 instant wallet points, flat 20% off above ₹1,000 for 365 days, cashback to wallet, unlimited use — **120 sold at 4.9/5.** It monetises existing demand and commits Urvann to shipping nothing. **Beat it** by attaching it to a genuinely scheduled service (a monthly repotting/health check, a seasonal planting calendar) so it creates the recurring revenue Bloomscape failed to build, without inheriting their per-box logistics.
7. **COPY — the YouTube content engine.** **34.4K subscribers and 1,400+ videos** from a founder who is a CA and IIM-A MBA, self-titled "Chief Gardening Officer," with 150+ corporate workshops already delivered for Google, D. E. Shaw, Coursera and Khaitan & Co. **This is the highest-ROI asset in the business: zero logistics cost, permanent search shelf-life, and a founder-led authenticity story a funded competitor cannot cheaply copy.** His existing workshop and corporate client list is a warm B2B pipeline most D2C founders do not have.
8. **COPY — the B2B corporate line nobody else bothers with.** Urvann GreenCorp (free for the first 100 partners, org-specific discount codes), bulk SKUs from ₹37,999 to ₹69,999, a minimum-50 bulk gifting collection, and a Campus Ambassador programme. **Corporate gifting has better order sizes, predictable cadence, and no discount pressure** — it is the natural cure for the low-AOV trap.
9. **BEAT — do not use per-order-paid riders with no distance weighting.** Urvann's own contract pays ₹65/order within 15 km, ₹80 above it, ₹85 at weekends, 3–4 orders per trip — and must penalise fake delivery marking at ₹100 because it knows the incentive is wrong. **Beat it** with per-trip-plus-per-km hybrid pay, a customer-visible delivery photo as the close-out action (not a rider button), and a refund SLA. **If you take one operational lesson from this file, take this one: your delivery cost is knowable, their ₹65 is your benchmark, and their fake-delivery clause is the mistake to avoid.**
10. **BEAT — trust accounting, honestly, in public.** Urvann's numbers do not reconcile: ~₹14.85 Cr lifetime GMV in its own API against ₹16.7 Cr of FY25 revenue; ~1.3 units per lifetime customer against a 17,637-unit hero SKU; 500 claimed riders against a rider app with 3,816 installs; 44 employees and 2 metros against an advertorial's "200+ members, 9 cities, 350+ pin codes"; four nursery locations against an About page listing eight; ₹99/₹199/₹200 minimum order values; ₹7/₹25/₹29 entry prices; 6,000/5,000/10,000 variety counts; support open 9 AM (app) or 10 AM (site); "4.8/5 by thousands of verified buyers" against 2.1 and 1.4 on the platforms where unhappy customers actually write. **For a small entrant, consistency is a genuine competitive weapon.** Publish the catalogue size, the per-pin-code on-time rate, the return rate, and the refund time. Urvann's operational data is better than its communications; do the reverse.

---

## APPENDIX: CLAIMS I COULD NOT VERIFY

Stated plainly, with no inference dressed up as fact.

**Ownership / governance**

- Whether **Inflection Point Ventures still holds a majority or any controlling stake.** No cap table is publicly available; Inc42's captable page did not resolve. The company's ability to self-fund for three years implies a small shareholder base, but the actual split is **[UNVERIFIED]**.
- Whether IPV has been **actively distressed** about the −₹41.1 lakh FY25 result, or has simply disengaged. **[UNVERIFIED — and unknowable from public sources.]**
- Any founder salary, ESOP pool, or promoter loan. **[UNVERIFIED.]**

**Financials**

- **Burn rate, cash balance, and current profitability for FY26.** Only FY25 (₹16.7 Cr revenue, −₹41.1 lakh PAT) is available. FY26 has no published financials. **[UNVERIFIED.]**
- **Contribution margin per order.** No COGS split, no gross margin, no CAC, no repeat-rate, no cohort data. The "Gross Margin 11.19%" figure on Tofler (§c) is ambiguous — percentage or multiple — and I do not trust it.
- **The gap between ₹14.85 Cr lifetime API GMV and ₹16.7 Cr single-year revenue.** I could not audit `total_sales_amount` against payment records. **My §(c) run-rate estimate is therefore probably too low, and I flag that against my own conclusion.**

**Operations**

- **The number of actual farms and their real output.** Two first-party pages disagree (4 vs 8); "50 lakh plants" on 4–8 acres is implausible by area arithmetic; the About page's own count is contradicted by 11 live substores for 4 named nurseries.
- **The real rider count.** The "500+" claim is unreconciled with a rider app showing 3,816 lifetime installs, and with a 3PL contract that contracts with _one_ vendor (Gagan Saxena, Uttar Pradesh) — implying some or all of the fleet is outsourced, which conflicts with "500+ delivery riders."
- **Whether Urvann owns any vehicles or every rider self-owns.** "100% EV fleet" and "200+ EV fleet" cannot both be literally true of 500 riders.
- **QC standard, rejection rate, mortality rate, and repotting/plant-replacement cost.** No operational disclosure of any kind.
- **Same-city farm-to-zone mapping.** I could not determine which farm serves which of the 19 zones, nor the real delivery radius.

**Customers**

- **Every published customer-count claim** (15 lakh / 12 lakh / 1 crore / 50 lakh). All irreconcilable with the order database.
- **The "4.8/5 by thousands of verified buyers" claim** and the platform-identity question behind it — **which platform do those thousands of ratings come from?** Play Store's 2,497 ratings are plausibly "thousands" but are 4.71, not 4.8. **I could not verify the claim.**
- **Total active users, repeat-purchase rate, and cohort retention.** Never disclosed.
- **The Instagram follower figure (~95.6K)** is third-party and undated; Instagram blocks direct verification without a login. **[ANECDOTAL, ±20%.]**
- **Whether the Plant Lover Reviews page testimonials are genuine and unfiltered.** They are all 5-star with first names, paired with uniform screenshots, and the page claims "all reviews are from real customers after successful delivery" — which is a curation claim, not a verification claim. **Curated first-party social proof; treat as marketing.** [ANECDOTAL]

**Sustainability**

- **350,000 kg plastic saved, 50,000 litres fuel conserved, "zero wastage."** Advertorial-supplied, unaudited, no methodology.
- **Any third-party sustainability certification.** None found — no organic, ISO, or environmental audit of any kind.

**Competitive / strategic**

- **Whether Urvann's real footprint is 2 cities or 9.** The config data says 2; the paid advertorial says 9 cities / 350+ pin codes. **Config data is the more reliable source, but this is an inference, not a disclosure.**
- **Any relationship between the project directory name `upvvan` and Urvann.** See the note below — **there is none. Coincidence.**

---

## NOTE ON THE PROJECT NAME — "upvvan"

**The directory is `/Users/princesharma74/Documents/Development/upvvan`. It bears no relation whatsoever to Urvann.** Stated plainly because the resemblance is close enough to be worth ruling out:

- It is **not Urvann's name, not Urvann's entity, not Urvann's domain.** Urvann is `urvann.com` / Urvann India Private Limited / CIN U74999DL2021PTC383300 / New Rajinder Nagar, Delhi.
- The directory contains **nine research files, none of which is about Urvann except this one** — `ugaoo.md`, `fnp-and-igp-gifting.md`, `global-plant-dtc-leaders.md`, `india-compliance-and-licensing.md`, `india-plant-shipping-and-ops.md`, `indian-plant-dtc-playbooks.md`, `kyari.md`, `upvanagro.md`, plus `urvann.md`. It also contains a `strip.py` HTML-text utility used to scrape storefronts.
- **The most likely explanation is a typo of "Upvan"** — the subject of `upvanagro.md` (UPVAN, a brand of Upvan Oxytech LLP, New Delhi, live Shopify storefront, founded January 2026). `upvvan` is `upvan` with a doubled v. **Pure coincidence, and if anything an amusing one — the doubled v in `upvvan` is closer to Urvann than to Upvan.**

**One thing worth flagging as a live risk, though:** `upvanagro.md` line 248 classifies Urvann as **"Not a competitor. Ignore for planning purposes."** That assessment was made from Upvan's perspective — a 10-SKU, Jan-2026 Shopify store drop-shipping from a third-party nursery — and it is **correct for that comparison.** It is **not** correct for this report's subject. **Urvann is a real, operating, ~₹16.7 Cr-revenue, near-breakeven hyperlocal retailer with a functioning farm-to-door network in two metros.** If the founder's plan resembles Urvann's rather than Upvan's, that "ignore" line should be revisited.

---

## FINAL VERDICT — should an indie try to imitate this business at all?

**Not the whole thing. The logistics half, yes. The retail half, no. The service half is where you should beat them.**

**What to imitate wholesale:**

- **One own-farm nursery inside one dense zip** (1–2 acres), supplying that zip only.
- **Zero packaging, open EV two-wheeler transport, no box, no courier, no RTO.** This is the correct answer to the freight problem and it is verified.
- **Free next-day delivery with a 7 PM cut-off** — it is table stakes in Delhi NCR and Bengaluru, and any parcel-based competitor must charge ₹60–₹150 you don't.
- **A seasonal, plant-native catalogue taxonomy**, and **bundles as the AOV lever** rather than a recurring box.
- **A founder-led YouTube channel** — the highest-ROI thing in the business and the one a funded competitor cannot cheaply replicate.
- **Corporate and bulk gifting** as the higher-AOV, predictable-cadence second line.

**What NOT to imitate:**

- **Per-order-paid riders with no distance weighting.** Their own contract penalises fake delivery marking at ₹100 because the incentive is broken. This is the mistake that produces the 1.4/5.
- **No returns, no refund SLA, wallet-only refunds, and a support line that is the public phone number.** Their support design reads well and their support execution fails catastrophically. **Do not launch with support as the residual; it is the product.**
- **Aggressive discount fields on 100% of listings while claiming "honest prices."** §(b)'s data shows what that actually looks like.
- **Any plan that assumes pan-India reach.** Urvann had expansion capital, a stated 2025 national goal, and two metros four years later. The model will not do it.
- **A paid "membership" with no scheduled delivery behind it** — their ₹365 pass is a coupon, and it will not build the recurring revenue Bloomscape failed to build.

**The honest one-line version:** _Urvann proved that owning the farm kills the freight problem and can grow a ₹16.7 Cr business at 54% YoY — and proved, in the same set of documents, that you can do all of that and still end up at 2.1/5 on Trustpilot with a ₹100 penalty clause for lying about deliveries._ **The moat is the nursery. The business is the service. Urvann got the first right and the second wrong, and it is currently 54% growth and −2.5% net margin while it works that out.**

**The gap in this market is not plants, price, or range — all three are contested. The gap is a seller in one Delhi NCR or Bengaluru zip code who always answers on WhatsApp, always delivers within the promised window, refunds in 24 hours, and never touches a courier box. That is a small, unglamorous, serviceable business. Urvann has just spent four years proving there is room for it to exist at scale — and demonstrating, just as clearly, that nobody there is doing it well.**

---

_Research date: 4 October 2026. All prices, ratings, install counts, catalogue figures and API pulls are snapshots taken on that date. Rating and install counts for all four apps were pulled live from the Google Play and Apple App Store listing endpoints. Financials are from Inc42's filing-derived compilation. The 3PL agreement is a primary document uploaded publicly and signed by founder Sambhav Jain on 20 Feb 2025. Items that could not be confirmed are tagged **[UNVERIFIED]** or listed in the appendix above. No forms were submitted and no contact was made with Urvann._
