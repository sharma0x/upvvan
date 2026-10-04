# Use Case Diagrams — Plant Commerce Platform

**Date:** 4 October 2026
**Companions:** `product-design.md`, `plant-platform-architecture.html`
**Format:** Mermaid. All diagrams below render in GitHub, GitLab, Obsidian, VS Code (Markdown Preview Mermaid Support), mermaid.live, and any `mermaid-cli` pipeline.

**Diagram index**

| #   | Diagram                     | Question it answers                                                         |
| --- | --------------------------- | --------------------------------------------------------------------------- |
| 1   | System context              | What sits outside our boundary?                                             |
| 2   | Customer use cases          | What can a customer do, and which are they _forbidden_ to do?               |
| 3   | Rider + delivery use cases  | How is delivery fraud structurally prevented?                               |
| 4   | Nursery ops use cases       | How is order integrity enforced at the bench?                               |
| 5   | Support use cases           | How is the guarantee adjudicated, at the tier we are actually offering?     |
| 6   | HQ admin use cases          | How does a new city get onboarded?                                          |
| 7   | Cross-surface order journey | How handoffs work, with failure modes                                       |
| 8   | Compliance obligations      | Which statute binds which use case                                          |
| 9   | State machine               | Where can an order legally be, and what blocks it                           |
| 10  | Guarantee adjudication      | The 24–48h replacement-only flow, plus the promotion gate to longer windows |

---

## 1. System context

```mermaid
graph TB
    subgraph EXT["Outside our boundary"]
        C["Customer<br/>(consumer)"]
        CO["Corporate buyer<br/>(B2B)"]
        R["Rider<br/>(own fleet / 3PL)"]
        GOV["State Horticulture Dir.<br/>PPQS"]
        MKT["Marketplaces<br/>Amazon · Flipkart"]
        PSP["Payment gateway<br/>UPI · Cards"]
        SUP["Supplier nursery<br/>(traceable batch)"]
        SMS["WhatsApp Business API"]
    end

    subgraph SYS["Plant Commerce Platform"]
        CORE["Core services<br/>Catalogue · Pricing · Orders<br/>Guarantee · Refills"]
        GEO["Geo &amp; Pincode Service"]
        CITY["City Unit<br/>Nursery · Zones · Riders"]
    end

    C -->|"browse · order · claim"| CORE
    CO -->|"bulk enquiry · PO"| CORE
    CORE -->|"prepaid only"| PSP
    CORE -->|"ETA · distance band"| GEO
    GEO -->|"serviceable set"| CITY
    CORE -->|"dispatches from"| CITY
    CITY -->|"per-drop priced"| R
    C -->|"support"| SMS
    SMS -->|"inbound"| CORE
    SUP -->|"batch + bill ID"| CITY
    GOV -->|"licence · movement clearance"| CITY
    MKT -.->|"Phase 2: listing sync"| CORE

    style CORE fill:#064e3b,stroke:#34d399,color:#fff
    style GEO fill:#4c1d95,stroke:#a78bfa,color:#fff
    style CITY fill:#78350f,stroke:#fbbf24,color:#fff
    style GOV fill:#881337,stroke:#fb7185,color:#fff
    style PSP fill:#881337,stroke:#fb7185,color:#fff
    style MKT stroke:#94a3b8,stroke-dasharray: 5 5,color:#94a3b8
```

**Boundary note:** the marketplace lane is Phase 2 and deliberately dashed. Our research found every marketplace gates on a GSTIN and runs its _own_ return window — which is precisely why Ugaoo's 30-day clock keeps running while the customer's marketplace window governs the actual claim. **We do not want that ambiguity. D2C is the primary channel; marketplaces are reach, not fulfilment.**

---

## 2. Customer — use cases

