# FNP & IGP: How India's Gifting-First Plant Sellers Work

**Purpose:** competitive teardown for a new Indian D2C plant business. These two are _not_ nurseries. They sell plants the way a florist sells roses — as a perishable, occasion-shaped, time-boxed gift — and that framing drives every decision below (pricing, packaging, delivery, refunds, corporate).

**Research date:** Oct 2026. All prices INR. Claims are cited to the page they came from; anything I could not verify on a first-party page is marked **[unverified]**.

**Method note:** `web_extract` was blocked (403 from the scraping backend) on fnp.com and igp.com, so primary pages were pulled directly via HTTP and parsed. Ratings/complaint data comes from Trustpilot, Sitejabber and consumer-complaint forums, which are third-party and unrepresentative in both directions.

---

## 1. The core insight: plants are an acquisition product for flowers, not a gardening category

Both sites are gifting engines that happen to stock greenery. The evidence:

- **FNP's plant taxonomy is occasion-first, then botanical.** The `/plants-lp` sidebar mixes real horticultural groupings (`/snake-plants-lp`, `/bonsai-plants-lp`, `/kokedama-plants-lp`, `/low-light-plants-lp`) with pure gifting buckets — `/plants/birthday-lp`, `/plants/anniversary-lp`, `/plants/house-warming-lp`, `/plants/diwali-lp`, `/plants/mothers-day-lp`, `/plants/fathers-day-lp`, `/plants/valentines-day-lp`, `/rakhi-gifts/for-plant-lover-lp`. Its occasion list on `/all-plants-lp` is: Birthday, Good Luck, Get Well Soon, Housewarming, Congratulations, Anniversary. Source: https://www.fnp.com/plants-lp, https://www.fnp.com/all-plants-lp
- **FNP's merchandising names are gift-language, not species-language.** Bestsellers on `/plants-lp` include `Lush Jade Prosperity Congratulatory Planter`, `Pure Elegance White Pothos Birthday Planter`, `Copper Green Plants Duo`, `Green Gift with Resin Pot`, `Tiny Friends Collection`. Source: https://www.fnp.com/plants-lp
- **IGP is even more explicit.** The `/plants` page opens with a "Plants For Special Occasions" rail that names the _feeling_, not the plant: Birthday ("Grow with plants!"), Anniversary ("Branch out forever"), Housewarming ("For a welcoming abode"), Speedy Recovery ("Stay young & green"), Congratulations ("Keep Blooming"), For Hosts ("Be a good guest!"), Thank You ("For helping me grow!"), Grief Companion ("Affirmation of life"), New Beginnings ("Root for their success"), Farewell ("A love beyond miles"), Baby Shower ("Bloom together"), Thinking of You. Source: https://www.igp.com/plants
- **IGP also sells plants as a _personality_ and _wellness_ gift** — "Gift by Personality: Minimalist / Relaxed / Extrovert / Nurturer / Happy-Go-Lucky / Flexible" and "Shop by Wellness: Stress Busters / Boosts Creativity / Heals from Within". Source: https://www.igp.com/plants
- **Cross-sell is the actual business model.** IGP bundles plants _into_ the flower and cake catalogue: "Chocolate Crown Cake and Lucky Bamboo Anniversary Combo ₹1,145" (90-Min Delivery), "Jade Plant And Chocolates Combo ₹895", "Palm Plant & Choco Almonds Combo ₹1,045", "Birthday Special Money Plant With Red Velvet Jar Cake ₹745". FNP does the same: "Stylish Green Gift N Chocolate Treat ₹1,099", "Luxe Leafy Birthday Gift Combo ₹799". Sources: https://www.igp.com/plants, https://www.igp.com/same-day-delivery-plants, https://www.fnp.com/plants-same-day-delivery-lp
- IGP's own nav puts `Gifts > Plants` under a gifting store that also carries `/cakes`, `/flowers`, `/gourmets`, `/jewellery`, `/diwali`, `/holi`, `/christmas`. FNP's footer carries "Corporate Service", "Decoration Services", "Affiliate Program", "Franchise". Sources: https://www.igp.com/plants, https://www.fnp.com/plants-lp

**Takeaway for a new D2C:** the incumbents' plants business is a margin-and-basket lever inside a gifting business. A pure plant D2C is not competing with them for the same demand — it competes for the _repeat purchase_, which gifting sites structurally cannot capture (you gift someone else, once).

---

## 2. Price bands and the gifting premium

|                         | FNP                                                                                                                                   | IGP                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Catalogue size (plants) | 479 items on `/plants-lp`; 327 on `/plants-same-day-delivery-lp` (page shows "16 of …")                                               | 195 items on `/all-plants`; 177 on `/same-day-delivery-plants`; 24 on `/plants-for-corporate-gifting` |
| Stated price filter     | ₹200 – ₹1,900 (`/plants-lp`); ₹200 – ₹2,200 (same-day)                                                                                | "Under 699" bucket plus Personalized / Combos / Hampers filters                                       |
| Observed low            | ₹249 Jade Plant In Gold Tone Metal Pot (`/desktop-plants-lp`)                                                                         | ₹395 Let Love Grow Jade Plant With Plastic Pot (₹620 MRP)                                             |
| Observed high           | ₹2,599 "Botanical Bliss Green Haven" curated 5-plant set (`/planters-lp`); ₹2,899 Aglaonema In Sydney Dish Pot on `/corporate/plants` | ₹2,145 Anthurium Plant with Jasmine Candle; ₹1,795 Ficus Microcarpa Bonsai                            |
| Typical mid             | ₹299–₹899                                                                                                                             | ₹645–₹1,245                                                                                           |
| Corporate SKU band      | ₹349 – ₹2,899                                                                                                                         | ₹545 – ₹1,795                                                                                         |

