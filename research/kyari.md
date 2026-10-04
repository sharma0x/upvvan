# Kyari.co — Decision-Grade Research Report

**Research date:** 4 October 2026
**Subject:** https://kyari.co (with satellite properties kyari.co.in, corporate.kyari.co, shop.kyari.co, selectbrands.in)
**Method:** direct `curl` of live Shopify storefront + `products.json` catalog pulls, sitemap enumeration, search-engine and corporate-registry cross-checks. Every factual claim carries a URL. Anything not verifiable is tagged **UNVERIFIED**.

---

## 0. TL;DR — the finding that changes the brief

**Kyari is not a small B2B eco-products supplier. It is a funded, profitable, Shark Tank-backed consumer D2C brand that happens to have a corporate-gifting side door.**

The prior FNP/IGP report's characterisation ("eco corporate gifts supplier, starting ₹199/unit, MOQ 30") came from a single SEO landing page. Pulling the actual business:

| Signal                        | Fact                                                                                                                                           | Source                                                                                                                                                                                                                                                                                                     |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Legal entity                  | **Select Brands International Private Limited** (footer of every kyari.co page: "KYARI : SELECT BRANDS INTERNATIONAL PRIVATE LIMITED")         | https://kyari.co/pages/about-us                                                                                                                                                                                                                                                                            |
| CIN                           | U52599MP2018PTC047149, incorporated **28 Nov 2018**, formerly _Techleads Exim Pvt Ltd_                                                         | https://www.thecompanycheck.com/company/select-brands-international-private-limited/U52599MP2018PTC047149                                                                                                                                                                                                  |
| Directors                     | Agam Choudhary (DIN 08252770, whole-time director, since 2018), Saksham Jain (DIN 09567857, since 12 Sep 2022), Rajit Kumar Singhai (promoter) | https://www.tofler.in/select-brands-international-private-limited/company/U52599MP2018PTC047149 · https://www.allindiaitr.com/company/select-brands-international-private-limited/U52599MP2018PTC047149                                                                                                    |
| Brand founded                 | **April 2022, Indore** (brothers Agam + Saksham)                                                                                               | https://www.indianretailer.com/news/d2c-green-decor-brand-kyari-crosses-10-lakh-customers-india                                                                                                                                                                                                            |
| Scale                         | **10,00,000+ customers**, **PAT-profitable**, ₹20 Cr+ revenue crossed, targeting ₹100 Cr by 2027                                               | https://www.passionateinmarketing.com/kyari-achieves-%E2%82%B9-20-crore-in-revenue-crosses-10-lakh-customers-and-targets-%E2%82%B9100-crore-revenue-by-2027/                                                                                                                                               |
| Recognition                   | **Shark Tank India S4** (rejected a ₹4 Cr offer from Kunal Bahl + Peyush Bansal), **Forbes 30 Under 30 Asia 2026** (Retail & E-commerce)       | https://www.filmibeat.com/ott/shark-tank-india-4-innovative-plant-based-businesses-in-face-off-episode-438613.html · https://www.news18.com/entertainment/television/shark-tank-india-4-plant-based-brands-go-head-to-head-to-crack-a-deal-aa-9192504.html · https://www.forbes.com/30-under-30/2026/asia/ |
| Team size                     | **51–200 employees**, LinkedIn 41,249 followers, privately held, founded 2022                                                                  | https://www.linkedin.com/company/trykyari                                                                                                                                                                                                                                                                  |
| Site status                   | **Live and healthy.** Shopify Plus, Cloudflare, `robots.txt` served 200, full sitemaps, UCP/MCP agentic-commerce endpoints live                | https://kyari.co/robots.txt · https://kyari.co/sitemap.xml                                                                                                                                                                                                                                                 |
| Catalog                       | **428 SKUs** in `/collections/all` (median price ₹399, range ₹99–₹9,999)                                                                       | https://kyari.co/collections/all/products.json?limit=250                                                                                                                                                                                                                                                   |
| Team's own competitor framing | TheCompanyCheck names **Ugaoo, Trust Basket, Greenkin, Nurturing Green, Green Shelter** as Kyari's competitors                                 | https://www.thecompanycheck.com/company/b/kyari/bdctpv62umvz66fof                                                                                                                                                                                                                                          |

**So the answer to the question the brief posed is: yes, there is a B2B opening — but Kyari itself is the incumbent you would be displacing, not the weak incumbent to attack.** Kyari is roughly one-tenth to one-fifth of Ugaoo's revenue but is now category-credible (Shark Tank + Forbes), fully Shopify-scaled, present on Amazon/Flipkart/Blinkit/Zepto/Instamart, and — critically — it _is_ Ugaoo's positioning rather than an alternative to it. Details and the indie implications are in §8.

**Second structural finding, and it is the most actionable thing in this report:** Kyari runs **two separate storefronts with two different price books for the same plants.** `kyari.co` sells a Golden Money Plant at ₹349; `kyari.co.in` (the wholesale/trade arm) lists the same product class at ₹60–₹999/piece with "Get Quote" and MOQ language; IndiaMART lists Kyari-branded self-watering pots at **₹60/piece**. That is a visible, exploitable price-architecture gap (§7, §9).

**Third finding: "eco" is marketing, not product.** There is not one eco-brick, seed ball, jute, coir, terracotta, kraft or biodegradable-planter SKU in 428 products. "Eco" on Kyari means (a) eco-friendly/recyclable _packaging_ claim, (b) _water-efficiency_ framing on self-watering planters, (c) an organic-_input_ accessories shelf. **UNVERIFIED / NOT SUBSTANTIATED:** no waste-elimination claim, no plastic-free shipping claim, no certification, no lifecycle data. A genuinely-substantiated eco line is wide open (§4, §9).

---

## (a) WHO THEY ARE

### Legal & corporate identity

- **Legal name:** Select Brands International Private Limited. Confirmed in the footer of every page on kyari.co, e.g. "KYARI : SELECT BRANDS INTERNATIONAL PRIVATE LIMITED." — https://kyari.co/pages/about-us, https://kyari.co/pages/contact
- **CIN:** U52599MP2018PTC047149; incorporated 28 November 2018; industry code **U52599** (wholesale trade of agricultural raw materials/live animals); NIC description on TheCompanyCheck: _"agricultural products distribution"_ — https://www.thecompanycheck.com/company/select-brands-international-private-limited/U52599MP2018PTC047149
- **Former name:** Techleads Exim Private Limited (pre-Kyari trading shell) — https://www.thecompanycheck.com/company/select-brands-international-private-limited/U52599MP2018PTC047149
- **Directors:** Agam Choudhary (whole-time director, DIN 08252770, appointed 28 Nov 2018, also shareholder), Saksham Jain (DIN 09567857, appointed 12 Sep 2022), Rajit Kumar Singhai (individual promoter, appointed 28 Nov 2018) — https://www.tofler.in/select-brands-international-private-limited/company/U52599MP2018PTC047149 · https://www.allindiaitr.com/company/select-brands-international-private-limited/U52599MP2018PTC047149
- **GST:** 27AAHCT0480D1ZI, registered in Maharashtra (27 = Maharashtra), shown on the B2B property — https://www.kyari.co.in/. **UNVERIFIED:** the GSTIN actually used for the D2C storefront (kyari.co) is not disclosed on any kyari.co page.
- **Investor:** Ivy League Ventures lists Kyari as a portfolio company (Indore, "Green Decor – Online Nursery for Indoor Plants") — https://www.ivyleagueventures.in/portfolio-company-kyari/
- **Team size:** 51–200 employees per LinkedIn — https://www.linkedin.com/company/trykyari
- **YNOS lists three directors** including "R RAJIT KUMAR SINGHAI" and gives founding year 2018 — https://www.ynos.in/startup/kyari-489642

**Note the date spread:** company incorporated 2018, Kyari brand launched April 2022. The FNP report's framing of Kyari as an eco-gift supplier is a _page-level_ read of a much larger business.

### Locations — there are four addresses floating around, and they conflict

| Address                                                                                                                    | Property                                | Role                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------- |
| 505, Cliffton Corporate Park, AB Rd, Indore, MP 452010                                                                     | kyari.co (sitewide footer)              | https://kyari.co/pages/about-us                                                       |
| 1115, Skye Earth Corporate Park, AB Rd, Indore, MP 452010                                                                  | Contact page + corporate.kyari.co       | https://kyari.co/pages/contact · https://corporate.kyari.co/                          |
| 1106, Skye Earth Corporate Park, AB Rd, Indore, MP 452010                                                                  | Stale footer on collections/deals pages | https://kyari.co/collections/plants-1?page=9 · https://kyari.co/pages/deal-of-the-day |
| 11th Floor, Skye Earth Corporate Park, 1115, AB Rd, Sector B, Slice 5, Aranya Nagar, Scheme 78, Vijay Nagar, Indore 452010 | Google Maps listing                     | https://www.planttrade.in/nurseries/madhya-pradesh/indore                             |
| 44, Pologround Industrial Area, Indore, MP 452003                                                                          | VCSdata listing                         | https://www.vcsdata.com/company/kyari/132216.html                                     |
| Plot No. N1/I, **Floriculture Park, Tal-Maval, Talegaon MIDC, Akurdi**, Pune 410507                                        | **kyari.co.in** — sales officer address | https://www.kyari.co.in/                                                              |