```mermaid
graph TB
    subgraph BOUND["«boundary» Customer"]
        direction TB

        subgraph DISC["Discovery"]
            UC1(["UC-01<br/>Take plant-finder quiz"])
            UC2(["UC-02<br/>Browse seasonal catalogue"])
            UC3(["UC-03<br/>Filter by room · light · pet-safe"])
            UC4(["UC-04<br/>Search by symptom<br/><i>symptom-first</i>"])
            UC5(["UC-05<br/>View PDP with<br/>Legal Metrology declarations"])
            UC6(["UC-06<br/>Read care content<br/><i>117 guides · 175 symptom pages</i>"])
        end

        subgraph PURCH["Purchase"]
            UC7(["UC-07<br/>Select planter variant<br/><i>primary AOV lever</i>"])
            UC8(["UC-08<br/>Add to cart"])
            UC9(["UC-09<br/>Check serviceability by pincode"])
            UC10(["UC-10<br/>Confirm care profile"])
            UC11(["UC-11<br/>Pay prepaid"])
            UC12(["UC-12<br/>Place order"])
        end

        subgraph POST["Post-purchase — the care &amp; guarantee surface"]
            UC13(["UC-13<br/>Track order"])
            UC14(["UC-14<br/>Submit unboxing video"])
            UC15(["UC-15<br/>Care check-ins<br/>D3 · D7 · D21 · D45"])
            UC16(["UC-16<br/>Diagnose problem"])
            UC17(["UC-17<br/>File damage claim"])
            UC18(["UC-18<br/>Receive replacement"])
            UC19(["UC-19<br/>Accept refill subscription"])
            UC20(["UC-20<br/>Rate &amp; review"])
        end

        subgraph REFUSE["«forbidden» — intentionally absent"]
            F1["✗ Cash on delivery"]
            F2["✗ Cancel after dispatch<br/><i>no return leg exists</i>"])
            F3["✗ Refund for plants<br/><i>replacement only</i>"]
            F4["✗ Return a plant<br/><i>non-saleable on return</i>"]
            F5["✗ Order to unserviceable pincode"]
            F6["✗ Claim outside<br/>active window<br/><i>tier-dependent</i>"]
            F7["✗ 2nd replacement<br/>on same plant"]
        end

        UC1 --> UC3
        UC3 --> UC5
        UC2 --> UC5
        UC4 --> UC6
        UC6 --> UC5
        UC5 --> UC7 --> UC8 --> UC9
        UC9 --> UC10 --> UC11 --> UC12
        UC12 --> UC13 --> UC14 --> UC15
        UC15 --> UC16
        UC16 --> UC17 --> UC18
        UC15 --> UC19
        UC18 --> UC20
        UC19 --> UC13
    end

    UC9 -.->|"pincode rejected"| F5
    UC17 -.->|"window closed"| F6
    UC17 -.->|"plant already replaced"| F7
    UC11 -.->|"COD not offered"| F1

    style DISC fill:#082f49,stroke:#22d3ee,color:#fff
    style PURCH fill:#064e3b,stroke:#34d399,color:#fff
    style POST fill:#4c1d95,stroke:#a78bfa,color:#fff
    style REFUSE fill:#881337,stroke:#fb7185,color:#fff
    style F1 fill:#881337,stroke:#fb7185,color:#fecdd3
    style F2 fill:#881337,stroke:#fb7185,color:#fecdd3
    style F3 fill:#881337,stroke:#fb7185,color:#fecdd3
    style F4 fill:#881337,stroke:#fb7185,color:#fecdd3
    style F5 fill:#881337,stroke:#fb7185,color:#fecdd3
    style F6 fill:#881337,stroke:#fb7185,color:#fecdd3
    style F7 fill:#881337,stroke:#fb7185,color:#fecdd3
```

### The seven refusals are features

Each maps to a researched failure:

| Refusal                             | Evidence                                                                                                                                                                           |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **No COD**                          | Return leg is **25–30 days** vs 3–4 day forward; plant is **non-saleable on return**. A COD bounce is a total write-off. Samarth Cactus caps COD at ₹500–1,500 for the same reason |
| **No plant returns**                | Non-saleable in all three policies we examined. Ugaoo refuses outright; Paudhewale disposes of them "at the customer's end"                                                        |
| **Replacement, not refund**         | Marginal cost of a replacement is a plant already grown and otherwise discarded                                                                                                    |
| **Pincode gate**                    | The most-complained-about failure across every competitor is promising geography they can't serve                                                                                  |
| **One replacement per plant, ever** | Fraud control without a customer-hostile policy                                                                                                                                    |

---

## 3. Rider & delivery — the anti-fraud core

