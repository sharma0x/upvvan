# Checkout loop — hand-off to the migrations/config owner

Three things have to be merged for the checkout loop to exist on a fresh database.
All three are **reported, not merged**, because `src/migrations/**` and
`src/lib/config.ts` belong to another agent working concurrently.

---

## 1 · THE MIGRATION — `src/migrations/20261005_000008_checkout_loop.ts`

The exact DDL is in **`src/lib/orders/REQUIRED_MIGRATION_checkout_loop.sql`**, and it
has ALREADY been applied to the local dev database so the e2e proof runs against the
real schema. **`make db-migrate` on a fresh database will not create any of it.**

### ⚠️ ORDERING HAZARD — READ FIRST

`src/collections/SkuStock.ts` is a new Payload collection and `sku_stock` is created
below by hand. If `payload migrate:create` runs **before** the collection is
registered in `src/payload.config.ts`, Payload sees a table it does not know about,
generates a `CREATE TABLE` for it, and that collides with the one in the migration.

Correct order:

1. Register `SkuStock` in `src/payload.config.ts` — **DONE**, see below.
2. Move the `.sql` content into `src/migrations/20261005_000008_checkout_loop.ts`
   (wrapping it in `export async function up({ db })` / `down({ db })`) and register
   it in `src/migrations/index.ts`.
3. `make db-migrate`
4. Only then `make db-migrate-create` for anything else.

All statements are idempotent (`IF NOT EXISTS` / `DO $$ $$` guards), so a re-run
after step 1 is safe.

### What it does, and why each piece is there

| Change                                                                                                          | Why it cannot live in application code                                                                                                                                                                                                                                                |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ALTER TYPE enum_orders_status ADD VALUE 'PAYMENT_PENDING' 'PAID' 'OUT_FOR_DELIVERY' 'CANCELLED'`               | The four payment-lifecycle states have no representation in the enum. Reusing `PLACED` for "awaiting payment" leaves the database unable to answer "which orders have we been paid for?" — a question the city P&L and the delivery console both need.                                |
| `orders.payment_state`, `payment_intent_id`, `payment_reference`, `payment_captured_at`, `payment_failure_code` | Capture idempotency and the gateway's own reference are an audit trail. `payment_intent_id` is what makes a double-tapped pay button impossible to charge twice.                                                                                                                      |
| `orders.customer_name`, `customer_phone`, `address_*`                                                           | An order with no address is not an order. Nullable for the 44 legacy rows, enforced non-blank below for anything paid.                                                                                                                                                                |
| **`CHECK orders_captured_payment_has_contact`**                                                                 | "We took money and cannot deliver it" ends a D2C business. A captured payment requires a name, a phone and a delivery address. Verified: a raw `INSERT` with `payment_state='captured'` and no address is refused.                                                                    |
| **`CHECK orders_phone_is_a_mobile`**                                                                            | The phone is what order lookup is authorised by and what a rider dials, so a number that cannot be dialled must not be storable. Accepts `+91XXXXXXXXXX`, `XXXXXXXXXX`, `0XXXXXXXXXX`.                                                                                                |
| **`CHECK orders_payment_state_known`**                                                                          | Four values only. Without it a typo writes a fifth state and the UI silently treats it as unpaid.                                                                                                                                                                                     |
| `CREATE TABLE sku_stock` + **`CHECK sku_stock_on_hand_non_negative`**                                           | The oversell guarantee. Application code cannot enforce it — a lost update under two concurrent checkouts passes every JS check. Verified: a raw `UPDATE … SET stock_on_hand = stock_on_hand - 5` is refused by the database.                                                         |
| **`UNIQUE sku_stock(sku_id)`**                                                                                  | Two rows for one SKU means two independent counts and therefore two answers to "can we sell this?", which is the same defect as having no stock tracking.                                                                                                                             |
| `sku_stock` backfill at **0**                                                                                   | Deliberately zero, not a guessed number. A fabricated stock level is an oversell waiting to be discovered by a customer. **Action required:** set real counts — `UPDATE sku_stock SET stock_on_hand = 40 WHERE stock_on_hand = 0;` — or every checkout will correctly say "sold out". |
| `CREATE TABLE order_events` (no `updated_at`)                                                                   | Append-only, enforced by the absence of a column to update. The value of a customer-facing timeline is that it cannot be rewritten.                                                                                                                                                   |
| `CREATE TABLE order_claims` (**no `refund_paise` column**)                                                      | Plants are replaced, never refunded. A refund column on a claim is an invitation to refund a plant, which is the one thing this business does not do.                                                                                                                                 |
| `CHECK order_claims_kind_known` / `_status_known`                                                               | The remedy differs by kind (plant = replacement, consumable = money back). An unconstrained kind lets a caller file `OTHER` and quietly get the plant remedy.                                                                                                                         |

### Down

`ALTER TYPE ... ADD VALUE` cannot be removed — Postgres has no `DROP VALUE`. Rolling
this back means recreating the type and re-mapping any order that used the four new
states, which is why they are a separate, deliberately named migration. The full
`down()` is in the commented block at the bottom of the `.sql`.

---

## 2 · CONFIG ADDITIONS — `src/lib/config.ts`

Both modules read these keys through a structural cast with documented fallbacks, so
the loop works today and merging this is a deletion, not a refactor.

### `config.payments` — for `src/lib/payments/config.ts`

```ts
payments: {
  // Which gateway implementation the checkout talks to. 'simulated' moves no money
  // and is the only value that may be set outside production.
  gateway: str('PAYMENT_GATEWAY', 'simulated'),

  simulated: {
    provider: str('PAYMENT_SIMULATED_PROVIDER', 'simulated'),
    intentIdPrefix: str('PAYMENT_SIMULATED_INTENT_PREFIX', 'pi_sim_'),

    // Artificial capture latency, ms. Non-zero on purpose: a gateway that answers
    // instantly trains you to ship a checkout with no pending state, which is exactly
    // the bug that let the UI claim "Order placed" with no money moved.
    latencyMs: int('PAYMENT_SIMULATED_LATENCY_MS', 350),

    // How long a created intent stays capturable.
    intentTtlMinutes: int('PAYMENT_INTENT_TTL_MINUTES', 30),

    declineCodes: str('PAYMENT_SIMULATED_DECLINE_CODES',
      'CARD_DECLINED,INSUFFICIENT_FUNDS,AUTH_TIMEOUT')
      .split(',').map((c) => c.trim()).filter(Boolean),
  },
},
```

**`assertConfigValid` should also refuse a non-`simulated` `PAYMENT_GATEWAY` in
production.** `paymentConfig()` throws rather than falling back, which is deliberate —
silently simulating in production would take money that never arrives.

### `config.business` — for `src/lib/orders/invoice.ts`

```ts
// GSTIN of the selling entity, 15 characters, on every tax invoice. Legal
// Metrology requires the tax-inclusive retail price to be declared; the invoice is
// what proves we actually charged it.
gstin: str('GSTIN', ''),