The **Pologround Industrial Area** address is also the one IndiaMART uses for the "Indoor Plants Wholesalers & Distributors" listing (https://dir.indiamart.com/indore/indoor-plants.html?biz=30), and IndiaMART's _other_ Select Brands listing sits at "161/a Shree Nagar Extension, Indore, Near IPCA" (https://www.indiamart.com/proddetail/plastic-self-watering-flowering-transparent-pot-planter-for-indoor-and-outdoor-25867941255.html). So there is at least one **operating/growing or fulfilment site in Pologround, Indore**, plus a corporate office at Skye Earth.

### Do they own growing capacity?

**Partly — and this is a real differentiator worth respecting.**

Their product pages claim a **six-step in-house propagation protocol** (verbatim, https://kyari.co/products/golden-money-plant-with-self-watering-pot):

> "Step 01 The Foundation of Quality — Using **tissue culture**, we grow disease-free, superior plants in controlled environments. Step 02 Nourishing the Roots — We craft a nutrient mix of **cocopeat, manure, and perlite** for optimal growth. Step 03 Careful Planting for Growth — Saplings are potted to grow under controlled conditions for **3 months**. Step 04 3 Months of Expert Care… Step 05 Handpicked for Perfection… Step 06 Safe Travels to Your Doorstep."

That is a genuine vertical-integration story (tissue culture + 3-month hardening), and Forbes/PR coverage repeats it: _"Sustainability remains central to Kyari's philosophy, with eco-friendly and recyclable packaging and a focus on improving water efficiency through its self-watering planter systems"_ — https://www.passionateinmarketing.com/kyari-founders-featured-in-forbes-30-under-30-asia-2026-list-brand-targets-%E2%82%B9100-crore-revenue-by-2027/

**But they are not a farm-scale grower the way Ugaoo is.** Ugaoo is repeatedly described as owning **a 25-acre farm in Talegaon with 36 automated polyhouses** and 1,500+ SKUs — https://yourstory.com/2025/04/ugaoo-startup-india-modern-gardening-movement-horticulture, https://www.linkedin.com/posts/jeenahaiabhiii_ugaoo-kyari-nurturinggreen-activity-7354796613589958656-pVN6. Kyari has 428 SKUs and a 3-month hardening protocol. Note the geographic irony: **Kyari's own B2B sales officer sits inside Talegaon MIDC Floriculture Park** (https://www.kyari.co.in/) — the same MIDC cluster where Ugaoo's farm is. Kyari is plausibly _sourcing_ from that cluster rather than owning equivalent acreage.

**UNVERIFIED:** Whether Kyari owns or leases a nursery/farm, and the size of any owned growing footprint. No farm address is published on any Kyari property; the only growing-adjacent addresses are the Indore offices. Their own B2B property describes the Pune Talegaon site as a _sales_ location ("Kyari (Sales Officer)").

### Manufacture vs. source

- **Self-watering plastic pots:** listed under Kyari brand on IndiaMART with material **PP** and price **₹60/piece** (4.5"–7", multiple colours) — https://www.indiamart.com/proddetail/plastic-self-watering-flowering-transparent-pot-planter-for-indoor-and-outdoor-25867941255.html · https://dir.indiamart.com/pune/self-watering-planters.html. Vendor field in the Shopify catalog is "Kyari.co" (319 SKUs) / "Kyari" (109 SKUs), i.e. everything is sold as Kyari-branded — https://kyari.co/collections/all/products.json?limit=250. Whether moulded in-house or contract-manufactured is **UNVERIFIED**.
- **Metal (Zen/Arbor) self-watering planters:** the signature product. Manufacturing location **UNVERIFIED**.
- **FRP/fiberglass planters:** sold under named lines — City Globe, Downtown Luxe, Amsterdam Muse, Manhattan Bloom (₹4,799–₹9,999). Described as _"Made from high-quality, UV & frost resistant Fiberglass… UV & moisture resistant"_ — https://kyari.co/ . Manufacturing **UNVERIFIED**.
- **Terracotta:** exists only on the B2B/IndiaMART side, at ₹37–₹70/piece, sourced/listed as Kyari-brand terracotta tray pots — https://www.kyari.co.in/ · https://dir.indiamart.com/pune/terracotta-pots.html. **Not in the D2C catalog.**
- **Inputs:** "amazonlistedfood" is a live tag on 18 SKUs (fertilisers, neem oil, soil, LECA) — a strong hint these are _resold_ consumables, not manufactured. https://kyari.co/collections/plant-food/products.json?limit=60
- **Plant inputs like neem cake / cow dung:** sold in bulk on IndiaMART at **₹42/kg (1 kg pack) / ₹152 per 5 kg, MOQ 100 kg** — https://www.indiamart.com/selectbrands-international/organic-vermicompost.html. That is a genuine own-brand bulk-input play.

### People & channels (facts, no contact made)

- Instagram **@try_kyari** — https://www.instagram.com/try_kyari/ — approx. **129.2K followers** per Socialveins — https://socialveins.com/influencer/instagram/try_kyari. (An earlier agency case study reports "78K+ Instagram followers" for an earlier period — https://socialveins.com/case-studies/10m-views-100-content-200k-website-hits-socialveins-powerful-strategy-behind-kyari-s-market-breakthrough)
- Facebook https://www.facebook.com/Kyariofficial/ · Pinterest https://in.pinterest.com/try_kyari/ · LinkedIn https://www.linkedin.com/company/trykyari · Collab/brand-collab profile https://hashfame.com/@try_kyari ("1 brands connected in past 6 months")
- **Support:** support@kyari.co · +91 8376885182 · Mon–Fri 10am–6pm, Sat 10am–2pm
- **Bulk/corporate:** corporate@kyari.co · +91 9201962751 · WhatsApp wa.me/919201962751 · Mon–Sat 10am–6pm — all from https://kyari.co/pages/contact and https://corporate.kyari.co/
- Support desk: https://kyari-support.freshdesk.com/support/home · Damage claim form: a Google Form — https://docs.google.com/forms/d/1uKbgh9QxNZzxCW4OOM8CbX8VhCs7JNXLI-bnvu_4Bec/
- **No messages were sent to any of these.** Recorded as facts only.

---

## (b) WHAT THEY SELL — full taxonomy with real prices

Catalog measured directly from `https://kyari.co/collections/all/products.json?limit=250&page=N` (pages 1–2), deduplicated to **428 unique products**. Price distribution:

| Band         | SKU count |
| ------------ | --------- |
| Under ₹200   | 76        |
| ₹200–499     | 166       |
| ₹500–999     | 95        |
| ₹1,000–1,999 | 46        |
| ₹2,000+      | 45        |

Min ₹99 · **Median ₹399** · Max ₹9,999. 399 of 428 SKUs available; 29 unavailable/out of stock. 42 SKUs tagged `corporate bulk`; **76 SKUs tagged BYOB** (Build Your Own Box/Bundle).

Sitemap: 104 product URLs, 233 collections, 253 pages, 101 blog posts — https://kyari.co/sitemap.xml

Shopify `product_type` values are almost empty (327 of 428 blank); real taxonomy lives in tags and the nav menu.

### (i) Live plants + self-watering planters — the core

The single defining mechanic: **plant + integrated self-watering reservoir pot**, in a matrix of plant species × pot brand × pot size × pot colour.

**Named planter brands (real, house-owned):** Aira (with integrated stand), Aura, Mylo, Reya, Poetic, Elite, Repot, Water-4, Zen (metal), Arbor (metal), Serif/Sera. Collections: https://kyari.co/collections/mylo · /collections/aura · /collections/poetic

**Pot-size matrix:** 3.5" (₹99–₹199) · 4" (₹199, combos of 5 at ₹599) · 4-inch Aira/Mylo · 5" "Medium Aura" · 8" "Zen/Arbor Metal" · 8" and 10" "Large/Extra Large" · 10' Inch ExtraLarge Pot ₹1,499

**Entry plants (4", self-watering, real prices):**

| Product                                                      | Price    | Was    |
| ------------------------------------------------------------ | -------- | ------ |
| Philodendron Micans Plant With Self Watering Pot             | **₹349** | ₹499   |
| Peace Lily Plant With Self Watering Pot                      | **₹325** | ₹699   |
| Syngonium Pink Plant With Self Watering Pot                  | **₹359** | ₹754   |
| Aglaonema Lipstick Plant With Self Watering Pot              | **₹399** | ₹599   |
| Jade Snake Plant                                             | **₹499** | ₹799   |
| ZZ Plant in Aira Self Watering Pot (stand included)          | **₹349** | ₹699   |
| Green Snake Plant With Repot                                 | **₹399** | ₹549   |
| Peacock Plant With Self Watering Pot                         | **₹449** | ₹1,248 |
| Lucky Bamboo Plant With Self Watering Pot                    | **₹565** | ₹1,120 |
| Spider Plant With Self Watering Pot                          | **₹325** | ₹499   |
| Philodendron Birkin Plant With Self Watering Pot             | **₹429** | ₹699   |
| Satin Money Plant With Self Watering Pot                     | **₹369** | ₹599   |
| Peperomia Obtusifolia Variegata Plant With Self Watering Pot | **₹339** | ₹499   |

**"Aira pot BYOB / stand included" tier — ₹299–₹349 each, uniform:**
`Aralia Plant in Aira Self Watering Pot (Stand included)` ₹349 · `Dracaena Compacta Plant in Aira…` ₹349 · `Golden Money Plant in Aira…` ₹349 · `Song of India Plant in Aira…` ₹349 · `Money Varigated Plant in Aira…` ₹349 · `Jade Plant in Aira…` ₹349 · `Peace Lily Plant in Aira…` ₹349 · `Green Snake Plant in Aira…` ₹349 · `Golden Snake Plant in Aira…` ₹349
Source: https://kyari.co/collections/all/products.json?limit=250

**Medium (5") Aura line — ₹649–₹1,299:**
`Zamia Green - ZZ Plant with Medium Self Watering Pot` **₹909** (was ₹1,299) · `Aglaonema Pink Valentine Plant with Medium Self Watering Pot` **₹1,299** (was ₹2,199) · `Calathea Rufibarba Plant with Medium Metal Self Watering Pot` **₹829** (was ₹1,499) · `Aralia Green Plant with Medium Self Watering Pot` **₹799** (was ₹1,099) · `Peperomia Green Plant with Medium Metal Self Watering Pot` **₹749** · `Syngonium Pixie White Plant with Medium Self Watering Pot` **₹749** (was ₹999) · `Green Snake Plant with Medium Self Watering Pot` **₹769** · `Philodendron Broken Heart Plant with Medium Self Watering Pot` **₹769** · `Fiddle Fig Plant with Medium Metal Self Watering Pot` **₹849** · `Lucky Jade Plant with Medium Self Watering Pot` **₹649** (was ₹999) · `Money N'Joy Plant with Medium Self Watering Pot` **₹769** · `Golden Money Plant with Medium Self Watering Pot` **₹699** (was ₹1,299) · `Peacock Plant with Medium Self Watering Pot` **₹999** (was ₹2,199) · `Spider Plant with Medium Self Watering Pot` **₹719** (was ₹1,299)
Source: https://kyari.co/collections/all/products.json?limit=250

**XL — metal, 8"/10", ₹1,799–₹3,299:**
`Areca Palm with Zen Metal Self Watering Pot` **₹1,799** (was ₹2,999; also ₹2,599/₹4,599 on Arbor) · `China Palm with Zen Metal Self Watering Pot` **₹1,899** (was ₹3,768) · `Rhapis palm with Zen Metal Self Watering Pot` **₹1,899** (was ₹5,599) · `Chamaedorea Palm with Zen Metal Self Watering Pot` **₹1,999** (was ₹3,899) / Arbor **₹3,199** (was ₹5,999) · `Aglaonema Ice with Zen Metal` **₹2,125** / Arbor **₹3,199** · `ZZ Green with Zen Metal` **₹2,225** (was ₹3,999) · `Aglaonema Snow White with Zen Metal` **₹2,049** (was ₹5,999) / Arbor **₹3,199** · `Fiddle Fig - With Large Metal Self Watering Pot` **₹1,849** (was ₹3,299) · `Monstera Deliciosa with Arbor Metal` **₹3,299** (was ₹5,999) · `Ficus Lyrata with Extra Large Metal` **₹3,299** · `Croton Petra with Arbor Metal` **₹2,899** (was ₹3,999) · `China Doll with Metal` **₹1,999** (was ₹3,249) · `Dracaena Dara Singh with Extra Large Metal` **₹4,399**
Source: https://kyari.co/collections/all/products.json?limit=250

**Combos (the highest-velocity layer) — 15+ sets, ₹449–₹1,499:**
`Air Purifying Combo - Set of 3` **₹799** (was ₹1,119) · `Air Purifying Combo - Set of 4` **₹949/₹999** · `Air Purifying Combo - Set of 5` **₹1,149** (was ₹1,499) · `Low Maintenance Plant Combo – Set of 4` **₹999** (was ₹1,499) · `Vastu Friendly Combo` **₹1,221** (was ₹1,699) · `Best For Home Combo` **₹1,221** · `Best For Office Combo` **₹999** · `Lucky Plants Combo - Set of 4` **₹999** · `Good Luck Trio - Set of 3` **₹849** (was ₹1,169) · `Stress Relief Indoor Plant Combo` **₹625** · `Work Desk Air Purifying Combo` **₹725** (was ₹859) · `Low Maintenance Starter Plant Combo` **₹475** · `Easy Care Home Decor Combo` **₹525** · `Vastu Prosperity Plant Combo (4 Pack)` **₹1,349** · `Set of 5 Mylo` **₹1,499** (was ₹2,499)
Source: https://kyari.co/collections/all/products.json?limit=250 · https://kyari.co/collections/all-combos

**Metal-pot 3-set combos — ₹1,699–₹2,649:**
`Serene Dew - Set of 3 Metal Self Watering Pot Combo` **₹2,649** (was ₹3,699) · `Pop Bloom` **₹2,649** · `Tropical Bloom` **₹2,649** · `Shadow Bloom` **₹1,699** (was ₹2,999) · `Moonlight Glow` **₹2,649**
Source: https://kyari.co/collections/all/products.json?limit=250

### (ii) "Eco" products — what actually exists

**This is the headline negative finding. Searched all 428 SKUs' titles and tags for: eco, bamboo, jute, coir, coconut, seed ball, terracotta, clay, kraft, recycl, biodegrad, organic, grow kit.**

| Category asked about                          | Found in D2C catalog?                                                                                                            |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Eco-bricks / eco-bricks planters              | **0 SKUs**                                                                                                                       |
| Seed balls                                    | **0 SKUs**                                                                                                                       |
| Coconut coir products (coir discs, coir pots) | **0 SKUs** (cocopeat appears only as a _planting medium_ in copy, not a product)                                                 |
| Jute / jute-wrapped planters, jute packaging  | **0 SKUs**                                                                                                                       |
| Bamboo / bamboo planters                      | **0 SKUs** (5 hits are all _lucky bamboo plants_, a Dracaena sanderiana cultivar, not bamboo product)                            |
| Terracotta pots / terracotta alternatives     | **0 SKUs on D2C**; terracotta exists only on B2B/IndiaMART (₹37–₹70/piece) — https://dir.indiamart.com/pune/terracotta-pots.html |
| Kraft packaging as a product                  | **0**                                                                                                                            |
| Seed kits / "grow kits"                       | **No grow kit SKU.** Seeds are sold loose, ₹99/pouch — see below                                                                 |
| Hydroponic clay/LECA                          | **1 SKU:** `Hydroton Clay Balls (LECA for Plants) – 1.8Kg / 6L` **₹399** (was ₹699)                                              |

**What IS on the "eco-adjacent" shelf — the organic-input accessories category (22 SKUs, https://kyari.co/collections/plant-food):**
`Vermicompost` **₹149** · `Neem Cake Powder` **₹195** · `Organic Potash Meal (1 KG)` **₹195** · `Epsom Salt` **₹189** · `Root Booster for Plants` **₹219** · `Seaweed Extract` **₹199** · `Neem Oil For Plants` **₹199** (250 ML) / ₹249 (500 ML) · `All in One Plant Fertilizer` **₹169** · `Kyari Perlite 250 gm` **₹195** · `Perlite - 500 Gm` **₹189** · `Potting Soil Mixture` **₹345** · `Organic Veggie Mix Soil (1 KG)` **₹239** · `Organic Fertilizer Pellets (1 KG)` **₹299** · `Natural Red Soil (5 KG)` **₹369** · `Compressed Potting Mix (115 GMS)` **₹99** · `Hydroton Clay Balls (LECA) 1.8Kg` **₹399** · `Ready-to-Use Flowering Stimulant (500 ML)` **₹349** · `Kyari Flowering Stimulant Concentrate` **₹199** · `Kyari Bokashi Mix` **₹159** · `Kyari hydrocrystals 250g` **₹339** · `Kyari Gypsum Salt` **₹399** · `Mustard Cake Powder 1kg` **₹375** · `Cow Dung Manure` **₹199** · `Flora Fertilizer Sticks (Pack of 35)` **₹149** (was ₹599) · `Chlora Fertilizer Sticks (Pack of 35)` **₹149** · `Herbal Mealy Bug Killer (250 ML)` **₹249**
Plus `Plant Tonic Spray (500 ML)` ₹299, `5 in 1 + Sprayer` ₹299, `Plant Snips` ₹99, `Kyari Plant Tie` ₹399, `Plant Clip` ₹299, `Kyari Braided Pipe` ₹499, `Fruit plucker` ₹409, `Anti Pigeon Net (10 x 8 FT)` ₹549 — https://kyari.co/collections/gardening-essentails/products.json?limit=60

**Seeds — 33 SKUs, essentially all at a single ₹99 price point** (https://kyari.co/collections/seeds/products.json?limit=250):
`Vegetable Seed Bank (Pack of 54 g)` **₹249** · 32 individual pouches at **₹99** each: Tulsi herb · Lotus flower · Zinnia (2 SKUs) · Marigold · Petunia · Dahlia · Cosmos · Cherry tomato · green chilli · okra · basil · coriander · amaranthus · methi/fenugreek · drumstick/moringa · beetroot · carrot · broccoli · green capsicum · green cucumber · tomato · okra · radish/lettuce/spinach microgreens (4) · spinach · long lettuce · round lettuce · plus `Broccoli Microgreen Seeds`.
Note the **₹99 flat price for wildly different seed counts** (Radish Microgreen "800–1200 Seeds" vs Green Capsicum "24–36 Seeds" both ₹99) — a clear quantity-based pricing gap (§7).

### (iii) Corporate gifting

**Two parallel corporate surfaces, priced differently:**

**A. `kyari.co/pages/corporate-gifting` + `/pages/corporate-gifts-eco-friendly-sustainable`** (Shopify, enquiry-led). Verified page copy:

- _"Premium corporate gifting solutions with self-watering plants curated for employee onboarding, client appreciation & anniversaries."_ · _"100% replacement · Delivery within 2 days"_ — https://kyari.co/pages/corporate-gifts-eco-friendly-sustainable
- **"Starting ₹199 / unit · MOQ: 30 units"** — confirmed in the page body served on 4 Oct 2026 (this is the exact claim the earlier FNP report picked up) — https://kyari.co/pages/corporate-gifts-eco-friendly-sustainable
- _"Trusted by over 500 clients | Over 1,00,000 orders fulfilled"_ — same page
- _"Minimum Order: 30 Units. Request Custom Quote… Every element is fully customizable, from the pot to the packaging—your logo on every plant gift."_ · _"→ 500+ brands have done it"_ — same page
- Delivery: _"4,000+ pin codes covered · Plants arrive fresh within 7 days · Damage-free guarantee"_; _"Delivery to 4,000+ pin codes within 7 working days of order confirmation. Express slots available for select cities including Mumbai, Delhi, Bengaluru and Hyderabad."_
- Transit durability: _"Our proprietary packaging keeps plants healthy for up to 10 days in transit. Every plant arrives fresh — or we replace it free of charge, no questions asked."_
- Logistics: _"Every Kyari plant comes with a printed care guide · Post-gifting care helpline available for all recipients"_
- Tiering: _"Our minimum bulk order is 30 units. For 100+ unit orders, we offer tiered pricing, priority fulfilment and a dedicated account manager."_
- Logo: _"Logo engraving and custom printing are available for all orders above 30 units. Share your brand guidelines and we'll handle the rest."_
- Branded-packaging proof photos (as images, not text): _"Branded packaging with Adidas and Kyari boxes"_, _"Thank you card with Adani branding and plant"_, _"Fevicol logo on pot in office setting"_, _"Mia branded pink packaging box with plant"_
- Corporate testimonials on that page attribute quotes to named executives at Cipla, ICICI, Glenmark, TATA and Skechers, with a _"4.8 / 5.0 · 500+ corporate orders"_ header. **These are on-site marketing testimonials with no verifiable link to the quoted individuals — treat as marketing claims, not evidence.**

**B. `corporate.kyari.co` + `selectbrands.in/index.php?i=32377832088`** (a separate, lighter microsite): _"Corporate Hampers starting at just ₹199! Perfect for every budget, with premium options to truly impress."_ · _"Personalize your gifts with custom plants, planters, logos, and heartfelt message cards."_ · Product Curation / Custom Packaging / Personalization Options / Logistics Management — https://corporate.kyari.co/

**Corporate/hamper SKUs with real cart prices** (https://kyari.co/collections/hampers/products.json?limit=50):

| Hamper                                               | Price      | Was    | Note                                    |
| ---------------------------------------------------- | ---------- | ------ | --------------------------------------- |
| The Radiance Box – Premium Diwali Gift Hamper        | **₹1,049** | ₹1,449 | 40% off                                 |
| The Grandeur Box – Luxury Diwali Gift for Employees  | **₹1,049** | ₹2,099 | 57% off                                 |
| Diwali Royale Hamper – Premium Corporate Diwali Gift | **₹1,049** | ₹1,499 |                                         |
| The Divine Charm – Luxury Diwali Gift for Employees  | **₹949**   | ₹1,699 | 53% off                                 |
| The Lumina Box – Sustainable Diwali Plant Hamper     | **₹799**   | ₹1,299 | only SKU with "Sustainable" in the name |
| Celestial Glow Box – Diwali Corporate Gift Hamper    | **₹749**   | ₹889   | 27% off                                 |

**Corporate volume-tier pricing visible on the hamper PDPs** (from https://kyari.co/pages/corporate-gifts-eco-friendly-sustainable):

- Radiance Box: Set of 1 ₹1,049 · **Set of 5 ₹4,995** · **Set of 10 ₹9,499** · **Set of 20 ₹17,989**
- Grandeur Box: Set of 1 ₹1,049 · **Set of 5 ₹4,995** · **Set of 10 ₹9,499** · **Set of 20 ₹17,989**
- Celestial Glow: Set of 1 ₹749 · **Set of 5 ₹3,569** · **Set of 10 ₹6,819** · **Set of 20 ₹12,980**
- Divine Charm: Set of 1 ₹949 · **Set of 5 ₹4,399** · **Set of 10 ₹8,399** · **Set of 20 ₹15,980**

That is the single most useful dataset in this report for an indie competing in gifting: **effective per-unit at volume is ₹564–₹825**, versus the ₹199 headline that drives the search snippet. The ₹199 is the entry hamper, not the plant.

**Corporate "bulk" plant SKUs.** 42 catalog products carry the `corporate bulk` tag; of these, 16 are dedicated "for corporate" SKUs. All real prices from https://kyari.co/collections/all/products.json?limit=250:

| Corporate bulk SKU                                                     | Price  | Was    |
| ---------------------------------------------------------------------- | ------ | ------ |
| Lucky Jade Plant With Self Watering Pot **for corporate**              | ₹299   | ₹496   |
| Peace Lily Plant With Self Watering Pot **for corporate**              | ₹325   | ₹699   |
| Golden Money Plant with Aira Pot **for corporate**                     | ₹349   | ₹699   |
| Jade Plant with Aira Pot **for corporate**                             | ₹349   | ₹699   |
| Golden Money Plant With Mylo Planter **for corporate**                 | ₹349   | ₹499   |
| Lucky Jade Plant With Mylo Planter **for corporate**                   | ₹349   | ₹499   |
| Money Variegated Plant With Mylo Planter **for corporate**             | ₹349   | ₹499   |
| Money Varigated Plant with Aira Pot **for corporate**                  | ₹349   | ₹699   |
| Peace Lily Plant with Aira Pot **for corporate**                       | ₹349   | ₹699   |
| Peace Lily Plant With Mylo Self Watering Pot **for corporate**         | ₹349   | ₹499   |
| Golden Money Plant With Self Watering Pot **for corporate**            | ₹349   | ₹499   |
| Money Variegated Plant With Self Watering Pot **for corporate**        | ₹349   | ₹499   |
| Lucky Jade Plant with Medium Self Watering Pot **for corporate**       | ₹649   | ₹999   |
| Golden Money Plant with Medium Self Watering Pot **for corporate**     | ₹699   | ₹1,299 |
| Money Variegated Plant with Medium Self Watering Pot **for corporate** | ₹749   | ₹1,299 |
| Peace Lily Plant with Medium Self Watering Pot **for corporate**       | ₹849   | ₹1,199 |
| Indoor Green Plant Combo – Set of 3                                    | ₹1,075 | ₹1,599 |

**Critical reading:** the "for corporate" SKUs are **identical products at identical D2C prices** — there is no separate wholesale price book on kyari.co. The corporate discount lives only in the hamper quantity-tiers and in off-platform negotiation. Note also a leaked internal tag on `Peace Lily Plant With Self Watering Pot for corporate`: **`tax checking issue`** — an internal merchandising tag shipped to production. Small, but it is the kind of thing a careful indie can avoid.

**Client logos (brand-slider, `/pages/corporate-main`):** HDFC Bank, Workie Pvt. Ltd., boAt, Motilal Oswal Ltd. — https://kyari.co/pages/corporate-main. **UNVERIFIED:** the site's "500+ brands" and "1,00,000 orders" claims. The four logos above are the only named, checkable ones.

### (iv) Anything else

- **Planters standalone (no plant):** 3.5" Mylo ₹99 · 3.5" Reya ₹199 · 4" Elite ₹199 · 4" Poetic ₹199 · 4" Repot ₹199 · combos of 5 at ₹599 · 8" Large ₹999 · 10" ExtraLarge ₹1,499 · 10" Arbor Inner Pot ₹449
- **FRP/fiberglass premium planters:** Manhattan Bloom Small ₹2,599 / Medium ₹3,499 / Large ₹5,499 · Downtown Luxe Small ₹4,799 / Medium ₹7,299 · Amsterdam Muse Small ₹6,499 · City Globe Small ₹4,999 / Medium ₹9,999
- **Accessories:** 5-in-1 kit ₹299 · Plant Watering Globe ₹299 · HYDRATE Water Meter ₹99 (was ₹99) · Kyari Spray Bottle ~₹99 · Plant Tonic Spray ₹299 · Wooden Candle Holder ₹249
- **Services:** Plant Doctor video consultation https://kyari.co/pages/plant-doctor · Doctor Consultation https://kyari.co/pages/doctor-consultation · Plant-care library (250+ pages, ~40 care guides) https://kyari.co/pages/plant-care · "Find Your Match" quiz https://kyari.co/quiz · Gift Box Builder https://kyari.co/pages/gift-box-builder · Build Your Own Bundle https://kyari.co/pages/build-your-own-bundle · Doctors' Day Hamper https://kyari.co/collections/doctors-day-hamper
- **Content:** 101 blog posts, incl. SEO-heavy care guides and gift-occasion content — https://kyari.co/blogs/news (e.g. /blogs/news/why-plant-gifts-make-the-perfect-corporate-gifts, /blogs/news/kyari-plant-store-in-shark-tank-season-4)
- **Platform native:** Shopify Bundles / build-your-own-box (76 BYOB SKUs), Judgeme review app, GoKwik COD/payments, Capped Discount, hCaptcha storefront forms, Freshdesk support, Visual Website Optimizer (VWO), Cloudflare

### Site health — the brief asked specifically, and the answer is clean

**The site is live, fast and fully built. Not parked, not broken, not an incomplete build.** Evidence: HTTP 200 in 1.30s for a 1.79 MB homepage; `robots.txt` 200 with Shopify's UCP/MCP agentic-commerce endpoints (`https://kyari.co/.well-known/ucp`, `https://kyari.co/api/ucp/mcp`); sitemap index with live product/collection/page/blog sitemaps; Shopify Plus signals (`shopify-complexity-score-v2: 417`, UCP `version="2026-08-25"`); fresh catalogue timestamps (`published_at` 2026-10-03). **The only "parked/stale" artefact is a leftover Shopify bug:** counters rendering `0 Pin codes served across India / 0 Starting price per gift / 0 Brands trust Kyari / 0 Plants shipped to corporates` and `0+ Pin Codes Covered / 0 Days Avg. Delivery / 0% Damage-Free Guarantee` because the animated-count JS doesn't fire — https://kyari.co/pages/corporate-gifts-eco-friendly-sustainable. That is a self-inflicted credibility bug on their best B2B page.

---

## (c) THEIR ACTUAL MODEL

Kyari runs **seven distinct channels simultaneously** — this is the model lesson.

**1. D2C website (primary).** Shopify Plus, fully priced and cartable, free delivery above ₹399, plants from ₹249, tiered coupon engine visible sitewide: `FIRST` ₹50 off above ₹399; `NEWBUD` flat 5% above ₹499; `BREATHE8` 8% above ₹999; `REFRESH10` 10% above ₹1,999; `GLOW12` 12% above ₹2,999; `REVIVE20` 20% above ₹9,999. UCP/MCP endpoints mean AI shopping agents can transact. — https://kyari.co/ · https://kyari.co/robots.txt

**2. Corporate / B2B (enquiry-led, WhatsApp-first).** Dedicated microsite `corporate.kyari.co`, three Shopify landing pages (`/pages/corporate-gifting`, `/pages/corporate-gifts-eco-friendly-sustainable`, `/pages/corporate-gifts-plants`, `/pages/corporate-main`, `/pages/corporate-new-design`), a corporate enquiry form, and a **+91 9201962751 WhatsApp-first motion** with a "Request Custom Quote" CTA. **No downloadable catalogue PDF found on any property — UNVERIFIED whether one exists.** Pricing is **"starting ₹199 + request a quote," not transparent.**

**3. B2B wholesale/trade directory presence.** `kyari.co.in` (IndiaMART-hosted storefront, GST 27AAHCT0480D1ZI, "Payment Protected", 59% response rate, Pune/Talegaon address) and multiple IndiaMART listings. This is where per-piece trade pricing is visible: self-watering PP planter ₹60/piece; terracotta tray pots ₹37–₹70/piece; vermicompost ₹42/kg (MOQ 100 kg); Calathea Triostar with self-watering pot ₹199/piece; Aglaonema Ice with metal pot ₹999/piece; ZZ Green with metal pot ₹999/piece; Croton Petra ₹999/piece; Indoor Bamboo ₹349/piece; 5-in-1 fertiliser kit ₹65/piece. — https://www.kyari.co.in/ · https://dir.indiamart.com/pune/self-watering-planters.html · https://dir.indiamart.com/pune/terracotta-pots.html · https://www.indiamart.com/selectbrands-international/organic-vermicompost.html

**4. Marketplaces.** **Amazon.in** — live KYARI-branded ASINs for plants and pots, e.g. B0BFJ654KX (Money Variegated w/ Black SW pot), B0BDFNH4J2 (Spider w/ Green SW pot), B0BDDZBCD2 (Good Luck Jade w/ Cream SW pot, ₹290), B0B82X83WG (White SW pot), B09Y5W7YYD (Combo of 2 Black SW pots). **Fulfilled by "SelectBrands" on Flipkart** — https://www.flipkart.com/kyari-5-grey-self-watering-pots-indoor-plants-best-flower-planter-plant-container-set/p/itm1358db446c75f · https://www.amazon.in/KYARI-variegated-Watering-Kitchen-Bedroom/dp/B0BFJ654KX

**5. Quick commerce — 202 national SKUs across 4 platforms.** Zepto 69 SKUs, Blinkit 38 SKUs, plus Instamart; e.g. `50-in-1 Seeds Kit (25 Flowers + 25 Vegetables)` ₹499 on Blinkit; `Spray Bottle I Hand Trigger 500ml` ₹99 on Zepto; `Carpet Grass Planting Seeds` ₹149 on Blinkit; `KYARI Jade Plant in Self Watering Green Mylo Pot` ₹128 on Instamart. — https://www.quickcommercedata.com/brands/kyari

**6. Secondary Shopify storefronts.** `shop.kyari.co` (a **Cred × Kyari** co-branded store with its own price book — Monstera w/ Large Metal SW Pot ₹1,599, Areca Palm ₹1,439, Croton Petra ₹1,519, Monstera XL ₹2,639) and a legacy `kyarihome.shop` showing USD prices ($3.71, -70%) for overseas. — https://shop.kyari.co/ · https://kyarihome.shop/

**7. Social commerce / organic.** ~129K Instagram followers, 101 blog posts, Facebook, Pinterest, Plant Doctor consult, quiz, affiliate signup page (/pages/affiliate-signup), "Partner With Us" in the footer.

**Payment:** Shopify checkout, GoKwik integration, UCP/MCP, "100% secured payments". **UNVERIFIED:** whether COD is live for all PIN codes, and the exact payment-gateway mix.

---

## (d) THE ECO ANGLE — what is actually eco, and what is not

**This is the most important section in the report, because it is where the brief's premise and reality diverge most.**

### Every eco claim Kyari makes, with its source

| Claim (verbatim)                                                                                                                            | Where                                                                                                                                                        | Substantiated?                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _"To minimize our carbon footprint, the packaging is made of eco-friendly material."_                                                       | https://kyari.co/pages/about-us                                                                                                                              | **No.** No material spec, no certification, no % recycled content, no weight                                                                                                                                      |
| _"Your plants arrive safe and sound in **eco-friendly, shock-proof packaging** that retains moisture"_                                      | https://kyari.co/products/golden-money-plant-with-self-watering-pot                                                                                          | **No.** Same claim, PDP level. Also contradicted below                                                                                                                                                            |
| _"5-Ply Packing — Strong, sturdy packaging for safe transit. **Recyclable Material** — Eco-friendly and planet-conscious."_                 | https://kyari.co/products/golden-money-plant-with-self-watering-pot                                                                                          | **No.** "Recyclable" asserted without evidence; 5-ply corrugated is typically not the interesting part                                                                                                            |
| _"Sustainable remains central… eco-friendly packaging and a focus on **improving water efficiency** through self-watering planter systems"_ | https://www.passionateinmarketing.com/kyari-achieves-%E2%82%B9-20-crore-in-revenue-crosses-10-lakh-customers-and-targets-%E2%82%B9100-crore-revenue-by-2027/ | **Partially defensible** — self-watering genuinely reduces water use and death rate; but it's a _durability_ claim dressed as sustainability                                                                      |
| _"The Lumina Box – **Sustainable** Diwali Plant Hamper"_ ₹799                                                                               | https://kyari.co/collections/hampers                                                                                                                         | **No.** Only product with "Sustainable" in the name; no sustainable attribute stated                                                                                                                              |
| _"blending style and **sustainability** for thoughtful, memorable gifts"_                                                                   | https://kyari.co/pages/corporate-main                                                                                                                        | **No.**                                                                                                                                                                                                           |
| _"We deliver Eco Friendly Corporate Gifts… 4,000+ pin codes… Damage-free guarantee"_                                                        | https://kyari.co/pages/corporate-gifts-eco-friendly-sustainable                                                                                              | **No.** Eco is asserted, never defined                                                                                                                                                                            |
| "Grown in Controlled Environment", tissue culture, cocopeat/manure/perlite mix, 3-month hardening                                           | https://kyari.co/products/golden-money-plant-with-self-watering-pot                                                                                          | **Plausible but unverified.** This is the most substantive and most checkable claim they make                                                                                                                     |
| Organic inputs shelf (vermicompost, neem cake, cow dung, LECA, perlite, seaweed)                                                            | https://kyari.co/collections/plant-food                                                                                                                      | **Real products.** "100% Organic"/"100% Pure" claimed on IndiaMART for vermicompost — https://www.indiamart.com/proddetail/1kg-kyari-organic-vermicompost-powder-2855550398533.html. Certification **UNVERIFIED** |

### What is conspicuously absent

Searched the entire 428-SKU catalog for eco-bricks, seed balls, coir/jute/bamboo planters, terracotta, kraft, biodegradable and refill. **Zero hits.** Specifically, Kyari does **not** sell: seed balls, eco-bricks/eco-brick planters, coconut-coir planters or discs, jute-wrapped planters, terracotta (D2C), biodegradable pots, plastic-free packaging SKUs, or any refill/make-your-own mix system.

And there is a **direct internal contradiction** worth naming: Kyari's own homepage says _"You can opt from our collection of self-watering pots, **metal pits, plastic pots** or Terrarium pots"_ (https://kyari.co/), and IndiaMART lists its core product as **"Material: PP (Plastic)"** at ₹60/piece (https://www.indiamart.com/proddetail/plastic-self-watering-flowering-transparent-pot-planter-for-indoor-and-outdoor-25867941255.html); Amazon listings likewise declare **"Material | Plastic"** (https://www.amazon.in/KYARI-Crassula-Watering-Kitchen-Bedroom/dp/B0BDDZBCD2). A brand whose page is titled _"Corporate Gifts — ECO Friendly/Sustainable"_ sells, at volume, **PP plastic pots**. It has a collection literally named **"plastic-tax-collection"** (https://kyari.co/collections/plastic-tax-collection) and a **"Plastic Pots"** nav category.

**Interpretation:** Kyari's "eco" is **packaging-and-water framing on a plastic-and-metal product**. It is not a materials-innovation story at all. No plastic-elimination claim is made; no waste claim is made; nothing is substantiated.

**So: what would a genuinely eco-positioned indie do?** The gap Kyari leaves open is large and specific — real coir/jute/bamboo/terracotta planters, seed balls, plastic-free packaging with published materials, a published plastic-offset or waste number, and a refill/make-your-own soil system. Kyari's own accessories shelf (vermicompost, perlite, LECA, neem, seaweed, bokashi, cocopeat mixes) proves there is demand for the _inputs_; nobody has assembled the _system_. An indie can own "the honest eco plant brand" against a brand whose own product page says "plastic."

---

## (e) MOQ and the real customer profile

### Corporate/B2B order-size bands (all from Kyari's own pages)

| Band                  | Terms                                                                                                                                                | Source                                                                                                                   |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Entry                 | **₹199/unit, MOQ 30**                                                                                                                                | https://kyari.co/pages/corporate-gifts-eco-friendly-sustainable                                                          |
| 30+ units             | Logo engraving + custom printing available on all orders above 30 units                                                                              | same                                                                                                                     |
| 100+ units            | **Tiered pricing, priority fulfilment, dedicated account manager**                                                                                   | same                                                                                                                     |
| 4,000+ PIN codes      | Delivery within 7 working days; express slots in Mumbai, Delhi, Bengaluru, Hyderabad                                                                 | same                                                                                                                     |
| Transit               | _"proprietary packaging keeps plants healthy for up to 10 days in transit"_; _"arrives fresh — or we replace it free of charge, no questions asked"_ | same                                                                                                                     |
| **Conflicting claim** | _"Min. **50** Hamper Orders — Perfect for corporate & large-scale gifting"_                                                                          | https://kyari.co/pages/corporate-main                                                                                    |
| **Conflicting claim** | _"The minimum quantity for orders is **40** units"_                                                                                                  | https://kyari.co/pages/corporate-main (indexed snippet)                                                                  |
| Individual tier       | Free delivery >₹399; plants from ₹249; min cart discount thresholds ₹399/₹999/₹1,999/₹2,999/₹9,999                                                   | https://kyari.co/                                                                                                        |
| Replacement           | 10-day damage replacement guarantee; replacement dispatched within 2 days of ticket; damage claims after 15 days not eligible                        | https://kyari.co/products/golden-money-plant-with-self-watering-pot · https://kyari.co/pages/shipping-and-returns-policy |

**Note the MOQ spread: 30 / 40 / 50 across three Kyari pages.** For an indie, that inconsistency is a wedge — a buyer comparing quotes gets three different answers.

**Sample / trial-order policy:** **none found on any Kyari property.** No sample pack, no pilot batch, no "try 5 before you commit 500" offer. **UNVERIFIED** whether Kyari offers samples off-platform. **This is the single cheapest competitive wedge available to an indie: a free/low-cost 10–20 unit pilot with a photo report and a no-strings upgrade to 200.**

### Customer mix

- **D2C individuals:** the volume engine. 10,00,000+ customers; **~25% of revenue from repeat customers** — https://www.passionateinmarketing.com/kyari-founders-featured-in-forbes-30-under-30-asia-2026-list-brand-targets-%E2%82%B9100-crore-revenue-by-2027/. **Bengaluru is the highest-contributing city** — https://www.indianretailer.com/news/d2c-green-decor-brand-kyari-crosses-10-lakh-customers-india · https://www.passionateinmarketing.com/kyari-achieves-%E2%82%B9-20-crore-in-revenue-crosses-10-lakh-customers-and-targets-%E2%82%B9100-crore-revenue-by-2027/
- **Corporates:** "500+ brands"/"500+ clients", "1,00,000 orders fulfilled"; named logos HDFC Bank, boAt, Workie, Motilal Oswal, plus photo references to Adidas, Adani, Fevicol, Mia. **UNVERIFIED** beyond the four logos on `/pages/corporate-main`.
- **Resellers / trade / institutional:** IndiaMART-verified supplier, GST-registered, MOQ 100 kg on fertiliser, per-piece trade listings, a Telugu B2B directory listing (https://tigerpugb2b.com/pages/kyari), Vaaree (D2C marketplace, https://vaaree.com/products/kyari-oyster-plant-with-pot-white-18-cm), Amazon, Flipkart (fulfilled by SelectBrands), 202 SKUs across 4 quick-commerce platforms.
- **Government/institutional:** **no evidence found. UNVERIFIED / appears absent.**

---

## (f) MARKETING & FOOTPRINT

**Owned**

- **Instagram @try_kyari ~129.2K followers** — https://www.instagram.com/try_kyari/ · https://socialveins.com/influencer/instagram/try_kyari. An agency case study reports a 10M-view / 78K-follower / 200K-site-hit campaign — https://socialveins.com/case-studies/10m-views-100-content-200k-website-hits-socialveins-powerful-strategy-behind-kyari-s-market-breakthrough
- **LinkedIn 41,249 followers**, 51–200 employees — https://www.linkedin.com/company/trykyari
- Facebook https://www.facebook.com/Kyariofficial/ · Pinterest https://in.pinterest.com/try_try_kyari/ (linked in footer as https://in.pinterest.com/try_kyari/)
- 101 blog posts, ~40 care guides, 250+ pages — https://kyari.co/blogs/news
- Owned Shark Tank content loop — https://kyari.co/blogs/news/kyari-plant-store-in-shark-tank-season-4
- Homepage title uses the credential: _"India's #1 Plant & Pots Store | As seen on Shark Tank | Kyari.co"_ — https://kyari.co/
- Self-bought Shark Tank collections: /collections/shark-tank-india, /collections/sharks-choice, /collections/cred-products (a Cred co-brand) — https://kyari.co/collections/sharks-choice
- Seasonal campaign pages: Mothers' Day, Holi, Women's Day, Earth Day, Diwali, Doctors' Day, monsoon — https://kyari.co/pages/mothers-day · /pages/holi · /pages/womens-day · /pages/earth-day · /pages/doctors-day-hamper
- **Influencer/collaboration:** a HashFame profile exists ("1 brands connected in past 6 months") — https://hashfame.com/@try_kyari. Also a Shark Tank-season 4 "Face-Off" episode against **Nurturing Green**, which Kyari wrote up — https://kyari.co/blogs/news/kyari-plant-store-in-shark-tank-season-4 · https://www.filmibeat.com/ott/shark-tank-india-4-innovative-plant-based-businesses-in-face-off-episode-438613.html

**SEO footprint**

- Sitewide: 233 collections, 253 pages, 101 blogs. Faceted nav generates a large matrix — `/{f,l,j}-{office-desk,balcony,living-room,staircase,bedroom}-{stress-relief,air-purification,vastu-friendly,safe-for-pets,low-maintenance}` (https://kyari.co/collections/f-bedroom-air-purification etc.), i.e. room × benefit × size.
- Per-species care-guide pages for long-tail (`/pages/syngonium-pixie-white`, `/pages/calathea-trioster`, ~40 of them) plus per-collection care-guide collections (https://kyari.co/collections/philodendron-birkin-care-guide).
- Google-indexed discovery surfaces: Amazon listings rank; `kyari.co` pages rank for "shop online plants", "corporate gifts eco friendly".
- **Weakness: massive thin/duplicate page risk.** 253 pages include obvious test/stub artifacts — `/pages/tesing`, `/pages/testing`, `/pages/deal-test`, `/pages/quinnapi`, `/pages/pop-up-product-page`, `/pages/tesing`, plus duplicated gift-box-builder (`gift-box-builder`, `gift-box-builder-1`, `gift-box-builder-2`) and duplicated corporate pages — https://kyari.co/sitemap_pages_1.xml

**Reviews & trust footprint — this is where Kyari is genuinely weak**

| Surface                        | Signal                                                                                                                                                                                                    | Source                                                                                      |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **On-site product reviews**    | Strong on hero SKUs: Golden Money Plant With Self Watering Pot **4.8 / 228 reviews**; Vermicompost 30 reviews; Neem Oil 98 reviews; Vegetable Seed Bank 5.0/19; Chlora Sticks 4.8/25                      | https://kyari.co/products/golden-money-plant-with-self-watering-pot                         |
| On-site corporate testimonials | **"No reviews"** on all four corporate hampers; corporate testimonials are static marketing copy                                                                                                          | https://kyari.co/pages/corporate-gifts-eco-friendly-sustainable                             |
| **Trustpilot**                 | **1.4 / 5 — 78 reviews**, categories Home & Garden / Garden Center. Recurring themes: plants arriving in poor/dying condition, non-delivery, broken pots, unresponsive support, NCH escalation            | https://www.trustpilot.com/review/kyari.co · https://ie.trustpilot.com/review/kyari.co      |
| **Justdial (Indore)**          | **3.5 / 664 ratings** — listed as "Kyari.Co – Plant Nurseries", Aranya Nagar                                                                                                                              | https://www.justdial.com/Indore/KyariCo-Aranya-Nagar/0731PX731-X731-260409224340-X5Y1_BZDET |
| Consumer complaints            | voxya: 2 complaints, 1 resolved, 50% satisfaction                                                                                                                                                         | https://voxya.com/company/kyari-plants-complaints/1273135                                   |
| Third-party sentiment          | mool.ai: _"Predominantly negative regarding product quality, delivery delays, and unresponsive customer support… recurring complaints about damaged products, delayed shipments, and inadequate support"_ | https://mool.ai/information/kyari-co                                                        |
| Scamadviser                    | trust score 66, judged "legit"                                                                                                                                                                            | https://www.scamadviser.com/check-website/kyari.co                                          |
| In-house                       | _"Trusted by 5 lakh+ Happy Plant Parents"_ / _"Trusted by over 5 lac Happy Customers"_ (homepage marquee)                                                                                                 | https://kyari.co/                                                                           |

**The gap between "5 lakh happy customers" + Trustpilot 1.4/78 + Justdial 3.5/664 is the most exploitable weakness in this entire report.** 664 Justdial ratings at 3.5 means Kyari has a large volume of _locally visible, dissatisfied_ customers who are not the same people writing Amazon/Trustpilot reviews. Public, aggregated, quantified dissatisfaction on the search surface is a gift to any competitor.

---

## (g) WEAKNESSES — the openings

Ordered by how attackable they are.

1. **Trust gap at scale.** 5-lakh-customer claim vs Trustpilot 1.4/78 and Justdial 3.5/664. Volume means _someone_ is being served badly and saying so in public. **Opportunity:** publish a delivery-success rate, a damage rate, and a first-response SLA, and beat them on visible reliability. _(https://www.trustpilot.com/review/kyari.co · https://www.justdial.com/Indore/KyariCo-Aranya-Nagar/0731PX731-X731-260409224340-X5Y1_BZDET)_
2. **"Eco" is unsubstantiated and self-contradicted.** PP plastic pots on a page titled "ECO Friendly/Sustainable"; a `plastic-tax-collection`; zero eco-material SKUs. **Opportunity:** the entire honest-eco category is uncontested. _(https://kyari.co/pages/corporate-gifts-eco-friendly-sustainable · https://www.indiamart.com/proddetail/plastic-self-watering-flowering-transparent-pot-planter-for-indoor-and-outdoor-25867941255.html)_
3. **Zero corporate social proof.** Every corporate hamper shows "No reviews"; the Cipla/ICICI/TATA/Glenmark/Skechers testimonials are unlinked marketing copy; only 4 real client logos. **Opportunity:** publish verifiable case studies with volumes, cities, dates, named contacts and photos. _(https://kyari.co/pages/corporate-gifts-eco-friendly-sustainable)_
4. **Broken counters on the money page.** `0 Pin codes served`, `0 Starting price per gift`, `0 Brands trust Kyari`, `0% Damage-Free Guarantee` on the eco-corporate landing page — the animated-count JS fails. A corporate buyer sees zeros for the trust metrics that decide their purchase. **Opportunity: clean, data-dense, instantly-readable proof beats broken counters every time.** _(https://kyari.co/pages/corporate-gifts-eco-friendly-sustainable)_
5. **MOQ contradiction: 30 vs 40 vs 50** across three pages, plus "₹199 starting" against a real volume price of ₹564–₹825/unit. **Opportunity:** one published, honest, tiered price sheet with GST terms. _(https://kyari.co/pages/corporate-gifts-eco-friendly-sustainable · /pages/corporate-main)_
6. **No transparent corporate pricing, no downloadable catalogue, no sample policy.** "Request a Quote" + WhatsApp only. **Opportunity:** publish the price sheet, offer a free pilot batch. _(https://corporate.kyari.co/)_
7. **Corporate SKUs are a fiction.** 16 "for corporate" products at identical D2C prices. **Opportunity:** a real B2B price book with GST invoicing, lead times and T&Cs. _(https://kyari.co/collections/all/products.json?limit=250)_
8. **Public-policy weakness.** The Shipping & Returns page contains an unfilled template — _"Simply take a photograph/video and send it to ***\-----------***"_ — and says returns are only for defects/damage/wrong item, with buyer-paid shipping. Refunds 1–5 working days after inspection. **Opportunity: a plain-English, actually-readable guarantee.** _(https://kyari.co/pages/shipping-and-returns-policy)_
9. **Damaged-in-transit handling is a Google Form.** _"Damaged Replacement Form"_ hosted on docs.google.com. For a brand claiming 4,000 PIN codes and 1 lakh corporate orders, that is a mismatch. **Opportunity:** in-app claim flow with SLA. _(https://docs.google.com/forms/d/1uKbgh9QxNZzxCW4OOM8CbX8VhCs7JNXLI-bnvu_4Bec/)_
10. **Internal quality inconsistency in the catalog.** Visible from live data: **two products with the same title at different prices** (e.g. `Aglaonema Lipstick Plant With Self Watering Pot` ₹399 and `Aglaonema Snow White Plant With Self Watering Pot` ₹349 vs the same plant in the Medium Aura at ₹899; `Zamia Green - ZZ Plant With Self Watering Pot` appears at ₹375 and ₹909); **29 of 428 SKUs out of stock including corporate SKUs**; **products whose price is above their "compare_at_price"** — `Manhattan Bloom Fiberglass Planter Large Black` ₹5,499 vs "was" ₹3,999, and `City Globe Fiberglass Planter Medium Brown` ₹9,999 vs "was" ₹6,999 (i.e. currently _priced above_ the struck-through MRP); **the "Corporate main" page shows ₹999 vs ₹1,999 and ₹1,249 vs ₹2,199 for SKUs that are ₹899–₹999 on the live catalog**; a **leaked internal tag `tax checking issue`** on a corporate SKU. **Opportunity: an indie with 200 clean SKUs and a correct price file looks more professional than a 428-SKU incumbent.** _(https://kyari.co/collections/all/products.json?limit=250 · https://kyari.co/pages/corporate-main)_
11. **Seed pricing is indefensible.** All 32 single pouches at ₹99 regardless of count — 800–1,200-seed radish microgreen = ₹99; 24–36-seed capsicum = ₹99. **Opportunity: honest per-gram/per-seed pricing plus genuine grow-kits with coir discs and instructions.** _(https://kyari.co/collections/seeds/products.json?limit=250)_
12. **SEO hygiene.** Indexable stubs `/pages/tesing`, `/pages/testing`, `/pages/deal-test`, `/pages/quinnapi`, plus three duplicate gift-box-builder URLs. **Opportunity:** clean technical SEO from day one is free advantage. _(https://kyari.co/sitemap_pages_1.xml)_
13. **No Google Business Profile hygiene.** planttrade.in lists Kyari at "11th Floor, Skye Earth Corporate park" — a corporate office, not a nursery — while Justdial lists Aranya Nagar. **Opportunity: an indie with a real, visitable, photographed nursery owns local intent.** _(https://www.planttrade.in/nurseries/madhya-pradesh/indore)_
14. **Conflicting brand architecture.** kyari.co / corporate.kyari.co / shop.kyari.co (Cred co-brand) / kyarihome.shop (USD, -70% pricing) / kyari.co.in (Pune, "established 2021") / selectbrands.in. **Opportunity: one canonical identity.** _(https://kyarihome.shop/ · https://shop.kyari.co/ · https://www.kyari.co.in/)_
15. **Distribution dependency.** 202 SKUs on quick commerce, plus Amazon/Flipkart fulfilment by "SelectBrands" — margin and customer-data leakage to platforms. **Opportunity: own the customer relationship and the repeat purchase.** _(https://www.quickcommercedata.com/brands/kyari)_

---

## (h) WHERE KYARI SITS — and what an indie should take from it

### Competitive map

|               | **Ugaoo**                                                                                                              | **FNP / IGP**                    | **Kyari**                                                                                                                  |
| ------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Model         | D2C online nursery + own retail                                                                                        | Corporate gifting aggregator     | **Both: consumer D2C primary, corporate gifting secondary, wholesale tertiary**                                            |
| Scale         | ₹100 Cr ARR, 25-acre Talegaon farm, 36 polyhouses, 1,500+ SKUs, $7.6M+ raised (V3 Ventures-led ₹47 Cr round, Nov 2024) | Large pan-India gifting networks | **₹20 Cr+ revenue, 428 SKUs, 10L+ customers, PAT-profitable, bootstrapped + Ivy League, no disclosed institutional round** |
| Core promise  | Gardening breadth + science                                                                                            | Convenience + curation           | **"Green décor" + self-watering + Shark Tank**                                                                             |
| Price band    | ₹150–₹3,000                                                                                                            | ₹299–₹5,000                      | **₹99–₹9,999; median ₹399; corporate ₹199→₹825/unit**                                                                      |
| Owns growing  | **Yes**, at scale                                                                                                      | No                               | Partially — tissue culture + 3-month hardening claim                                                                       |
| Trust surface | Large brand                                                                                                            | Large brand                      | **Trustpilot 1.4/78, Justdial 3.5/664**                                                                                    |

Sources: https://yourstory.com/2025/04/ugaoo-startup-india-modern-gardening-movement-horticulture · https://economictimes.com/tech/funding/gardening-startup-ugaoo-raises-rs-47-crore-led-by-v3-ventures/articleshow/115218794.cms · https://www.thecompanycheck.com/company/b/kyari/bdctpv62umvz66fof

### So: competes with Ugaoo, with FNP/IGP, or with neither?

**Primarily with Ugaoo — in consumer D2C, from below and on a different vector.** Kyari's own competitor set is Ugaoo, Trust Basket, Greenkin, Nurturing Green, Green Shelter (per TheCompanyCheck), and its Shark Tank face-off was against Nurturing Green. Kyari is not competing with FNP/IGP on their turf; it is a **plant-brand that bolted on a gifting desk**.

**But — and this is the actionable part — it does NOT cleanly beat Ugaoo.** It is ~1/5 the revenue, 428 SKUs to Ugaoo's 1,500+, no farm, no funding round, no national fulfilment network, a broken trust surface, and no eco credentials. TheCompanyCheck's own competitor list for Kyari is _larger_ than Ugaoo's would be. **Kyari is a well-financed-looking, well-marketed, under-defended operator.**

### What an indie should learn — the real lesson

**The lesson is NOT "go head-on with Ugaoo." The lesson is: Kyari proves a small, well-positioned plant brand can cross ₹20 Cr and reach PAT-profitability without farm capital — and simultaneously proves that a consumer D2C brand with 10 lakh customers can bolt a corporate desk onto the same catalogue and get 500+ claimed corporate clients. The revenue comes from D2C; the gifting desk monetises the same SKUs at higher units and smoother cash.**

Three concrete strategic consequences:

1. **The winning wedge is not "better plants."** Kyari is already credible on plants. The wedge is **trust and honesty**: they claim 5 lakh happy customers and carry 664 Justdial ratings at 3.5 and 78 Trustpilot reviews at 1.4. A single published, verifiable reliability number (damage rate, on-time %, first-response SLA) is a sharper weapon than a better ZZ plant.
2. **The second wedge is genuine eco.** Kyari's own B2B page is titled "ECO Friendly/Sustainable" and sells PP plastic pots. An indie shipping in coir/jute/bamboo/terracotta with published packaging materials and a real plastic-elimination number owns a position Kyari _cannot_ take without a rebrand.
3. **Do NOT copy the price war.** Kyari's discount depth is extreme (compare-at ₹5,599 → ₹1,899; 66% off) and inconsistent (products priced above their own struck-through MRP). Competing on discount against a Shark Tank brand is suicide. Compete on **proof, materials and service guarantees** — the three things Kyari is worst at.

---

## (i) TEN OBSERVATIONS TO COPY OR BEAT

1. **COPY — the "plant + solved-care-mechanic" bundle.** Kyari's entire thesis is that people kill plants by over/under-watering, so every SKU ships plant-integrated-with-reservoir. It converts a hobby into a décor object, explains itself on the PDP, and defends a ₹349 price over a ₹99 plant. It is the single best product idea in this report. _(https://kyari.co/products/golden-money-plant-with-self-watering-pot)_

2. **BEAT — publish the reliability numbers they won't.** Their page claims "4,000+ pin codes / 7-day delivery / damage-free guarantee" while the counters render as 0 and the claim is backed by nothing. An indie that publishes on-time %, damage %, mean resolution hours, and a plain-English 10-day no-questions replacement guarantee converts Kyari's biggest weakness into its cheapest differentiator. _(https://kyari.co/pages/corporate-gifts-eco-friendly-sustainable · https://www.trustpilot.com/review/kyari.co)_

3. **BEAT — make the eco claim auditable, then prove it in court.** No seed balls, no coir, no jute, no terracotta, no plastic-free packaging, no waste figure — while selling PP plastic pots at ₹60/piece on IndiaMART. Ship in genuinely biodegradable materials, publish the packaging spec (material, grams, source, disposal), and quantify plastic avoided per order. Kyari cannot follow without breaking its brand. _(https://kyari.co/pages/corporate-gifts-eco-friendly-sustainable · https://www.indiamart.com/proddetail/plastic-self-watering-flowering-transparent-pot-planter-for-indoor-and-outdoor-25867941255.html)_

4. **COPY — the build-your-own-box mechanic at scale.** 76 BYOB SKUs across four size tiers with per-unit band pricing (5×4" at ₹599, 5×Aura at ₹599, "any 20 seeds for ₹1,099", "any 5 medium plants ₹660 each", "any 5 at ₹275 each"). It raises AOV, gives corporate buyers a self-serve quote, and makes the ₹399 free-shipping threshold trivial to clear. _(https://kyari.co/pages/mylo-byob · https://kyari.co/ · https://kyari.co/pages/build-your-own-bundle)_

5. **BEAT — one honest price sheet, published.** Kyari quotes ₹199 "starting", says MOQ 30 on one page, 40 on another, 50 on a third, and its real volume price is ₹564–₹825/unit. Publish GST-inclusive tiers, lead times, payment terms, damage-replacement SLA and T&Cs openly. Procurement teams will trust the transparent sheet over the "Request a Quote" funnel — and you win the small-and-mid corporate buyer (the ₹199 hampers are FNP/IGP territory anyway). _(https://kyari.co/pages/corporate-gifts-eco-friendly-sustainable · https://kyari.co/pages/corporate-main)_

6. **COPY — the per-species care-guide SEO moat.** ~40 species care pages plus per-collection care guides plus a 101-post blog plus a Plant Doctor video consult. Live plants are a high-intent, low-repeat-purchase category; care content is the only durable organic asset, and it also reduces damage complaints. _(https://kyari.co/pages/plant-care · https://kyari.co/blogs/news · https://kyari.co/pages/plant-doctor)_

7. **BEAT — the guarantee and the claim process.** Kyari's damage claim runs through a **Google Form**, dispatching a replacement "within 2 days of raising a ticket." Build in-app claims with an automatic photo upload, a published SLA and a prepaid reverse pickup. For bulk orders this is table stakes, and their current process would lose an HR head at a 500-unit onboarding batch.

8. **COPY — dual-channel economics, D2C as the cash engine.** Kyari gets volume from ₹325–₹999 consumer SKUs (median ₹399) and monetises the _same_ catalogue through a corporate desk at ₹564–₹825/unit with logo printing and multi-city delivery. An indie can launch D2C-cheap and corporate-priced off one inventory. Note they botched the mechanics — 16 "for corporate" SKUs priced identically to retail — so publish a genuine second price book. _(https://kyari.co/collections/hampers/products.json?limit=50 · https://kyari.co/collections/all/products.json?limit=250)_

9. **BEAT — clean catalogue hygiene as a trust signal.** Kyari ships 428 SKUs with duplicate titles at conflicting prices, 29 out of stock (including corporate SKUs), FRP planters priced _above_ their own "was" MRP, three contradictory MOQs, and a leaked internal tag (`tax checking issue`) visible in the live catalog. A tight 150–200 SKU range, one price per SKU, guaranteed in-stock core and correct compare-at pricing reads as more premium than a 428-SKU catalogue with visible errors. _(https://kyari.co/collections/all/products.json?limit=250 · https://kyari.co/pages/corporate-main)_

10. **COPY THE AMBITION, SKIP THE DEPENDENCY — and take the freed budget to trust.** Kyari put its money into being seen: Shark Tank (₹20 Cr brand value at a ₹100 Cr ask), Forbes 30U30, 129K Instagram, four quick-commerce platforms (202 SKUs), Amazon and Flipkart. That buys reach and hands margin plus customer data to platforms. For an indie, take the _ambition_ (own the category narrative, invest in content and a real nursery) but spend the money on **the nursery, the packaging, the guarantee and the reviews** — the four places Kyari is measurably weak (Trustpilot 1.4/78; Justdial 3.5/664; PP plastic pots on an "eco" page; claims on a Google Form).

---

## APPENDIX — verification notes

**Everything in this report was pulled live on 4 October 2026** via direct `curl` against kyari.co (HTTP 200), its sitemaps, its `products.json`/`collections/*/products.json` APIs, plus search-engine and registry cross-checks. Prices are the live variant prices Shopify returns; compare-at values are the struck-through MRP.

**Explicitly UNVERIFIED:**

- Ownership/lease of any farm, nursery or growing site (no farm address published anywhere; only Indore offices and a Talegaon _sales_ address)
- Manufacturing origin of the PP self-watering pots, the Zen/Arbor metal planters, or the FRP planters
- The GSTIN used for the D2C storefront (only the B2B GSTIN 27AAHCT0480D1ZI is published)
- The "500+ brands/clients", "1,00,000 orders fulfilled", "10,00,000+ customers", "25% repeat revenue", "₹20 Cr revenue", "PAT-profitable" claims — all from PR coverage (Indian Retailer / Passionate in Marketing / Forbes), not audited financials
- The Cipla, ICICI, Glenmark, TATA, Skechers, Adidas, Adani, Fevicol and Mia testimonials and client references — on-site marketing copy with no verifiable attribution
- Whether any downloadable corporate catalogue exists
- Whether COD is available on all PIN codes
- Whether free/trial sample batches are offered off-platform
- Government/institutional buyers — no evidence found
- Ownership/manufacture of the "Organic" certification claims on vermicompost

**Scraper limitation:** the Firecrawl-backed extractor rate-limited (HTTP 403) partway through this research, so several pages were pulled by direct `curl` and de-tagged locally instead. All figures above come from one or the other and are cited to a URL. No WhatsApp message or email was sent to any Kyari contact.

**Contact details recorded as facts (not contacted):** support@kyari.co · corporate@kyari.co · +91 8376885182 (support) · +91 9201962751 (bulk/WhatsApp) · wa.me/919201962751 · https://kyari-support.freshdesk.com/support/home