```mermaid
graph TB
    subgraph BOUND["«boundary» Rider"]
        direction TB

        subgraph SHIFT["Shift"]
            R1(["R-01<br/>Accept shift"])
            R2(["R-02<br/>View batch<br/><i>8–12 drops · 1 zone</i>"])
            R3(["R-03<br/>See per-drop pay<br/>A ₹45 · B ₹60 · C ₹75"])
            R4(["R-04<br/>Navigate batch<br/><i>offline capable</i>"])
        end

        subgraph DROP["Per-drop execution"]
            R5(["R-05<br/>Arrive at drop"])
            R6(["R-06<br/>Hand plant to recipient"])
            R7(["R-07<br/>Collect customer OTP"])
            R8(["R-08<br/>Photograph<br/>against order ID"])
            R9(["R-09<br/>Confirm plant condition"])
            R10(["R-10<br/>GPS ping at handover"])
            R11(["R-11<br/>Mark DELIVERED"])
        end

        subgraph SETTLE["Settlement"]
            R12(["R-12<br/>View shift earnings"])
            R13(["R-13<br/>See batch-fill bonus"])
            R14(["R-14<br/>UPI settlement status"])
        end

        subgraph REFUSE["«forbidden» — the structural choice"]
            F1["✗ Auto-complete on<br/>proximity or timeout"]
            F2["✗ 'Delivered' without<br/>all 4 proof fields"]
            F3["✗ Route by nearest-rider<br/><i>breaks batching, kills margin</i>"]
            F4["✗ Edit delivered order"]
        end

        R1 --> R2 --> R3 --> R4
        R4 --> R5 --> R6 --> R7 --> R8 --> R9 --> R10 --> R11
        R11 --> R12 --> R13 --> R14
        R2 -.->|"wave full"| R12
    end

    R11 -->|"BLOCKED unless all 4 present"| F2
    R5 -.-> F1

    style SHIFT fill:#082f49,stroke:#22d3ee,color:#fff
    style DROP fill:#064e3b,stroke:#34d399,color:#fff
    style SETTLE fill:#4c1d95,stroke:#a78bfa,color:#fff
    style REFUSE fill:#881337,stroke:#fb7185,color:#fff
    style F1 fill:#881337,stroke:#fb7185,color:#fecdd3
    style F2 fill:#881337,stroke:#fb7185,color:#fecdd3
    style F3 fill:#881337,stroke:#fb7185,color:#fecdd3
    style F4 fill:#881337,stroke:#fb7185,color:#fecdd3
```

**Why R-07 exists.** Customer OTP means handover is proven by _two_ parties, not one. A rider cannot manufacture it alone.

**Why R-09 exists.** The 3-state condition check feeds the DOA model. **No Indian player publishes a plant damage or mortality rate** — so this field is how we generate the single most important number in the business, and it is the weakest input (5% assumed) in the entire unit-economics model.

**Why R-03 exists.** Publishing the band makes distance cost the rider something. Urvann's contract pays ₹65 flat _and_ penalises fake marking at ₹100 — the penalty exists only because the pay structure makes lying rational. **We remove the incentive, then keep the audit trail anyway.**

---

## 4. Nursery operations — order integrity

```mermaid
graph TB
    subgraph BOUND["«boundary» Nursery Ops"]
        direction TB

        subgraph MORN["Morning"]
            O1(["O-01<br/>View today's wave"])
            O2(["O-02<br/>Stock low / out alerts"])
            O3(["O-03<br/>Season advisory<br/><b>Mar–Jun 40–46°C</b>"])
            O4(["O-04<br/>Yesterday's DOA rate"])
        end

        subgraph BENCH["Packing bench — evidence capture"]
            O5(["O-05<br/>Claim next item"])
            O6(["O-06<br/><b>Bench photo vs order ID</b>"])
            O7(["O-07<br/>Soil moisture check"])
            O8(["O-08<br/>Pot secured · grow pot only"])
            O9(["O-09<br/>Attach physical care card"])
            O10(["O-10<br/>Mark packed"])
        end

        subgraph STOCK["Inventory & season"]
            O11(["O-11<br/>Record batch<br/><i>source + bill ID</i>"])
            O12(["O-12<br/>Adjust stock"])
            O13(["O-13<br/>Set seasonal availability"])
            O14(["O-14<br/>Suspend fragile tier<br/><i>lethal window</i>"])
        end

        subgraph REFUSE["«forbidden» — compliance in code"]
            F1["✗ Publish SKU without<br/>traceable batch"]
            F2["✗ Pre-pot decorative<br/><i>volumetric freight</i>"]
            F3["✗ Ship in lethal<br/>heat unflagged"]
            F4["✗ Mark packed without<br/>bench photo"]
        end

        O1 --> O2 --> O3 --> O4
        O5 --> O6 --> O7 --> O8 --> O9 --> O10
        O11 --> O12
        O13 --> O14
    end

    O11 -.-> F1
    O8 -.-> F2
    O14 -.-> F3
    O10 -.-> F4

    style MORN fill:#082f49,stroke:#22d3ee,color:#fff
    style BENCH fill:#064e3b,stroke:#34d399,color:#fff
    style STOCK fill:#78350f,stroke:#fbbf24,color:#fff
    style REFUSE fill:#881337,stroke:#fb7185,color:#fff
```

**O-06 is the highest-leverage screen in ops.** Bench photo is not optional and not skippable — it is both claim evidence and fraud filtering in one mechanism.

**O-09 deserves emphasis.** The care card goes out **physically**, because the digital one will not be read. That is the cheapest mortality intervention available and it costs one print.

**F-04:** Urvann's refund defaults to wallet credit, which suppresses complaints and starves the business of the signal it needs — and it ran a 2.1/5 Trustpilot while growing 54%. Capturing the photo keeps the signal.

---