// The 2-digit state code the GSTIN is registered in (e.g. '29' for Karnataka).
// Place-of-supply rules key off this, so it is not a display detail.
gstStateCode: str('GST_STATE_CODE', '29'),

// Invoice number prefix. Sequential numbering is a legal requirement under the
// CGST Act — invoices must be serially numbered, so the NUMBER comes from the order
// and the prefix only makes it recognisable at a glance.
invoicePrefix: str('INVOICE_PREFIX', 'UPV'),
```

**`assertConfigValid` should require `gstin` in production**, the same way the
compliance block requires a grievance officer. An invoice without a GSTIN is not an
invoice, and the site will happily render one — today it shows a labelled gap instead
of hiding the section, which is the right behaviour but not a launch-ready one.

`business.defaultTaxRateBp` already exists and is used for the CGST/SGST split.

### `.env.example` additions

```bash
# ── Payments (simulated gateway — moves no money) ───────────────────────
PAYMENT_GATEWAY=simulated
PAYMENT_SIMULATED_LATENCY_MS=350
PAYMENT_INTENT_TTL_MINUTES=30

# ── Tax invoice ─────────────────────────────────────────────────────────
GSTIN=
GST_STATE_CODE=29
INVOICE_PREFIX=UPV
```

---

## 3 · ONE-LINE INTEGRATION IN THE CART

`src/components/catalogue/CartClient.tsx` and `src/app/cart/page.tsx` belong to
another agent. Their `placeOrder()` currently `POST`s `/api/orders` with only
`{ pincode, lines, totalPaise }` — and the endpoint now **requires** a delivery
contact, so that button will return 400 "Enter the name for the delivery."

That is correct behaviour, not a regression: an order with no address cannot be
delivered and cannot be looked up.

**Required change:** replace the cart's direct `POST /api/orders` with a link to
`/order/checkout`, which is built, tested and owns the whole details → pay → receipt
loop. One line:

```tsx
window.location.href = '/order/checkout'
```

Until that lands, `/order/checkout` is reachable only by URL and from the e2e script.

---

## 4 · REPORTED GAPS — not built, deliberately

### Video upload for claims

`/claim/[code]` accepts an `evidenceUrl` (a link the customer already has) so evidence
is not lost. It does **not** accept an upload. The unboxing video is the strongest
evidence a claim has and it needs: presigned multipart upload to RustFS/S3, a size cap,
a retention policy, and a read-authorisation rule. The `order_claims.evidence_url`
column already exists so that work lands without a migration.

### Server-rendered PDF invoice

`/invoice/[code]` is print-optimised and the button opens the browser's print
dialogue, which offers "Save as PDF". A deterministic, archivable, emailable PDF
needs a server-side renderer — real work, and not worth faking. The button says
exactly what it does so nobody believes they have received a PDF.

### Per-nursery stock

`sku_stock` is one row per SKU. If per-nursery stock becomes real it becomes a second
collection, not a wider key on this one — deciding which physical batch a sale comes
from depends on what is on the bench, which is a picking decision, not a constraint
enforceable at checkout.

### Order status advance API (ops)

The state machine is complete and enforced, and `assertTransition` is the single
gate — but there is no staff-facing endpoint that moves `PAID → PACKING → PACKED →
OUT_FOR_DELIVERY → DELIVERED`. Ops does it in the Payload admin panel today, which
does **not** go through `assertTransition` (Payload writes the column directly). Wiring
the admin `beforeChange` hook to the same table is the recommended follow-up; until
then the state machine protects the payment and claim paths, which are the
customer-reachable ones.

### Stock release on cancellation

`returnStock()` is implemented and tested-by-inspection but has no caller, because no
cancellation endpoint exists yet. It must be called in the same transaction as the
transition to `CANCELLED`.

---

## 5 · HOW TO RUN THE PROOF

```bash
make db-migrate          # after the migration above is in place
make seed-phase0
UPDATE sku_stock SET stock_on_hand = 40 WHERE stock_on_hand = 0;   # via psql, see §1

pnpm build && pnpm start          # in one shell
node tests/e2e/checkout-flow.mjs # in another   (BASE_URL defaults to :3000)
```

The script asserts 29 checks, including the two that matter most: that the page says
"Payment pending" until capture succeeds, and that a declined card leaves the order
payable rather than looking cancelled.