Sources: https://www.fnp.com/plants-lp, https://www.fnp.com/corporate/plants, https://www.fnp.com/desktop-plants-lp, https://www.igp.com/plants, https://www.igp.com/all-plants, https://www.igp.com/plants-for-corporate-gifting

### Bouquet vs potted plant (same platform, so the premium is directly measurable)

IGP flowers (https://www.igp.com/flowers, https://www.igp.com/roses):

- Orange Lily Happiness Bouquet ₹495 (₹545)
- Floral Gratitude Bouquet ₹645 (₹695)
- Serene Peach Roses Handtied Bouquet ₹645
- Cerise Rose Bouquet ₹695
- Blooming Grace Bouquet ₹745 (₹795)
- Mesmerising Red Roses Bouquet ₹795 (₹1,045)
- Radiant Sunflower & Rose Bouquet ₹825
- Radiance of Love Bouquet ₹895
- Blooming Symphony Gift Bouquet ₹1,045
- Lavender Luxe Roses & Daisy Bouquet ₹1,495
- Floral Enchantment Medium ₹2,345

IGP plants: ₹395 (Jade, plastic pot) → ₹645 (two-layer bamboo, terracotta) → ₹895–₹995 (jade/succulent in decorative planter) → ₹1,245 (three-plant set) → ₹1,795 (bonsai) → ₹2,145 (Anthurium + candle).

**Reading:** a bouquet and a mid-tier potted plant land in the _same_ ₹600–₹1,000 band. But the plant's marginal cost is higher (pot, ceramic/terracotta, substrate, taller and heavier parcel) and its perceived value in the listing is pushed upward by the vessel, not the plant. The premium is **packaging-as-product**: "Serene Jade Plant in a Buddha Planter ₹875", "Jade Plant With Sleepy Pup Planter ₹895", "Rocking Zebra Succulent in Guitar Buddy Pot ₹795", "Aglaonema Plant with Pichwai Planter ₹995" — the _pot_ is the SKU name. Source: https://www.igp.com/plants, https://www.igp.com/all-plants

**Versus actual nursery/bulk pricing** (the number that matters for a plant business):

- onlineplantscart.in: "Budgets usually land between ₹150 and ₹800 per unit depending on plant, pot and packaging"; most office orders 50–300 plants. https://onlineplantscart.in/p/bulk-orders-plants-online
- Kyari.co eco corporate gifts: "Starting ₹199 / unit · MOQ: 30 units". https://kyari.co/pages/corporate-gifts-eco-friendly-sustainable
- mytribe.in custom branded planters: "Starts from ₹110 per unit", MOQ 50. https://mytribe.in/manbhawannursery/corporate-event-gifting/custom-branded-planters
- Abana Homes corporate bonsai: MOQ from 10 units, up to 2,000+. https://bonsaiplantsonline.com/corporate-bonsai-gifting/

So **a single-unit gifting price of ₹600–₹1,200 is roughly 2–4× the ₹150–₹800 trade/nursery band for a comparable plant.** That gap is the entire gifting margin, and it is bought with pot + occasion framing + delivery promise, not with a better plant.

---

## 3. Packaging the gift

**FNP** (https://www.fnp.com/plants-same-day-delivery-lp, FAQ):

- Personalisation is explicit: "Personalise your express plant gifts with custom messages, decorative pots, or add-ons like chocolates or greeting cards."
- A named UI affordance: "Select the **'Add Personalisation'** option while placing your order."
- "Enhance your same-day plant gift with custom pots, **gift wraps**, or **handwritten notes**."
- Care instructions ship with every plant: "FNP includes basic care instructions with every plant… tips on watering, light requirements, and placement." (https://www.fnp.com/plants-lp, Q6)
- Personalisation is _not_ universal — the good-luck-plants page says "FNP offers personalised options on **selected** good luck plants and planters." (https://www.fnp.com/good-luck-plants-lp)
- Dedicated personalisation nav buckets: `/personalised-plants` (nav label "Personalised Plants"), plus "Plants with Quotes" style buckets on IGP.

**IGP** (https://www.igp.com/plants, https://www.igp.com/plants-for-corporate-gifting):

- Personalisation is a first-class filter: "Personalized" chip on `/all-plants`; a "Personalizable" badge on individual cards (e.g. "Personalized Bamboo Plant for Good Luck ₹845 — 5 (11) — Personalizable").
- Personalisation takes several forms visible in product names: _photo/name printed on the pot_ ("Personalized Self-Watering Dog Planter With Jade Plant ₹595", "Personalized Love You Mumma Photo Stand With Money Plant ₹645"), _name on a swing/stand planter_ ("Forever Soulmates Personalized Money Plant Swing Planter ₹695"), _engraved pots_ (IGP corporate page: "Jade Plant in White Personalised Ceramic Pot"), and _text/quote cards_ ("Plants with Quotes" collection).
- IGP has a DIY angle the incumbents use to raise AOV: "Our Do-it-Yourself indoor plants give you a slight flexibility to customise plants… Pick your own pot, choose your own plants, add your personal note, or personalize the planters with photos and names."
- Hamper tiering: `/plants` links "Plant Hampers — Always a delight to open" and "Plant Bundles — The more the merrier!" e.g. "Pleasant Jade Plant Birthday Hamper ₹1,165 (₹1,395)", "Natures Delights Gift Hamper ₹1,695", "Joyful Moments Delight Hamper ₹1,495".
- Bumpers/bundles as merchandising: IGP "Add an Extra Touch — Small tokens with bigger impact".

**What neither publishes:** gift-wrap material, box spec, or whether the ceramic/terracotta pot is the shipping box. **[unverified]** — no first-party packaging spec page found.

---

## 4. Delivery: the actual product

### FNP

Delivery tiers (https://www.fnp.com/, https://www.fnp.com/good-luck-plants-lp, https://www.fnp.com/info/disclaimer):

- **Same-Day (standard)**, **Express / 30–60 minute** (metro, eligible items), **Fixed-Time slot**, **Midnight (11:00–11:59 pm)**, **Next-day**, **Standard (2–5 days)**, **International (70+ countries)**.
- Cut-offs: same-day standard orders must be in before **6:00 pm IST**; same-day fixed-time before **6:30 pm**; same-day midnight before **7:00 pm**. Mon–Sun. (https://www.fnp.com/info/disclaimer)
- Fixed-time promise is explicitly fuzzy: "We cannot commit the exact time for delivery… the order will be delivered **+30 or -30 minutes** as per selected time." (https://www.fnp.com/info/disclaimer)
- Same-day plant cities named on the LP: **Delhi, Mumbai, Bangalore/Bengaluru, Hyderabad, Chennai, Pune**; "Check your PIN code during checkout." Broader same-day claims elsewhere: "Same-Day in 80 Cities" (https://www.grabon.in/fernsnpetals-coupons/).
- Reach claims are inconsistent across FNP's own pages — homepage says **700+ cities / 4,000+ PIN codes** on the plants page, **19,000+ PIN codes** on the homepage, **4,600+ cities** in an About snippet, and the Google Play listing says **350+ cities and 120+ countries**. Treat all as marketing; only the PIN-code checker is verifiable. (https://www.fnp.com/plants-lp, https://www.fnp.com/, https://www.fnp.com/info/gifts-delivery-cities, Play Store listing)
- Same-day also offered internationally to "select countries, including the UAE, Malaysia, and Indonesia." (https://www.fnp.com/plants-same-day-delivery-lp)
- Express/same-day carries a fee: "nominal charges apply for same-day plant delivery… exact cost will be displayed during checkout." (same page)

### IGP

- **Same-day, next-day, one-day**, plus **90-minute** and **midnight/fixed-time** on eligible items. Same-day plants listing shows a **90-Min Delivery** badge on at least one SKU ("Chocolate Crown Cake and Lucky Bamboo Anniversary Combo ₹1,145 — Same Day Delivery — 90-Min Delivery"). Sources: https://www.igp.com/plants, https://www.igp.com/same-day-delivery-plants
- Claimed footprint: "Cities having same day delivery **100+**", "Countries being served with happiness **100+**" (https://www.igp.com/igp-select).
- **Same-day/fixed-time/midnight must be placed 24 hours in advance**; same-day needs ordering before 6 pm. (https://www.igp.com/faq)
- **The key structural weakness: plants are _not_ covered by exact-date delivery.** IGP: "**Exact date delivery is available only in case of flowers & cakes.** We deliver all our flower & cake orders within 24 hours and they are shipped locally… For all other gift items which are couriered, the date of delivery that you select is only **tentative**." Plants ship from warehouses/vendors, not locally. (https://www.igp.com/faq)
- IGP also warns orders **split into multiple shipments**: "all the items in your order may not arrive on the same day… you will be able to see in how many shipments will your order be split." (https://www.igp.com/faq) — corroborated by a customer complaint about a 4-item order arriving across 9 days (Sitejabber, https://www.sitejabber.com/reviews/igp.com).
- No tracking for flowers/cakes; plants do get courier tracking. Domestic address change/redelivery free; international up to **₹1,200** per reattempt. (https://www.igp.com/faq)
- Free standard shipping in India on most products; nominal fee for midnight/enhanced. (https://www.igp.com/faq)

---

## 5. Corporate / B2B bulk gifting

**FNP** — https://www.fnp.com/corporate/ and https://www.fnp.com/corporate/plants

- **MOQ: 50 units.** "The minimum order quantity for corporate gifts is 50." Contact: `sale@fnp.com`, +91-9711304340.
- Sales motion is **human-led, not self-serve**: "Book your corporate gifts with 4 simple steps — 01 Enquiry Form → 02 An Overview Call → 03 Choose Your Gifts → 04 Express Delivery." Catalogue is a **download**, not a live bulk catalogue. "To place a bulk order, simply call us… or email us."
- **You cannot check bulk pricing on-site.** Prices shown on `/corporate/plants` are list prices (₹349–₹2,899); "we offer attractive discounts on bulk corporate gift orders" and "FNP offers corporate pricing and bulk discounts" with no published tiers. **[gap]**
- Personalisation for corporates: "Organizations can personalize gifts by adding a **logo, monogramming, or messages**"; "customise the packaging, **pot branding**, and messaging to carry your organisation's identity through the gift." (https://www.fnp.com/corporate/diwali-gifts)
- Delivery promise for corporate: "**PAN-India delivery, scheduled dispatch, and same-day delivery in select cities**"; "same-day, next-day, or fixed-time delivery to meet tight deadlines."
- Occasion segmentation is unusually granular for plants: Diwali, New Year, Makar Sankranti/Pongal/Lohri, Republic Day, **Employee Appreciation Day**, Women's Day, Holi, Eid-al-Fitr. Employee-journey segmentation: Onboarding & Welcome Kits, Employee Birthday & Anniversary Gifts, Awards/Rewards & Recognition, Client & Business Gifting — plus 18 international country buckets.
- Budget bands published for corporate: "Under INR 500 / Under INR 1000 / Under INR 2000", and "Economical gifts (below ₹500): Perfect for bulk purchases."

**IGP** — https://www.igp.com/corporate-gifts, /corporate-gifts/plants, /plants-for-corporate-gifting

- **MOQ 50, but self-serve with published per-SKU minimum quantities.** "You cannot place a bulk order at the IGP website directly. However, we do have a corporate sales & bulk orders team… bulk orders as small as **50 pieces to as large at 10,000 pieces**. Please write to us at sales@igp.com." (https://www.igp.com/faq)
- Corporate _catalogue pages_ do expose **"Minimum Quantity: 5"** on individual corporate SKUs (e.g. "Jade Plant in Round Glass Vase ₹945 — Minimum Quantity: 5", https://www.igp.com/corporate-gifts/xmas-new-year-gifts) and **MOQ 20–300** on Diwali hampers (https://www.igp.com/corporate-gifts/diwali-gifts) — i.e. IGP is willing to transact at 5–20 units where FNP insists on 50. That is a real, exploitable gap.
- Branding: "**logo printing, personalised labels, and branded packaging**"; corporate plants page: "Most planters feature the corporate brand identity through their **logo, motto, and texts printed on the planters**"; "customization options such as **logo printing, image and text additions**". Logo is applied "For bulk orders… to the plant pots."
- Contacts published: business@igp.com, 022-43433366, +91-(22)4343-3333.
- Corporate copy is employee-benefit-framed: "boosting morale", "customized corporate gifts that not only last long but also grow with time", "for employees or clients, or business partners". Return-gift use case is explicit: succulents "make perfect… **return gifts at corporate events**".
- Free delivery on corporate plant orders claimed: "We also offer free delivery to your office or home"; "IGP offers bulk corporate plant orders with **free delivery**."
- **Invoicing/GST: not mentioned on either corporate page. [unverified]** — no GST invoice / e-invoicing / PO-terms statement found. Standard practice is presumed but not documented.
- **Neither site documents bulk delivery SLA for a single multi-destination shipment.** FNP says "scheduled dispatch"; both say dispatch-to-many-addresses works (implied by employee-birthday gifting) but neither publishes a split-shipment policy for corporate. **[unverified]**

**Indie benchmark for comparison** (the niche FNP and IGP under-serve): onlineplantscart.in publishes 24–72 hr NCR dispatch, **7-day replacement on transit damage**, floor-by-floor placement, GST invoice on every order, itemised quotes with plant/pot/qty/rate/GST, partial advance, budgets ₹150–₹800/unit, and 300+ varieties. Kyari: MOQ 30, tiered pricing above 100 units, dedicated account manager, 4,000+ PIN codes in 7 working days, logo engraving above 30 units. Abana: MOQ from 10 units, mockup approval step, up to 2,000+ units. Sources: https://onlineplantscart.in/p/bulk-orders-plants-online, https://kyari.co/pages/corporate-gifts-eco-friendly-sustainable, https://bonsaiplantsonline.com/corporate-bonsai-gifting/

---

## 6. Payments, COD, loyalty

**COD: neither offers it, and they say the same reason.** FNP FAQ and IGP FAQ both: "No, we do not provide COD option for a simple reason that the sender of the gift (who buys the gift & is responsible for the payment) is invariably different from the recipient of the gift." Sources: https://www.fnp.com/info/faq, https://www.igp.com/faq

- **COD fee: N/A — there is no COD.** (Third-party sites claim FNP accepts COD "with no additional fee"; that directly contradicts FNP's own FAQ. Treat as unreliable.)
- FNP payments: Visa/Master/RuPay/Amex credit & debit, net banking, digital wallets, UPI, PayPal, gift certificates. (https://www.fnp.com/info/faq, https://www.fnp.com/info/terms-and-conditions)
- IGP payments: credit cards (Visa/Master/Maestro/Amex, domestic + international), debit cards, net banking (domestic only), wallets (PayTM, SBI Buddy, MobiKwik), PayPal. (https://www.igp.com/faq)
- **Coupon mechanics:** IGP — one code only, "You cannot apply both coupon code and gift voucher at the same time"; codes must be applied pre-payment, never after. FNP — coupons and gift certificates both exist, each usable once, "multiple coupons cannot be combined in a single order."
- Guest checkout: IGP FAQ has the question "Can I order from IGP without creating an account (Guest Checkout)?" with the answer collapsed/not rendered in the fetched text. **[unverified]** whether IGP supports guest checkout.

**Loyalty / retention**

- **IGP Select** (https://www.igp.com/igp-select, https://www.igp.com/select-tc, https://www.igp.com/faq): paid membership, **₹999 list price**; product page shows "₹99 ₹999 90% OFF" (https://www.igp.com/p-igp-select-membership-412810); the IGP Select landing copy shows "₹999 … ₹299 / year" — **three different prices appear across IGP's own pages [conflicting]**. Third-party review site claims ~₹99 first year renewing near ₹999 (https://reviewkong.com/brands/igp — treat as indicative).
  - Benefits: **5% wallet cashback on all orders, valid 3 months**; free & discounted delivery (domestic only); priority service; "no minimum order value"; headlined "Unlock savings worth ₹ 3,000".
  - Terms: 1-year validity, **non-refundable, non-transferable**, **cannot be cancelled once paid**, IGP may change fees/thresholds at sole discretion, and it is **void for anyone buying for resale** — which is precisely the bulk-corporate buyer.
- **FNP has no first-party loyalty programme for India.** FNP's own FAQ/terms describe coupons and gift certificates, not points. Claims of an "FNP Loyalty Club" or Air India Maharaja Club points come from coupon-aggregator blogs, not FNP. **FNP.sg does run a paid "Gold Membership Program" with free standard shipping — but that is the Singapore entity, not fnp.com. [unverified for India]**
- FNP's actual retention play is **occasion reminders**, not points: the app "can help you find a gift in less than 15 seconds with an easy gift-finder search. You can also set **reminders for birthdays, anniversaries**, etc." (https://www.fnp.com/ and Google Play listing). Both sites show "My Reminders" in the header (https://www.fnp.com/plants-lp).
- FNP acquisition discounting is heavy and wallet-partner-funded: code **FNPONE** (up to 15% first order), **NEWAPP** (up to 20% first app order), plus Mobikwik cashback up to ₹750, Airtel Payments Bank flat ₹100, Amazon Pay up to ₹250, Slice UPI up to ₹250, CRED up to ₹200. Sources: https://www.fnp.com/, https://www.grabon.in/fernsnpetals-coupons/
- IGP's structural retention asset is the **IGP wallet**: cancellations refund to wallet, cashback lives in wallet for 3 months, and cashback is reversed (or deducted from your refund) if you cancel the order it came from. (https://www.igp.com/faq, https://www.igp.com/select-tc)

---

## 7. Complaints — where the model actually breaks

Both sites market 4.8–4.9/5 on-platform. Off-platform they are 1.2–3.4/5. That gap _is_ the opportunity.

**Plants specifically**

- "Spent rupees **1350 on a plant gift**. The pot was cracked and the plant was damaged (multiple torn leaves, brown diseased spots)… response received 'We have rechecked with our vendor management team and we have been informed that **the best we can do is 20% instant cash of the product amount credited into your IGP Wallet**'." (https://www.trustpilot.com/review/www.igp.com?page=4)
- "The **broken pot** was delivered… the delivery boy left outside my apartment… they said we apologise and can give u **20% refund**." (https://www.trustpilot.com/review/www.interflora.in)
- FNP: "I had ordered a lucky bamboo and a Jade plant. **The pot size is supposed to be 4x4 inches, and the plant size 8-10 inches.** Both plants were delivered in small-sized pots (3x3 inch) and the plant sizes are small (5-6 inches) too." (https://au.trustpilot.com/review/fnp.com?page=10)
- FNP: "Potted Rose Plant… could not reach yesterday… when i checked the status of order i get a message that **Plant is not available so opt for another Jade plant** which i don't want." (https://www.trustpilot.com/review/fnp.com)
- FNP (Singapore entity, but same playbook): personalized pot arrived **without the uploaded photo**, plant near-dead, resolution was a coupon, not a replacement. (https://www.trustpilot.com/review/fnp.sg?page=2)

**Delivery failure**

- IGP rated **3.3–3.4/5 on Trustpilot** across regional Trustpilot pages; **1.2/5 on Sitejabber from 109 reviews**, where the top complaint themes are "customer service, day delivery and order number" (https://www.sitejabber.com/reviews/igp.com). FNP sits at **~3.4/5 from ~720 reviews** (https://www.trustpilot.com/review/fnp.com).
- Non-delivery and refund refusal dominate IGP: "I ordered around 5 Rakhi with gifts, but one of the Rakhi was not delivered on time. The response to our concerns was also extremely poor, **even though the payment had already been collected**." (https://www.consumercomplaints.in/bycompany/igp-a501586.html)
- Orders **marked delivered but not received** — "the app is showing delivered… they are saying delivery boy taken my order with him." (https://www.consumercomplaints.in/bycompany/igp-a501586.html)
- Split shipments losing items: a 4-item order where one arrived on date, one 3 days late, and "the last 2 items are either lost, delivered to someone else or not dispatched **9 days AFTER** the delivery date." (https://www.sitejabber.com/reviews/igp.com)
- International: "i ordered for overseas address and within 4 days it was showing returned as address not found… they are neither telling where it is nor refunding." (https://www.trustpilot.com/review/www.igp.com?page=4)

**Hidden charges at checkout**

- "I ordered a birthday gift… a good luck plant and a box of chocolates… 2nd issue, **extra delivery charges which is not mentioned upon purchasing**. I am so embarrassed when I found out from the birthday celebrant about the extra charge." (https://www.sitejabber.com/reviews/igp.com)
- FNP: "They did not deliver order on time and when delivered, it was ordered with **some other cheap alternate order** that too without prior notice… They charged 3 times more than the value of items delivered." (https://www.trustpilot.com/review/www.igp.com?page=10 — filed against IGP-family flow; treat the "cheap alternate substitution" theme as cross-platform)

**Support responsiveness**

- "My money is stuck in **igp wallet**. OTP is required to use wallet money but otp is never received. **Customer Service is non existent.**" (https://www.trustpilot.com/review/www.igp.com)
- "I reached their customer support at 8:40 PM via their WhatsApp link. I got a reply at **4:00 AM** (next day) — saying my delivery date couldn't be changed… After 7+ hours, their agent… said: 'No response from your side (at 4 AM), so we're closing this chat.'" (https://www.sitejabber.com/reviews/igp.com)
- Escalation paths are named but unresponsive: "I escalated to the Compliance Officer… I have received **ZERO response from the grievance team**." (https://www.trustpilot.com/review/www.interflora.in)
- FNP: "Instead of properly refunding us… they offered a **discount on a future order** — essentially asking us to spend more money with them after they had already failed us." (https://www.trustpilot.com/review/fnp.com)
- FNP publishes a grievance officer on-page (Mr. Sagarjit Karmakar, grievance@fnp.com, +91 9212422000) and an 8:00 AM–10:30 PM support line — process exists; outcomes still fail. (https://www.fnp.com/plants-lp footer)

**The refund policies that generate the complaints (first-party, and they are strict)**

- **FNP:** "Complaints must be raised within **48 hours** from the time of delivery. After this period, we will not be able to register complaints." Damaged/defective/incorrect → replacement, possibly with reverse pick-up first. **No returns allowed.** Refund either as a **gift certificate within 24 hours** or to the original payment method in **7–10 working days**. **No refund** where perishable items (explicitly including plants) go to a wrong sender-supplied address, where the recipient isn't present or refuses, or where quality issues stem from post-delivery handling. Source: https://www.fnp.com/info/faq, https://www.fnp.com/info/terms-and-conditions
- **FNP courier orders:** delivery attempted twice, then "the delivery shall be deemed to have been made… **you shall still be charged for the order**", with wrong address / recipient unavailable / premises locked / refused all counted as executed. Requested delivery date is explicitly "**non-binding**". No third-party courier deliveries on Sundays or public holidays. Source: https://www.fnp.com/info/disclaimer
- **FNP substitution:** "In an event where a product that you have ordered is out of stock or unavailable, we will contact you to give an option of an alternate product. **If we are unable to get in touch with you, we will proceed with sending you the alternate product.**" (https://www.fnp.com/info/terms-and-conditions) — this is exactly the "you ordered a Jade plant, you got a Jade plant" complaint in §7.
- **IGP:** "Since products are perishable and personalized we do not accept returns or exchanges after an order has been delivered." Courier items: replacement re-delivered in **3–5 days**. Hand-delivered (flowers/cakes): replacement within 24 hours, no returns. Refunds to original source in **5–7 working days**. **No partial cancellations** — if not dispatched you must cancel everything and re-order; if dispatched, no cancellation at all. Cancellations refund to the **IGP wallet**, not the payment source. Source: https://www.igp.com/faq
- **The 48-hour complaint window is the single biggest structural risk** in a plant business: a wilting or damaged plant often declares itself _after_ 48 hours, which is exactly when both incumbents' policies stop paying. **[assessment]**

**A quality signal worth stealing and one worth avoiding**

- Steal: IGP publishes real care content on-page — "How does the self-watering planter work?", "How often should I mist my plants?", how to spot a dying plant, and even a named fertilizer shortlist (Miracle-Gro, Espoma, Osmocote). It reads like a plant-care site that happens to sell gifts. (https://www.igp.com/plants FAQ)
- Avoid: the review widgets on both plant pages surface overwhelmingly positive snippets ("Great service", "The packaging is amazing") while off-platform ratings are 1.2–3.4/5. On-platform social proof is curated, not representative. **[assessment]**

---

## 8. Mobile-first UX and checkout friction

Observed from the fetched page markup and listings:

- **Both are mobile-app-led.** FNP pushes the app hard: gift-finder search, "find a gift in less than 15 seconds", social logins, PIN-code finder, occasion reminders, midnight/same-day/international delivery, multiple payment options; "Super-Fast 60 Minutes Cakes delivery in metro cities"; "Covering 350+ Cities and 120+ Countries". App-only discount **NEWAPP** up to 20% vs web **FNPONE** up to 15% — the app is deliberately the cheaper channel. (https://www.fnp.com/, Google Play listing)
- **IGP is web/app-parity with a heavier legacy feel** — desktop-classified markup, "IGP only takes online orders through its website… We do not take any order on phone or via email and we do not have retail outlets." (https://www.igp.com/faq) Their search surfaces a help line and email on every page but pushes ordering to self-serve.
- **Location-first, not browsing-first.** Both open with a "Where to deliver?" / "Location missing" pincode prompt; FNP surfaces "Find Plants Near You → Plants in Mumbai / Delhi / Bengaluru / Chennai / Hyderabad / Pune / Kolkata / Ahmedabad". IGP's `/plants` ends with a "For products deliverable to this location / Show More products" pattern. Both therefore degrade to a near-empty catalogue when no pincode is set — a real conversion risk that an indie can avoid with unconditional browsing.
- **Serviceability is resolved late.** FNP: "Delivery availability depends on the selected product and destination… check serviceability by entering the recipient's pincode while placing the order." (https://www.fnp.com/good-luck-plants-lp). IGP: same-day requires 24-hour advance booking (https://www.igp.com/faq). So a customer can spend 8 minutes personalising a pot and only learn at checkout that it can't make the date.
- **Filters both sites do well:** FNP plants — Price min/max slider, Plant Type, and sort by Recommended / Bestsellers / FNP Luxe / Same Day Delivery / New Arrivals. IGP plants — Under 699 / Personalized / Combos / Hampers chips, sort Popularity / Latest / Price, plus "Same Day Delivery" and "Corporate Gifting" quick links and a "With Quotes" collection.
- **Friction that is genuinely low:** guest checkout (IGP question exists, answer not rendered — **[unverified]**), one-coupon-per-order, codes applied pre-payment.
- **Friction that is high:** account creation is effectively mandatory on IGP — "you are required to sign up once on our website with your proper email id and phone number." And the prepaid-gift model forces the sender to enter the _recipient's_ full address and phone on someone else's behalf, which is where the wrong-address complaints originate.

---

## 9. What an indie D2C can do better

### Where the incumbents are structurally weak (verified gaps, not opinions)

1. **No plant business has repeat purchase.** Both models end at the recipient's doorstep. Nobody owns the second order — no care reminders, no repot/replenish cycle, no "your jade is 8 months old, here's a planter upgrade". Neither site has a plant subscription (FNP's subscription is flowers-only, **[unverified for plants]**). An indie that owns _aftercare_ — scheduled watering reminders, fertiliser refills at 90/180 days, seasonal repot offers — captures a LTV the gifting sites structurally cannot.
2. **Corporate is a human, offline, opaque sale.** FNP: MOQ 50, phone/email only, downloadable catalogue, no published price tiers, no mockup step. IGP: no on-site bulk ordering at all ("You cannot place a bulk order at the IGP website directly"), sales@igp.com, prices only visible at MOQ 5–300 on campaign pages. Meanwhile specialist plant sellers publish **MOQ 10–30, ₹110–₹199/unit entry pricing, itemised GST quotes, mockup approval, 7-day transit-damage replacement, and tiered pricing above 100 units** (https://onlineplantscart.in/p/bulk-orders-plants-online, https://kyari.co/pages/corporate-gifts-eco-friendly-sustainable, https://mytribe.in/manbhawannursery/corporate-event-gifting/custom-branded-planters). That is a _category_, not a niche, and the two largest players are absent from it.
3. **Refund/compensation policy is the biggest brand-negative.** Recurring pattern across both: 20–30% wallet credit or a future-order coupon after a cracked pot or a dead plant. IGP's "20% instant cash of the product amount credited into your IGP Wallet" is quoted verbatim in reviews. Meanwhile plant-selling specialists offer **7-day replacement on transit damage** (https://onlineplantscart.in/p/bulk-orders-plants-online). A published no-questions replacement window is a cheap, decisive differentiator.
4. **48-hour complaint window is exploitable against them.** Both policies require reporting within 48 hours; a wilting plant usually reveals itself later. Publishing a **14-day "plant not thriving" replacement-or-credit window** costs little (the plant's marginal cost is ~₹150–₹400) and directly attacks their worst-rated theme.
5. **No price transparency on delivery or on the plant itself.** IGP reviews report "extra delivery charges which is not mentioned upon purchasing"; FNP's own FAQ says charges are "displayed during checkout". Show landed price up front, including the express/midnight fee, on the PDP.
6. **Quality-spec drift.** "Pot size is supposed to be 4x4 inches… delivered 3x3 inch." Publish the pot diameter and plant height as a spec on the PDP and ship to it.
7. **Substitution without consent.** FNP will ship an unapproved alternate if it can't reach you. For a gift, an unapproved substitute is a 100% failure, not a 50% one. Make substitution opt-in, or refund.
8. **Bulk delivery to many home addresses is unaddressed.** Hybrid/remote teams need individual home delivery; both sites imply it, neither documents it. onlineplantscart publishes it explicitly as a selling point.

### Where the incumbents are strong and a challenger should respect

- **The occasion rail is the acquisition engine.** IGP's 12 named occasions with emotional taglines ("For helping me grow!") outperform FNP's plant-name-driven merchandising. Occasion pages must exist day one, but build the _emotional_ version, not the botanical version.
- **Personalisation must be visible in the listing, not hidden behind an "Add Personalisation" link.** IGP's "Personalizable" badge is a filterable chip and drives a distinct higher-priced sub-catalogue (₹595–₹945 personalized vs ₹395–₹545 basic). FNP's same-day LP hides it behind a post-add-on step. Badge it and filter it.
- **The pot is the product name.** "Jade Plant With Sleepy Pup Planter", "Serene Jade Plant in a Buddha Planter", "Zebra Succulent Personalized With Ceramic Planter". Vessels create the willingness to pay ₹400–₹600 over a nursery plant — name the SKU for the pot.
- **Same-day is table stakes in 6 metros, not a moat.** FNP: Delhi, Mumbai, Bengaluru, Hyderabad, Chennai, Pune. IGP: "100+ cities". Compete on _reliability and care_, not on speed claims.
- **Never promise exact dates on couriered plants.** IGP admits outright that exact-date applies only to locally-sourced flowers and cakes, and that couriered items get a "tentative" date. Owning that honesty — plus a real transit SLA and photographed handover — is a genuine edge.

### Concrete positioning

| Axis      | FNP / IGP                                                              | Indie opportunity                                                                    |
| --------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Buyer     | Sender, one occasion, one recipient                                    | Sender + the plant's long-term owner                                                 |
| Repeat    | Occasion reminders only (FNP) / wallet lock-in (IGP)                   | Care calendar, replenishment, repot & upgrade cycle                                  |
| Catalogue | 195–479 SKUs, occasion + botany + personality + wellness               | Fewer SKUs, each with care spec, pot dimension, survival guidance                    |
| Price     | ₹395–₹2,145 gifting (2–4× nursery)                                     | Keep gifting SKUs at ₹499–₹1,499; add honest plant pricing for self-buy              |
| Corporate | Human/offline, MOQ 50 (FNP) or 5–300 on campaign pages (IGP), no tiers | Self-serve MOQ 10, published tiers, mockup approval, GST invoice, split-shipment SLA |
| Recovery  | 48h complaint window; 20–30% wallet credit                             | 14-day replacement-or-credit, published                                              |
| Payments  | Prepaid only, no COD, one coupon/order                                 | Prepaid + UPI; published landed price                                                |
| Trust     | 4.9 on-site, 1.2–3.4 off-site                                          | Close the gap: real reviews, photo proof, published SLA                              |

### Things I could not verify

- FNP's COD stance is contradicted by third-party sites claiming COD with no fee; FNP's own FAQ says **no COD**. FNP's own page wins.
- FNP India has no confirmed loyalty programme; all claims trace to coupon blogs or to **FNP.sg**'s separate Gold Membership.
- IGP Select pricing is inconsistent across IGP's own pages (₹99 / ₹299 / ₹999 list). Treat as "list ₹999, deep intro discount".
- Packaging spec (box material, wrap, whether the pot is the shipper) — no first-party statement from either.
- GST invoicing, PO terms and credit periods for bulk orders — not documented by either.
- Whether IGP supports guest checkout — question present, answer not in the fetched text.
- FNP's plant subscription — only a _flower_ subscription is referenced; plants unconfirmed.

---

## Sources

First-party

- https://www.fnp.com/plants-lp · https://www.fnp.com/plants-same-day-delivery-lp · https://www.fnp.com/all-plants-lp · https://www.fnp.com/corporate/ · https://www.fnp.com/corporate/plants · https://www.fnp.com/corporate/diwali-gifts · https://www.fnp.com/good-luck-plants-lp · https://www.fnp.com/desktop-plants-lp · https://www.fnp.com/planters-lp · https://www.fnp.com/flowers-n-plants-lp · https://www.fnp.com/info/disclaimer · https://www.fnp.com/info/faq · https://www.fnp.com/info/terms-and-conditions · https://www.fnp.com/info/gifts-delivery-cities · https://www.fnp.com/info/contact-us · https://www.fnp.com/
- https://www.igp.com/plants · https://www.igp.com/all-plants · https://www.igp.com/same-day-delivery-plants · https://www.igp.com/plants-for-corporate-gifting · https://www.igp.com/corporate-gifts · https://www.igp.com/corporate-gifts/plants · https://www.igp.com/corporate-gifts/diwali-gifts · https://www.igp.com/corporate-gifts/xmas-new-year-gifts · https://www.igp.com/faq · https://www.igp.com/igp-select · https://www.igp.com/select-tc · https://www.igp.com/flowers · https://www.igp.com/roses

Third-party (complaints & ratings)

- https://www.trustpilot.com/review/www.igp.com · https://www.trustpilot.com/review/www.igp.com?page=4 · https://www.trustpilot.com/review/www.interflora.in · https://www.trustpilot.com/review/fnp.com · https://www.trustpilot.com/review/fnp.sg?page=2 · https://www.sitejabber.com/reviews/igp.com · https://www.consumercomplaints.in/bycompany/igp-a501586.html

Bulk-plant specialists (positioning benchmark)

- https://onlineplantscart.in/p/bulk-orders-plants-online · https://kyari.co/pages/corporate-gifts-eco-friendly-sustainable · https://bonsaiplantsonline.com/corporate-bonsai-gifting/ · https://mytribe.in/manbhawannursery/corporate-event-gifting/custom-branded-planters · https://greenkin.in/collections/corporate-gifts-plants · https://giftlaya.com/corporate-gift