## 5. Support — guarantee adjudication

```mermaid
graph TB
    subgraph BOUND["«boundary» Support Agent"]
        direction TB

        subgraph INTAKE["Intake"]
            S1(["S-01<br/>Receive from<br/>WhatsApp · chat · phone · email"])
            S2(["S-02<br/>Auto-link to order<br/>+ guarantee window"])
            S3(["S-03<br/>View customer context<br/><i>care profile · quiz · history</i>"])
            S4(["S-04<br/>Route to queue"])
        end

        subgraph CARE["Care diagnosis"]
            S5(["S-05<br/>Triage symptom"])
            S6(["S-06<br/>Suggest from care engine"])
            S7(["S-07<br/>Human review &amp; send<br/><i>never auto-sent</i>"])
            S8(["S-08<br/>Escalate to grower"])
        end

        subgraph CLAIM["Claim adjudication — 24–48h, tier-scoped"]
            S9(["S-09<br/>Validate window"])
            S10(["S-10<br/>Verify evidence<br/><i>video + close + wide</i>"])
            S11(["S-11<br/>Check exclusions"])
            S12(["S-12<br/>Adjudicate at<br/>published gate"])
            S13(["S-13<br/>Record reason code"])
            S14(["S-14<br/>Dispatch replacement<br/><i>grow pot + repot guide</i>"])
            S15(["S-15<br/>Notify customer"])
        end

        subgraph REFUSE["«forbidden»"]
            F1["✗ Auto-approve or<br/>auto-reject"]
            F2["✗ 'Sole discretion' verdict"]
            F3["✗ Google Form intake"]
            F4["✗ Wallet-credit deflection"]
            F5["✗ 24/7 human line"]
        end

        S1 --> S2 --> S3 --> S4
        S4 --> S5 --> S6 --> S7
        S5 -.->|"beyond expertise"| S8
        S4 --> S9 --> S10 --> S11 --> S12 --> S13 --> S14 --> S15
    end

    S12 -.-> F1
    S12 -.-> F2
    S1 -.-> F3
    S15 -.-> F4
    S5 -.->|"out of hours"| F5

    style INTAKE fill:#082f49,stroke:#22d3ee,color:#fff
    style CARE fill:#064e3b,stroke:#34d399,color:#fff
    style CLAIM fill:#4c1d95,stroke:#a78bfa,color:#fff
    style REFUSE fill:#881337,stroke:#fb7185,color:#fff
```

### The four forbidden items, each with a named precedent

- **F-1 · no auto-adjudication** — an AI verdict on a claim is indefensible when the whole positioning is _"a human answers."_
- **F-2 · no "sole discretion"** — Ugaoo's exact clause. _"Approval or rejection is at the sole discretion of the Ugaoo team"_ is what generates the "return window closed" complaint pattern.
- **F-3 · no Google Form** — that is Kyari's damage-claim intake, on a business claiming ₹20 Cr+ revenue.
- **F-4 · no wallet credit** — Urvann's pattern. A coupon suppresses the complaint and destroys the signal. **Settle in money, in 24 hours.**
- **F-5 · no 24/7 line** — Rooted ran one and had to degrade it to weekday hours. A human call is a material fraction of order value at a ₹300 plant.

---

## 6. HQ admin — city onboarding

```mermaid
graph TB
    subgraph BOUND["«boundary» HQ Admin"]
        direction TB

        subgraph GATES["Legal gates — HARD BLOCKS"]
            A1(["A-01<br/>Check state nursery<br/>licence regime"])
            A2(["A-02<br/><b>Block: licence not filed</b>"])
            A3(["A-03<br/>Request interstate<br/>movement clearance"])
            A4(["A-04<br/><b>Block: clearance unresolved</b>"])
        end

        subgraph SETUP["City setup — config only"]
            A5(["A-05<br/>Create city row<br/><i>state · GSTIN · tax</i>"])
            A6(["A-06<br/>Set price book<br/><i>ladder · free-ship thr</i>"])
            A7(["A-07<br/>Import pincodes<br/><i>CSV: pin→zone→band</i>"])
            A8(["A-08<br/>Configure rider pool<br/>+ shift templates"])
            A9(["A-09<br/>Map seasonal<br/>availability matrix"])
        end

        subgraph GOV["Governance"]
            A10(["A-10<br/>Legal Metrology<br/>declaration audit"])
            A11(["A-11<br/>Grievance officer<br/>+ DPDP register"])
            A12(["A-12<br/>Cross-city P&amp;L"])
            A13(["A-13<br/>Density index<br/><i>orders/km²/day</i>"])
        end

        subgraph LIFECYCLE["City lifecycle"]
            A14(["A-14<br/>Soft launch<br/><i>1 zip · ~200 pins</i>"])
            A15(["A-15<br/>Expand pincodes"])
            A16(["A-16<br/><b>Kill or scale</b><br/>on contribution"])
            A17(["A-17<br/><b>Kill a failing city</b><br/><i>isolated P&amp;L</i>"])
        end

        subgraph REFUSE["«forbidden»"]
            F1["✗ Go live without licence"]
            F2["✗ Service a pincode<br/>outside serviceable set"]
            F3["✗ Assume one season<br/>catalogue fits all cities"]
            F4["✗ Let a losing city<br/>sink group P&amp;L"]
        end

        A1 --> A2
        A3 --> A4
        A2 -->|"cleared"| A5
        A4 -->|"cleared"| A5
        A5 --> A6 --> A7 --> A8 --> A9 --> A14 --> A15 --> A16
        A16 --> A17
        A10 -.-> F1
        A7 -.-> F2
        A9 -.-> F3
        A17 -.-> F4
    end

    style GATES fill:#881337,stroke:#fb7185,color:#fff
    style SETUP fill:#78350f,stroke:#fbbf24,color:#fff
    style GOV fill:#064e3b,stroke:#34d399,color:#fff
    style LIFECYCLE fill:#082f49,stroke:#22d3ee,color:#fff
    style REFUSE fill:#881337,stroke:#fb7185,color:#fff
```

**A-16/A-17 are the pair that makes multi-city safe.** Urvann has a documented history of **nine failed city launches** — so a city must be killable on contribution, with its P&L isolated from the group. That's why `city_pnl` is a first-class entity.

---

## 7. Cross-surface order journey with failure modes

```mermaid
sequenceDiagram
    autonumber
    actor C as Customer
    participant W as Web/App
    participant GEO as Geo Service
    participant PAY as Gateway
    participant OPS as Nursery Ops
    participant BENCH as Packing Bench
    participant R as Rider App
    participant SUP as Support
    participant DB as Store

    C->>W: Quiz → 3 matched plants
    C->>W: Select planter variant
    W->>GEO: Serviceability check (pincode)
    alt pincode not serviceable
        GEO-->>W: REJECT
        W-->>C: "Not in [city] yet"
        Note over W,C: ◆ FAILURE MODE 1: over-promising<br/>the loudest complaint across competitors
    else serviceable
        GEO-->>W: zone + distance band + ETA
        W->>C: Order total, free delivery
        C->>PAY: Prepaid (UPI / card)
        Note over PAY,C: ◆ NO COD PATH EXISTS
        PAY-->>W: paid
        W->>DB: order PLACED
        W->>GEO: Route to nearest nursery
        W->>OPS: Push to today's wave
        OPS->>BENCH: Next item
        BENCH->>BENCH: Bench photo vs order ID
        Note over BENCH: ◆ FAILURE MODE 2: skipping photo<br/>= unusable evidence later
        BENCH-->>OPS: packed
        OPS->>R: Assign batch (8–12 drops, 1 zone)
        R->>C: Navigate to drop
        C->>R: Hand over plant
        C-->>R: Shows OTP
        R->>R: Enter OTP + photo + condition + GPS
        Note over R: ◆ FAILURE MODE 3: auto-complete<br/>= Urvann's 1.4/5 in code
        R->>DB: DELIVERED (all 4 proof fields)
        DB->>W: Start guarantee clock (tier-scoped)
        W->>C: Request unboxing video (day 0)
        C->>W: Submit video
        loop care sequence D3 · D7 · D21 · D45
            W->>C: Care check-in
        end
        opt plant fails inside ACTIVE guarantee window
            C->>W: File claim
            W->>SUP: Queue claim
            SUP->>DB: Validate window + evidence
            SUP->>OPS: Dispatch replacement (grow pot + repot guide)
            Note over SUP,OPS: ◆ REPLACEMENT, NEVER REFUND<br/>marginal cost = plant already grown
            OPS->>C: Replacement delivered
        end
        W->>C: Offer refill subscription (day 45)
        C->>W: Subscribe
        Note over W,C: ◆ Refill rides the SAME wave<br/>zero extra freight, 70–80% margin
    end
```

### Failure modes worth designing against

| #   | Failure mode                   | Structural guard                                                      |
| --- | ------------------------------ | --------------------------------------------------------------------- |
| 1   | Over-promising geography       | Order cannot exist outside `pincode_zone.serviceable`                 |
| 2   | Missing bench photo            | Cannot reach `packed` without it                                      |
| 3   | Delivery auto-completion       | Cannot reach `DELIVERED` without all 4 proof fields                   |
| 4   | Seedling-to-shipped size drift | Declared dimensions measured from the bench photo, not a batch record |
| 5   | Refund inertia                 | No refund path exists for plants, so the only flow is replacement     |

---

## 8. Compliance bindings

```mermaid
graph LR
    subgraph STAT["Statute / rule"]
        S1["Legal Metrology<br/>PC Rules 2011 r.6(1)<br/>+ 2017 Amendment r.6(10)"]
        S2["Consumer Protection<br/>(E-Commerce) Rules 2020"]
        S3["Consumer Protection<br/>Act 2019"]
        S4["DPDP Act 2023<br/><i>effective 13 May 2027</i>"]
        S5["State Nursery Acts<br/>TS · HR · WB · UK"]
        S6["FSS Act s.2(d)<br/><i>NOT applicable to ornamentals</i>"]
    end

    subgraph UC["Use case bound"]
        U1["UC-05 PDP"]
        U2["UC-11 Checkout"]
        U3["UC-17 Claim"]
        U4["A-10 Audit"]
        U5["A-01 Licences"]
        U6["Any PDP · listing"]
    end

    S1 --> U1
    S1 --> U6
    S2 --> U2
    S2 --> U4
    S3 --> U3
    S4 --> U2
    S5 --> U5
    S6 -.->|"scope test only"| U1

    style STAT fill:#881337,stroke:#fb7185,color:#fff
    style UC fill:#064e3b,stroke:#34d399,color:#fff
    style S6 fill:#334155,stroke:#64748b,color:#e2e8f0
```

### What binds, and what doesn't

| Rule                                            | Binds                                                                                                                                                                                                          | Not required                                                                                                                                                                                                                                                                        |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Legal Metrology**                             | **Every listing** — name, address, origin, net qty, MRP incl. taxes, **and dimensions where size is relevant**. r.6(10) extends these to the _online listing_; only month-and-year-of-packing is exempt online | —                                                                                                                                                                                                                                                                                   |
| **Consumer Protection (E-Commerce) Rules 2020** | Legal entity name, HQ address, site details, contact, **grievance officer**, T&Os, return/refund and shipping policy                                                                                           | —                                                                                                                                                                                                                                                                                   |
| **DPDP Act 2023**                               | Consent architecture, notice, data-minimisation. Substantial provisions effective **13 May 2027**                                                                                                              | —                                                                                                                                                                                                                                                                                   |
| **State Nursery Acts**                          | Registration to operate — **a hard block on city go-live**                                                                                                                                                     | —                                                                                                                                                                                                                                                                                   |
| **FSSAI**                                       | —                                                                                                                                                                                                              | **Not required for ornamental plants.** §2(d) defines food as _"intended for human consumption"_; a décor plant fails that test. **Blogs claiming otherwise are wrong on the statute.** Revisit only for edible plants, vegetable seedlings, sprouts, microgreens, or growing media |

**The Legal Metrology point is the one that should change how you build.** Because "dimensions where size is relevant" applies to _every_ plant PDP in this category, it is a **template constraint**, not a per-listing task. Get it into the PDP component on day one or you will retrofit it across 200 SKUs.

---

## 9. Order state machine

```mermaid
stateDiagram-v2
    [*] --> PLACED: prepaid confirmed
    PLACED --> ROUTED: nearest nursery + wave assigned
    ROUTED --> PACKING: bench item claimed
    PACKING --> PACKED: bench photo captured
    PACKED --> DISPATCHED: rider batch assigned
    DISPATCHED --> DELIVERED: OTP + photo + condition + GPS
    DELIVERED --> RESOLVED: active window closes
    DELIVERED --> CLAIM_OPEN: claim filed ≤48h
    CLAIM_OPEN --> CLAIM_REJECTED: window closed or exclusion met
    CLAIM_OPEN --> REPLACEMENT_QUEUED: evidence verified
    REPLACEMENT_QUEUED --> DELIVERED: replacement delivered
    RESOLVED --> [*]
    CLAIM_REJECTED --> [*]

    note right of PLACED
        No COD transition exists.
        The absence is the model.
    end note

    note right of PACKING
        BLOCKED without bench photo.
        Compliance in code, not policy.
    end note

    note right of DELIVERED
        BLOCKED without all 4 proof fields.
        No auto-complete on proximity.
    end note

    note right of CLAIM_REJECTED
        Reasons must carry a code.
        Feedback signal retained.
    end note
```

**Note there is no transition to `REFUNDED` for plants.** That is deliberate and it is the single biggest structural difference from every competitor: a dead plant's marginal cost is zero (it was already grown and would otherwise be discarded), so refunding cash where a replacement costs a plant is strictly worse economics _and_ a worse customer outcome.

---

## 10. Guarantee adjudication detail

```mermaid
flowchart TD
    START(["Claim filed"]) --> W{"Within 24–48h<br/>AND inside active window?"}

    W -->|"No"| REJ1["Reject: window closed<br/>reason=window"]
    W -->|"Yes"| E{"Uncut unboxing<br/>video submitted?"}

    E -->|"No"| ASK["Ask for video<br/><i>24h grace, then close</i>"]
    E -->|"Yes"| EV{"Close-up AND<br/>wide shot?"}

    EV -->|"No"| REJ2["Reject: insufficient evidence<br/>reason=evidence"]
    EV -->|"Yes"| EX{"Exclusion applies?"}

    subgraph EXCL["Exclusions — verbatim from research"]
        E1["over/under-watering"]
        E2["wrong light / temperature"]
        E3["repotting before claim"]
        E4["pests or disease<br/><i>occurring AFTER delivery</i>"]
        E5["calamity · accident · neglect"]
    end

    EX -->|"Yes"| REJ3["Reject: exclusion<br/>reason=exclusion"]
    EX -->|"No"| PRV{"Plant already<br/>replaced once?"}

    PRV -->|"Yes"| REJ4["Reject: replacement used<br/>reason=one-per-plant"]
    PRV -->|"No"| GATE["Human adjudication<br/>at published gate"]

    GATE -->|Approve| DISP["Dispatch replacement<br/><b>grow pot + 7-step repot guide</b>"]
    GATE -->|Deny| DENY["Deny WITH reason code<br/><i>no 'sole discretion'</i>"]

    DISP --> NOTIFY["Notify customer"]
    NOTIFY --> SURVEY["Post-resolution survey"]
    DENY --> APPEAL["Appeal path to HQ"]
    APPEAL --> GATE

    SURVEY --> FEED(["Feedback → DOA model<br/><b>the number nobody publishes</b>"])

    REJ1 --> CLOSE([Close + log])
    REJ2 --> CLOSE
    REJ3 --> CLOSE
    REJ4 --> CLOSE

    style EXCL fill:#78350f,stroke:#fbbf24,color:#fff
    style GATE fill:#064e3b,stroke:#34d399,color:#fff
    style DISP fill:#064e3b,stroke:#34d399,color:#fff
    style DENY fill:#881337,stroke:#fb7185,color:#fff
    style FEED fill:#4c1d95,stroke:#a78bfa,color:#fff
```

**Four design choices doing the work here:**

1. **24–48h, not 7 days.** A plant's 48-hour state still reflects its dispatch state. By day 7 you cannot distinguish a transit casualty from a care failure — and paying for the ambiguity is how guarantee programmes die. The window we _offer_ lengthens only once a measured damage rate exists to price it (see §11).
2. **The temporal qualifier on the pest exclusion** — _"occurring after delivery"_ — is what makes that clause enforceable at all. Ugaoo's version carries the same qualifier and it is the reason their policy survives contact with reality.
3. **Deny with a reason code, never "sole discretion."** A published adjudication gate is fairer to the customer _and_ generates the training signal.
4. **Every resolution feeds the DOA model.** Our unit economics assume a 5% damage rate that **no Indian player publishes.** This loop is the only way that assumption ever becomes a fact.

---

## Appendix — diagram-by-diagram rationale

| Diagram            | The decision it encodes                                                                      |
| ------------------ | -------------------------------------------------------------------------------------------- |
| 1 · System context | D2C-first; marketplace reach is Phase 2 because every marketplace runs its own return window |
| 2 · Customer       | **Seven refusals.** Each is a researched failure, not an omission                            |
| 3 · Rider          | Four proof fields before DELIVERED, **as a schema invariant**                                |
| 4 · Nursery        | Batch traceability and bench photo are compliance, not discipline                            |
| 5 · Support        | Four forbidden shortcuts, each with a named competitor precedent                             |
| 6 · HQ admin       | Two hard legal blocks; city killable on isolated P&L                                         |
| 7 · Journey        | Five failure modes with structural guards                                                    |
| 8 · Compliance     | What binds vs what does **not** — including FSSAI explicitly not applying                    |
| 9 · State machine  | **No transition to REFUNDED for plants**                                                     |
| 10 · Adjudication  | 24–48h window, exclusion wording, reason codes, DOA feedback loop                            |

---

## 11. Guarantee tiering — the window we offer is a business decision, not a marketing one

**Revision: 4 Oct 2026.** The original spec opened every customer touchpoint with a **90-day survival guarantee**. That number was an extrapolation, not a research finding: the global standard is **30 days** (Bloomscape: _"every plant will arrive in good health, and all plants are guaranteed for 30 days after arrival"_; The Sill 30-Day Happiness; Hey Rooted 30 Day Risk-Free), and **no competitor in any market we researched exceeds 30 days**.

It is now **tiered**, and the tier is a _configuration value in the price book_, not a hardcoded constant.

### The three tiers

| Tier                    | Window                      | Promises                                        | Promotion gate                                                  |
| ----------------------- | --------------------------- | ----------------------------------------------- | --------------------------------------------------------------- |
| **T0 — Arrival health** | **48 hours from DELIVERED** | Plant damaged or dead in transit → replacement  | **Live at launch**                                              |
| **T1 — Survival**       | **30 days from DELIVERED**  | Plant dies of non-excluded causes → replacement | After **~500 delivered orders**, gated on a _measured_ DOA rate |
| **T2 — Extended**       | **90 days**                 | As T1                                           | Only if measured DOA and claim rate support the cost            |

### Why T0 first

1. **T0 is nearly free for us.** We already capture a bench photo at O-06 and four proof fields before `DELIVERED`. Arrival claims need evidence we hold by construction — the marginal cost is the replacement plant plus a support touch, not an underwriting reserve.
2. **It already beats the best Indian precedent.** Paudhewale offers 24h refund-with-mandatory-unboxing-video. We offer 48h replacement with the same evidence discipline. **T0 is a genuine differentiator at zero incremental cost** — which means it does not need a 90-day headline to be real.
3. **T0 generates the number T1 needs.** Every claim and every rider condition-check (R-09) feeds the DOA model. **No Indian player publishes a plant damage or mortality rate**, so our 5% figure is an explicit assumption. T1 must not be launched until it is a measurement.

### The underwriting risk we are refusing to take blind

Our unit economics assume a 5% DOA rate, and that is the **least-evidenced input in the entire model**. Extending a plant-shipping guarantee to 90 days while that number is a guess converts a marketing promise into an unpriced liability. Urvann is the cautionary case: ₹3 Cr raised, revenue growing 54%, and a **1.4/5 rating** — the failure was an operation that could not honour what it promised, not a shortage of capital.

**Promotion is a data decision, never a calendar decision.** The gate is reviewed against measured DOA and claim-rate data at each review point.

### The two constraints that must hold at every tier

- **Replacement, never refund, for the plant.** Marginal cost of a replacement is a plant already grown and otherwise discarded. The _soil and accessories_ in a mixed cart are a separate matter — see §12.
- **Seasonal honesty.** March–June (40–46°C) is the lethal window. A plant delivered in May faces a death inside 30 days that is _not_ a care failure. At T0 that is a non-issue because 48 hours is well inside transit stress. **Before promoting to T1, the exclusion wording must handle heat-window deliveries** — either an explicit carve-out for shipments dispatched in the lethal window, or a summer delivery-time restriction on T1 claims. Shipping a 90-day promise into a 46°C May is the contradiction this tiering exists to prevent.

---

## 12. Mixed-cart resolution

The customer surface is **replacement-only for plants**. That is a plant policy, not a cart policy.

| Item class                        | Remedy on failure                                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Live plant                        | **Replacement**, never refund, at every tier                                                                              |
| Planter / pot                     | Refund or replace — no mortality risk, so cash refund is correct                                                          |
| Soil, fertiliser, nutrient sticks | **Refund in money, in 24 hours.** No mortality risk; these are the margin line and must not be deflected to wallet credit |

**The wallet-credit question.** Urvann defaults a dissatisfied customer to store credit. We do not — not because it is unkind, but because it suppresses the complaint and destroys the feedback signal the DOA model depends on. Where money is owed for a non-plant item, money is returned.

---

## 13. Still open — carried forward from the review

These were identified against the earlier revision and remain unresolved in the product design. They are operational risks, not syntax issues.

| #   | Open question                            | Why it matters                                                                      |
| --- | ---------------------------------------- | ----------------------------------------------------------------------------------- |
| 1   | **Stock-out mid-order**                  | What substitutes, what notifies, what refunds. No fallback rule is specified        |
| 2   | **Rider no-show / customer unreachable** | The OTP proof cannot be collected; order has no terminal state. Currently undefined |
| 3   | **Address change after dispatch**        | Nothing in the state machine permits it; nothing forbids it either                  |
| 4   | **Subscription pause / skip**            | A refill customer in a heat window may need to skip. No mechanism exists            |
| 5   | **Pot breakage vs plant damage**         | Same claim path, different remedy (refund vs replacement). Unspecified              |
| 6   | **Corporate PO path**                    | B2B line has a sales motion but no order use cases                                  |
| 7   | **Guarantee-terms versioning**           | Referenced in `product-design.md` §6.4 but has no state-machine or consent artefact |
| 8   | **Supplier-facing surface**              | Batch traceability is required for compliance, but there is no supplier use case    |

---

_Derived from the nine research files in `../research/`. Legal items marked ⚠️ require confirmation in writing with a CA, the State Horticulture Directorate, or PPQS. FSSAI's treatment of growing media remains genuinely unresolved._
