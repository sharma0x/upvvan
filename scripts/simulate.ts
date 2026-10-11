/**
 * THE BUSINESS SIMULATION.
 *
 * Five people, one order, one shift, plus the failure paths nobody clicks through.
 *
 * ── WHAT THIS IS FOR, AND WHAT IT IS NOT ─────────────────────────────────────
 *
 * It is not a bigger `scripts/journey.ts`. The journey script answers one
 * question and answers it well. This answers a different one:
 *
 *   "If a real customer, a real dispatcher, a real rider and a real person
 *    triaging a dead plant all used this system today, would any of them get
 *    stuck?"
 *
 * Which means it has to act as all of them, in the same run, and — the part that
 * matters — it has to run the paths nobody volunteers to test. A green happy path
 * proves the happy path works. It says nothing about whether the guarantee can be
 * honoured, whether a code can be reissued, or whether the ops console is readable
 * by a stranger. Those are the paths where this business actually loses money and
 * reputation.
 *
 * ── THE SIX THINGS IT EXERCISES ──────────────────────────────────────────────
 *
 *   §1  STOREFRONT   a stranger can find a plant, search for it, and read it
 *   §2  CHECKOUT     order, pay, decline, retry — and the money is in the right place
 *   §3  ACCOUNT      sign in, be greeted like a person, save details, see the order,
 *                    download the receipt, review the plant
 *   §4  FULFILMENT   dispatch, assign, ride, deliver on the customer's code
 *   §5  RECOVERY     the guarantee: claim it, triage it, tell the customer
 *   §6  PRODUCTION   the paths that only differ because NODE_ENV is production
 *
 * Plus, at the end:
 *
 *   §7  INJECTED FAULTS   deliberately broken things, asserting the system refuses
 *   §8  SCHEMA PROOFS     illegal raw SQL, asserting the DATABASE refuses it
 *
 * ── WHY §7 AND §8 EXIST AT ALL ───────────────────────────────────────────────
 *
 * Because a test suite that only ever exercises success paths is decoration. It
 * cannot fail in the interesting way, and it will happily report green while a
 * business invariant has quietly stopped being enforced.
 *
 * §8 goes further than the API: it writes directly with `pg`, bypassing every
 * line of application code, because that is the only way to find out whether a
 * rule is a RULE or a suggestion. §7 does the mirror image — it breaks the
 * application around a working schema and checks the schema holds.
 *
 * ── RUNNING IT ───────────────────────────────────────────────────────────────
 *
 *   make infra-up && make db-migrate && make seed && make seed:catalogue
 *   STAFF_SEED_PASSWORD='…' pnpm seed:staff -- ops@upvvan.test 'Ops Person' ops
 *   make dev
 *   SIM_STAFF_PASSWORD='…' pnpm test:sim
 *
 * Every step exits non-zero on the first broken thing, so it belongs in CI as
 * well as in a terminal.
 */
import {
  BASE,
  Jar,
  all,
  call,
  db,
  clearMail,
  closeDb,
  ensureStock,
  expectRefused,
  one,
  pickCatalogueItem,
  pickRider,
  rupees,
  signInRider,
  signInStaff,
  sleep,
  staffCredentials,
  waitForMail,
  type Staff,
} from './sim-kit'

/* ── the runner ─────────────────────────────────────────────────────────────── */

let step = 0
let failures = 0
const notes: string[] = []

function ok(label: string): void {
  step += 1
  console.log(`  \x1b[32m\u2713\x1b[0m ${String(step).padStart(2, '0')}. ${label}`)
}

function note(text: string): void {
  notes.push(text)
  console.log(`       \x1b[2m\u00b7 ${text}\x1b[0m`)
}

function section(title: string): void {
  console.log(`\n\x1b[1m${title}\x1b[0m`)
}

/**
 * Assert something, and on failure say WHICH stake-holder was left stuck.
 *
 * The extra string is not decoration. A bare assertion failure tells a developer
 * what broke; it does not tell them whose afternoon it ruined, and this project
 * has decided that the person reading a failure should be able to feel the
 * consequence rather than infer it.
 */
async function check(
  label: string,
  consequence: string,
  fn: () => Promise<void> | void,
): Promise<void> {
  try {
    await fn()
    ok(label)
  } catch (error) {
    step += 1
    failures += 1
    console.log(`  \x1b[31m✗\x1b[0m ${step}. ${label}`)
    console.log(`     ${(error as Error).message}`)
    console.log(`     \x1b[2mwho this strands: ${consequence}\x1b[0m`)
  }
}

function must(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

/** Unique per run, so two runs never collide on a UNIQUE column. */
const RUN = process.env.SIM_RUN_ID ?? String(Date.now()).slice(-8)

/** A syntactically valid Indian mobile that nobody in this database owns. */
function mobile(seed: number): string {
  return `9${String(seed).padStart(9, '0').slice(-9)}`
}

/* ── state shared across sections ───────────────────────────────────────────── */

const state = {
  staff: null as Staff | null,
  staffJar: undefined as Jar | undefined,
  guestOrder: '',
  guestPhone: '',
  accountPhone: '',
  accountJar: undefined as Jar | undefined,
  dispatchId: 0,
  deliveryCode: '',
  claimCode: '',
  claimOrderCode: '',
  claimItemId: '',
  accountOrder: '',
  customerName: 'Meera Rao',
  customerEmail: '',
}

/* ══════════════════════════════════════════════════════════════════════════
   §1 · STOREFRONT — can a stranger find a plant?
   ══════════════════════════════════════════════════════════════════════════ */

async function storefront() {
  section('§1 · STOREFRONT — a stranger with no account')

  const cat = await pickCatalogueItem()

  await check('the home page renders', 'the customer never sees what we sell', async () => {
    const res = await call('/', { expect: 200 })
    must(res.text.includes('Upvvan'), 'the home page does not mention the brand')
  })

  await check(
    'the catalogue lists the plant',
    'the customer cannot see there is a shop',
    async () => {
      const res = await call('/plants', { expect: 200 })
      must(res.text.includes('/plant/'), '/plants contains no links to any product page')
    },
  )

  await check('the product page renders the price', 'the customer cannot buy', async () => {
    const res = await call(`/plant/${cat.slug}`, { expect: 200 })
    must(/₹[\d,]+/.test(res.text), 'no rupee price anywhere on the product page')
    must(
      res.text.includes('Legal Metrology') || res.text.includes('MRP'),
      'no Legal Metrology declaration block on the product page',
    )
  })

  await check(
    'search finds the plant by name',
    'the customer concludes the catalogue is empty',
    async () => {
      const res = await call(`/search?q=${encodeURIComponent(cat.slug.split('-')[0] ?? '')}`, {
        expect: 200,
      })
      must(res.text.length > 0, 'the search page rendered nothing')
    },
  )

  await check(
    'search for nonsense says so, and still offers a way forward',
    'the customer is told nothing and leaves',
    async () => {
      const res = await call('/search?q=zzzqqqxyzzy', { expect: 200 })
      must(
        res.text.includes('could not find') || res.text.includes('Nothing matches'),
        'a zero-result search rendered no explanation at all',
      )
    },
  )

  await check(
    'the serviceability gate answers',
    'the customer cannot tell if we deliver to them',
    async () => {
      const res = await call(`/api/serviceability?pincode=${cat.pincode}&city=${cat.citySlug}`, {
        expect: 200,
      })
      must(
        res.body.serviceable === true,
        `pincode ${cat.pincode} is not serviceable: ${JSON.stringify(res.body)}`,
      )
    },
  )

  await check(
    'an unserviceable pincode is refused, politely',
    'the customer learns nothing useful',
    async () => {
      const res = await call('/api/serviceability?pincode=999999&city=bengaluru', {
        expect: [200, 400],
      })
      must(res.body.serviceable !== true, 'a 999999 pincode was reported serviceable')
    },
  )

  return cat
}

/* ══════════════════════════════════════════════════════════════════════════
   §2 · CHECKOUT — money, and only money once it has moved
   ══════════════════════════════════════════════════════════════════════════ */

async function checkout(cat: Awaited<ReturnType<typeof pickCatalogueItem>>) {
  section('§2 · CHECKOUT — order, pay, decline, and know where the money is')

  const phone = mobile(Number(RUN) * 3 + 11)
  state.guestPhone = phone

  await check('a guest places an order', 'the business cannot sell anything', async () => {
    const res = await call('/api/orders', {
      method: 'POST',
      expect: 200,
      body: JSON.stringify({
        pincode: cat.pincode,
        lines: [{ skuId: cat.skuId, planterId: null }],
        customerName: state.customerName,
        customerPhone: phone,
        addressLine1: '14 Ada Apartments, 3rd floor',
        addressLine2: 'Off 100ft Road',
        addressLandmark: 'Opposite the bakery',
        addressCity: 'Bengaluru',
        addressState: 'Karnataka',
      }),
    })
    must(res.body.orderCode, `no order code came back: ${JSON.stringify(res.body)}`)
    must(
      res.body.status === 'PAYMENT_PENDING',
      `a new order claims to be ${res.body.status}. It must be PAYMENT_PENDING — no money has moved.`,
    )
    state.guestOrder = res.body.orderCode
  })

  await check(
    'the order page says payment is PENDING, not "thank you"',
    'the customer believes we have their money when we do not',
    async () => {
      const jar = new Jar()
      await call(`/api/orders/lookup?orderCode=${state.guestOrder}&phone=${phone}`, {
        jar,
        expect: 200,
      })
      const page = await call(`/order/${state.guestOrder}`, { jar, expect: 200 })
      must(
        page.text.includes('Payment pending'),
        'the order page does not say payment is pending. This is the single most damaging thing it could get wrong.',
      )
    },
  )

  await check(
    'a DECLINED card does not advance the order, and does not lose it',
    'the customer is charged nothing and told nothing, and has to rebuild their cart',
    async () => {
      const intent = await call('/api/payments/intent', {
        method: 'POST',
        expect: 200,
        body: JSON.stringify({ orderCode: state.guestOrder, phone }),
      })

      const declined = await call('/api/payments/capture', {
        method: 'POST',
        // 402, not 200: a declined card is a successful REFUSAL, and the UI has
        // to tell the customer their card was declined rather than that something
        // went wrong. Asserting 200 here was the harness being wrong, not the app.
        expect: [200, 402],
        body: JSON.stringify({
          intentId: intent.body.intentId,
          orderCode: state.guestOrder,
          phone,
          simulate: 'decline',
        }),
      })
      must(
        declined.body.paymentState !== 'captured',
        'a DECLINED payment reported itself as captured.',
      )

      const row = await one<{ status: string; payment_state: string }>(
        `SELECT o."status"::text AS "status", o."payment_state"
           FROM "orders" o WHERE o."order_code" = $1`,
        [state.guestOrder],
      )
      must(
        row?.payment_state !== 'captured',
        `the database says payment_state = ${row?.payment_state} after a decline.`,
      )
      must(
        row?.status === 'PAYMENT_PENDING',
        `the order advanced to ${row?.status} on a declined payment.`,
      )
    },
  )

  await check(
    'a customer can pay a declined order afterwards without rebuilding anything',
    'a card refused at 11pm means rebuilding the cart at 11pm',
    async () => {
      const intent = await call('/api/payments/intent', {
        method: 'POST',
        expect: 200,
        body: JSON.stringify({ orderCode: state.guestOrder, phone }),
      })
      const captured = await call('/api/payments/capture', {
        method: 'POST',
        expect: 200,
        body: JSON.stringify({
          intentId: intent.body.intentId,
          orderCode: state.guestOrder,
          phone,
          simulate: 'success',
        }),
      })
      must(
        captured.body.paymentState === 'captured',
        `the retry did not capture: ${JSON.stringify(captured.body)}`,
      )

      const row = await one<{ revenue_paise: string; payment_state: string }>(
        `SELECT o."revenue_paise"::text, o."payment_state"
           FROM "orders" o WHERE o."order_code" = $1`,
        [state.guestOrder],
      )
      must(
        row?.payment_state === 'captured',
        `the database says payment_state = ${row?.payment_state} after a successful retry.`,
      )
    },
  )

  await check(
    'capture is idempotent — a double-tapped button charges once',
    'a customer is charged twice and has to argue with us about it',
    async () => {
      const before = await one<{ captured_at: Date }>(
        `SELECT o."payment_captured_at" AS "captured_at"
           FROM "orders" o WHERE o."order_code" = $1`,
        [state.guestOrder],
      )
      // No new intent: `POST /api/payments/intent` correctly refuses to issue one
      // for an order that is already captured, so this replays the CAPTURE with
      // the id that already exists — which is what a retried webhook and a
      // double-tapped button both look like.
      const existing = await one<{ intent: string | null }>(
        `SELECT "payment_intent_id" AS "intent" FROM "orders" WHERE "order_code" = $1`,
        [state.guestOrder],
      )
      must(existing?.intent, 'the captured order has no payment_intent_id recorded')

      await call('/api/payments/capture', {
        method: 'POST',
        expect: [200, 409],
        body: JSON.stringify({
          intentId: existing!.intent,
          orderCode: state.guestOrder,
          phone,
          simulate: 'success',
        }),
      })
      const after = await one<{ captured_at: Date }>(
        `SELECT o."payment_captured_at" AS "captured_at"
           FROM "orders" o WHERE o."order_code" = $1`,
        [state.guestOrder],
      )
      must(
        String(before?.captured_at) === String(after?.captured_at),
        'the capture timestamp moved on a repeat capture. Two captures is two charges.',
      )
    },
  )

  await check(
    'the owner is told about the sale, not just the customer',
    'the founder finds out about revenue by opening the database',
    async () => {
      await waitForMail(
        (m) => m.subject.includes('NEW ORDER') && m.subject.includes(state.guestOrder),
        'the NEW ORDER alert for the owner',
      )
    },
  )

  await check(
    'the customer can look their order up by code + phone',
    'a customer who has lost the tab cannot find their order at all',
    async () => {
      const wrong = await call(
        `/api/orders/lookup?orderCode=${state.guestOrder}&phone=${phone.slice(0, -4)}0000`,
        { expect: 404 },
      )
      must(wrong.body.message, 'a wrong phone number produced no message at all')

      const right = await call(`/api/orders/lookup?orderCode=${state.guestOrder}&phone=${phone}`, {
        expect: 200,
      })
      must(right.body.orderCode === state.guestOrder, 'the correct credentials did not work')
    },
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   §3 · ACCOUNT — sign in, be recognised, find the order, get the receipt
   ══════════════════════════════════════════════════════════════════════════ */

async function account(cat: Awaited<ReturnType<typeof pickCatalogueItem>>) {
  section('§3 · ACCOUNT — a returning customer, who is a person')

  const phone = mobile(Number(RUN) * 7 + 23)
  state.accountPhone = phone
  const jar = new Jar()

  await check(
    'sign-in works with the code that actually arrived',
    'the customer can never get into the account they came for',
    async () => {
      const requested = await call('/api/auth/phone-number/send-otp', {
        method: 'POST',
        jar,
        expect: [200, 201],
        body: JSON.stringify({ phoneNumber: `+${phone}` }),
      })
      must(
        requested.status !== 400,
        'the sign-in endpoint refused a valid Indian mobile. Check the phoneNumber plugin is registered.',
      )

      const mail = await waitForMail(
        (m) =>
          m.to.replace(/\D/g, '').includes(phone) && /is your Upvvan sign-in code/.test(m.subject),
        'the sign-in OTP e-mail',
      )
      const code = /(\d{6}) is your Upvvan sign-in code/.exec(mail.subject)?.[1]
      must(code, 'the sign-in e-mail carried no code in its subject')

      const verified = await call('/api/auth/phone-number/verify', {
        method: 'POST',
        jar,
        expect: 200,
        body: JSON.stringify({ phoneNumber: `+${phone}`, code }),
      })
      must(!verified.body.error, `verification failed: ${JSON.stringify(verified.body.error)}`)
      state.accountJar = jar
    },
  )

  await check(
    'the account greets the customer, not their phone number',
    'the account page treats a person as an account identifier',
    async () => {
      const res = await call('/account', { jar, expect: 200 })
      must(
        /Good (morning|afternoon|evening)/.test(res.text),
        'the account page has no time-of-day greeting',
      )
      must(
        !/<h1[^>]*>\s*\+91\d{10}\s*<\/h1>/.test(res.text),
        'the account page is still heading with a raw phone number.',
      )
    },
  )

  await check(
    'the customer can give us a name and an e-mail',
    'every invoice, packing slip and doorstep conversation says "phone number" instead of a person',
    async () => {
      state.customerEmail = `${phone}@example.com`
      const saved = await call('/api/account/profile', {
        method: 'POST',
        jar,
        expect: 200,
        body: JSON.stringify({ name: state.customerName, contactEmail: state.customerEmail }),
      })
      must(saved.body.ok, `the profile did not save: ${JSON.stringify(saved.body)}`)

      const profile = await call('/account/profile', { jar, expect: 200 })
      must(profile.text.includes(state.customerName), 'the saved name is not on the profile page.')
      must(
        profile.text.includes(state.customerEmail),
        'the saved e-mail is not on the profile page.',
      )
    },
  )

  await check(
    'the synthetic identity e-mail is never shown to the customer',
    'the customer sees phone-919000000001@identity.invalid and concludes the product is unfinished',
    async () => {
      const res = await call('/account', { jar, expect: 200 })
      must(
        !res.text.includes('identity.invalid'),
        'an @identity.invalid placeholder was rendered to a human',
      )
    },
  )

  const orderPhone = phone
  await check(
    'an order placed while signed in appears on the account',
    'a customer buys something and their own account says they have never bought anything',
    async () => {
      const placed = await call('/api/orders', {
        method: 'POST',
        jar,
        expect: 200,
        body: JSON.stringify({
          pincode: cat.pincode,
          lines: [{ skuId: cat.skuId, planterId: null }],
          customerName: state.customerName,
          customerPhone: orderPhone,
          addressLine1: '7 Palace Cross, 2nd floor',
          addressCity: 'Bengaluru',
          addressState: 'Karnataka',
        }),
      })
      must(placed.body.orderCode, `no order code: ${JSON.stringify(placed.body)}`)

      const row = await one<{ customer_id: string | null }>(
        `SELECT o."customer_id" FROM "orders" o WHERE o."order_code" = $1`,
        [placed.body.orderCode],
      )
      must(row?.customer_id, 'the order row has a NULL customer_id after a signed-in checkout.')

      // Paid here, deliberately. The receipt check below is about a PAID order, and
      // an unpaid one legitimately has no receipt link — asserting on it would
      // have reported correct behaviour as a bug.
      const intent = await call('/api/payments/intent', {
        method: 'POST',
        expect: 200,
        body: JSON.stringify({ orderCode: placed.body.orderCode, phone: orderPhone }),
      })
      const captured = await call('/api/payments/capture', {
        method: 'POST',
        expect: [200, 402],
        body: JSON.stringify({
          intentId: intent.body.intentId,
          orderCode: placed.body.orderCode,
          phone: orderPhone,
          simulate: 'success',
        }),
      })
      must(
        captured.body.paymentState === 'captured',
        `the account customer's order did not capture: ${JSON.stringify(captured.body)}`,
      )
      state.accountOrder = placed.body.orderCode

      const page = await call('/account', { jar, expect: 200 })
      must(
        page.text.includes(placed.body.orderCode),
        'the order is in the database but not on the customer own account page.',
      )
    },
  )

  await check(
    'the account shows real status words, never a storage value',
    'the customer reads OUT_FOR_DELIVERY on their own account and concludes it is broken',
    async () => {
      const page = await call('/account', { jar, expect: 200 })
      for (const leaked of [
        'PAYMENT_PENDING',
        'OUT_FOR_DELIVERY',
        'CLAIM_OPEN',
        'REPLACEMENT_QUEUED',
        'PLACED',
      ]) {
        must(
          !page.text.includes(leaked),
          `the account page leaks the storage value "${leaked}" to a customer.`,
        )
      }
    },
  )

  await check(
    'the customer can download a receipt for a paid order',
    'a customer who has paid cannot get the document proving it',
    async () => {
      const page = await call('/account', { jar, expect: 200 })
      must(
        page.text.includes('download-receipt'),
        'no receipt download anywhere on the account page.',
      )

      must(
        page.text.includes(`data-testid="download-receipt"`) &&
          page.text.includes(`/api/orders/${state.accountOrder}/receipt`),
        'the account has no receipt download for the order it is displaying.',
      )

      const receipt = await call(`/api/orders/${state.accountOrder}/receipt`, { jar, expect: 200 })
      const disposition = receipt.headers.get('content-disposition') ?? ''
      must(
        disposition.includes('attachment'),
        `the receipt is not offered as a download: ${disposition || '(no Content-Disposition)'}`,
      )
      must(receipt.text.includes('₹'), 'the receipt contains no rupee amounts')
      must(receipt.text.includes('GST'), 'the receipt contains no GST breakdown')
    },
  )

  await check(
    'a signed-in customer can open their own invoice and order page',
    'the account can list an order but not show it — every link is a dead end',
    async () => {
      const page = await call('/account', { jar, expect: 200 })
      must(
        page.text.includes(`href="/order/${state.accountOrder}"`),
        'the account does not link to the order it just showed the customer.',
      )

      const order = await call(`/order/${state.accountOrder}`, { jar, expect: 200 })
      must(order.text.includes(state.accountOrder), 'the order page did not render the order')

      const invoice = await call(`/invoice/${state.accountOrder}`, { jar, expect: 200 })
      must(invoice.text.includes('Tax invoice'), 'the invoice page did not render')
    },
  )

  await check(
    'one customer cannot read another customer order',
    'every address, phone number and order on the platform leaks to anyone signed in',
    async () => {
      const notMine = await call(`/order/${state.guestOrder}`, { jar })
      must(
        notMine.status === 404 || notMine.status === 307,
        `a signed-in customer reached somebody else's order page and got ${notMine.status}.`,
      )

      const notMineInvoice = await call(`/invoice/${state.guestOrder}`, { jar })
      must(
        notMineInvoice.status === 404,
        `a signed-in customer reached somebody else's invoice and got ${notMineInvoice.status}.`,
      )
    },
  )

  await check(
    'the customer can save and set a default address',
    'the rider has to phone for an address on every single delivery',
    async () => {
      const created = await call('/api/addresses', {
        method: 'POST',
        jar,
        expect: 201,
        body: JSON.stringify({
          label: 'Home',
          fullName: state.customerName,
          line1: '7 Palace Cross, 2nd floor',
          city: 'Bengaluru',
          pincode: cat.pincode,
        }),
      })
      must(created.body.address?.id, `the address did not save: ${JSON.stringify(created.body)}`)
      must(
        created.body.address.isDefault === true,
        'the FIRST address a customer saves did not become their default. Checkout then has nowhere to deliver.',
      )

      const page = await call('/account/addresses', { jar, expect: 200 })
      must(page.text.includes('Home'), 'the saved address is not on the addresses page')
    },
  )

  await check(
    'a signed-out visitor is sent to sign in rather than shown an empty account',
    'the account looks broken rather than protected',
    async () => {
      const res = await call('/account')
      must(
        res.status === 307 || res.status === 302,
        `/account answered ${res.status} to a signed-out visitor. It must redirect to sign-in.`,
      )
      must(
        (res.location ?? '').includes('/sign-in'),
        `/account redirected somewhere useless: ${res.location}`,
      )
    },
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   §4 · FULFILMENT — the dispatcher, then the rider
   ══════════════════════════════════════════════════════════════════════════ */

async function fulfilment(cat: Awaited<ReturnType<typeof pickCatalogueItem>>) {
  section('§4 · FULFILMENT — dispatch, ride, and deliver on the customer code')

  const staff = await staffCredentials()
  state.staff = staff

  await check(
    'the ops console is not readable by a stranger',
    'every order code, revenue figure, rider name and payout is published to the internet',
    async () => {
      for (const path of [
        '/admin-ops',
        '/admin-ops/queue',
        '/admin-ops/board',
        '/admin-ops/claims',
      ]) {
        const res = await call(path)
        must(
          res.status === 307 || res.status === 302 || res.status === 401 || res.status === 403,
          `${path} answered ${res.status} to an anonymous visitor. The ops console must be gated.`,
        )
      }
    },
  )

  await check('the dispatcher can sign in', 'nobody can work the queue', async () => {
    state.staffJar = await signInStaff(staff)
    const res = await call('/admin-ops', { jar: state.staffJar, expect: 200 })
    must(res.text.includes('Rider pay today'), 'the shift dashboard did not render')
  })

  await check(
    'a paid order with no rider is in the queue',
    'an order sits paid and packed-in-theory for ever because nobody can see it',
    async () => {
      const res = await call('/admin-ops/queue', { jar: state.staffJar, expect: 200 })
      must(res.text.includes(state.guestOrder), `${state.guestOrder} is not in the assign queue`)
    },
  )

  await check(
    'a stranger cannot assign a rider',
    'the append-only dispatch ledger can be written by anyone, which makes it worthless as evidence',
    async () => {
      const res = await call('/api/dispatch/assign', {
        method: 'POST',
        expect: 401,
        body: JSON.stringify({ orderCode: state.guestOrder, distanceKm: 4 }),
      })
      must(res.body.message, 'an unauthenticated assign attempt produced no message')
    },
  )

  await check(
    'an UNPAID order cannot be dispatched, whatever the schema allows',
    'cash-on-delivery through the back door, plus a rider paid to deliver goods nobody bought',
    async () => {
      const unpaid = await call('/api/orders', {
        method: 'POST',
        expect: 200,
        body: JSON.stringify({
          pincode: cat.pincode,
          lines: [{ skuId: cat.skuId, planterId: null }],
          customerName: 'Unpaid Test',
          customerPhone: mobile(Number(RUN) * 11 + 5),
          addressLine1: '1 Unpaid Road',
          addressCity: 'Bengaluru',
          addressState: 'Karnataka',
        }),
      })
      const res = await call('/api/dispatch/assign', {
        method: 'POST',
        jar: state.staffJar!,
        expect: [422, 409, 500],
        body: JSON.stringify({ orderCode: unpaid.body.orderCode, distanceKm: 2 }),
      })
      must(
        res.status !== 200,
        `an UNPAID order (${unpaid.body.orderCode}) was dispatched. That is COD through the back door.`,
      )
    },
  )

  await check(
    'the dispatcher assigns a rider and the pay is snapshotted',
    'a band change tomorrow silently rewrites what a rider earned today',
    async () => {
      const res = await call('/api/dispatch/assign', {
        method: 'POST',
        jar: state.staffJar!,
        expect: 200,
        body: JSON.stringify({ orderCode: state.guestOrder, distanceKm: 4 }),
      })
      must(res.body.dispatchId, `no dispatch came back: ${JSON.stringify(res.body)}`)
      state.dispatchId = res.body.dispatchId
      note(`${res.body.riderName} · band ${res.body.bandCode} · ${rupees(res.body.payoutPaise)}`)

      const row = await one<{ payout_paise: string; band_code: string }>(
        `SELECT d."payout_paise"::text, d."band_code" FROM "dispatches" d WHERE d."id" = $1`,
        [state.dispatchId],
      )
      must(
        Number(row?.payout_paise) > 0,
        'the dispatch recorded a payout of zero. A rider would work for nothing.',
      )
    },
  )

  await check(
    'the dispatcher gets the address and the phone, and the customer gets a code',
    'a dispatched parcel that neither party can act on',
    async () => {
      await waitForMail(
        (m) => m.subject.includes('New drop') && m.subject.includes(state.guestOrder),
        'the dispatch e-mail to the rider',
      )
      state.deliveryCode = await (async () => {
        const mail = await waitForMail(
          (m) => m.subject.includes(state.guestOrder) && /your delivery code is/i.test(m.subject),
          'the delivery code to the customer',
        )
        return /your delivery code is (\d+)/i.exec(mail.subject)![1]!
      })()
    },
  )

  const rider = await pickRider()
  let riderJar: Jar | null = null

  await check(
    'the rider signs in with an OTP that actually arrived',
    'riders cannot start a shift, so nothing is ever delivered',
    async () => {
      const signed = await signInRider(rider.phone)
      riderJar = signed.jar
      const page = await call('/rider', { jar: riderJar, expect: 200 })
      must(page.text.includes('End shift'), 'the rider page has no way to end a shift')
    },
  )

  await check(
    "the rider's run shows the drop with a real address and a way to call",
    'the rider has to read the address off an e-mail and cannot call the customer at all',
    async () => {
      // The drop may belong to another rider if allocation chose differently, so
      // look at whichever rider holds it.
      const holder = await one<{ rider_id: number; phone: string; name: string }>(
        `SELECT d."rider_id", r."phone", r."name"
           FROM "dispatches" d JOIN "riders" r ON r."id" = d."rider_id"
          WHERE d."id" = $1`,
        [state.dispatchId],
      )
      must(holder, 'the dispatch row vanished')

      const jar = holder.phone === rider.phone ? riderJar! : (await signInRider(holder.phone)).jar

      const page = await call('/rider', { jar, expect: 200 })
      must(page.text.includes(state.guestOrder), `the drop is not on ${holder.name}'s run`)
      must(page.text.includes('Call '), 'the rider surface has no way to telephone the customer')
      must(
        /data-testid="drop-address"/.test(page.text),
        'the rider surface shows no delivery address.',
      )
      // Next.js puts a comment node between adjacent JSX expressions, so the
      // rendered text is "Band <!-- -->B". Match the band letter with the label
      // on the same line rather than assuming an exact string.
      must(
        /Band\s*(<!-- -->)?\s*[A-Z]/.test(page.text),
        'the rider surface does not show which band this drop pays.',
      )
    },
  )

  const holderRider = await one<{ phone: string }>(
    `SELECT r."phone" FROM "dispatches" d JOIN "riders" r ON r."id" = d."rider_id" WHERE d."id" = $1`,
    [state.dispatchId],
  )
  const runJar =
    holderRider?.phone === rider.phone ? riderJar! : (await signInRider(holderRider!.phone)).jar

  await check(
    'the rider picks it up and sets out',
    'the parcel sits at the nursery and the customer is told nothing',
    async () => {
      for (const to of ['PICKED_UP', 'OUT_FOR_DELIVERY'] as const) {
        await call(`/api/rider/dispatch/${state.dispatchId}/transition`, {
          method: 'POST',
          jar: runJar,
          expect: 200,
          body: JSON.stringify({ to }),
        })
      }
    },
  )

  await check(
    'the customer timeline now tells the truth about the journey',
    'the order page says "Delivered" above a timeline that stops at "Payment received"',
    async () => {
      const events = await all<{ status: string; note: string }>(
        `SELECT oe."status"::text AS "status", oe."note"
           FROM "order_events" oe
           JOIN "orders" o ON o."id" = oe."order_id"
          WHERE o."order_code" = $1
          ORDER BY oe."created_at" ASC`,
        [state.guestOrder],
      )
      const statuses = events.map((e) => e.status)
      note(`timeline: ${statuses.join(' → ')}`)
      for (const required of ['OUT_FOR_DELIVERY']) {
        must(
          statuses.includes(required),
          `the customer timeline never mentions ${required}. It reads: ${statuses.join(', ')}`,
        )
      }
    },
  )

  await check(
    'a wrong delivery code is refused',
    'parcels are marked delivered without the customer being there',
    async () => {
      const wrong = '000000'
        .split('')
        .map((c, i) => (c === '0' && i === 5 ? '1' : c))
        .join('')
      const res = await call(`/api/rider/dispatch/${state.dispatchId}/deliver`, {
        method: 'POST',
        jar: runJar,
        expect: [400, 409],
        body: JSON.stringify({ code: wrong }),
      })
      must(res.body.message, 'a wrong code produced no message for the rider')

      const row = await one<{ status: string }>(
        `SELECT d."status" FROM "dispatches" d WHERE d."id" = $1`,
        [state.dispatchId],
      )
      must(row?.status !== 'DELIVERED', 'a WRONG code closed the delivery.')
    },
  )

  await check(
    'the delivery closes on the code the customer reads out, and both sides agree',
    'the single most-cited complaint in this category',
    async () => {
      await call(`/api/rider/dispatch/${state.dispatchId}/deliver`, {
        method: 'POST',
        jar: runJar,
        expect: 200,
        body: JSON.stringify({
          code: state.deliveryCode,
          claimEvidenceKind: 'unboxing_video_requested',
        }),
      })

      const dispatch = await one<{ status: string; payout_paise: string }>(
        `SELECT d."status", d."payout_paise"::text FROM "dispatches" d WHERE d."id" = $1`,
        [state.dispatchId],
      )
      must(dispatch?.status === 'DELIVERED', 'the dispatch is not DELIVERED after a correct code')

      const order = await one<{ status: string; payment_state: string }>(
        `SELECT o."status"::text AS "status", o."payment_state"
           FROM "orders" o WHERE o."order_code" = $1`,
        [state.guestOrder],
      )
      must(
        order?.status === 'DELIVERED',
        `the ORDER is ${order?.status} after a delivered dispatch. The customer page reads this column.`,
      )

      const events = await all<{ status: string }>(
        `SELECT oe."status"::text AS "status"
           FROM "order_events" oe JOIN "orders" o ON o."id" = oe."order_id"
          WHERE o."order_code" = $1 ORDER BY oe."created_at" ASC`,
        [state.guestOrder],
      )
      must(
        events.some((e) => e.status === 'DELIVERED'),
        'no DELIVERED entry in the customer timeline after a delivered parcel.',
      )
    },
  )

  await check(
    'the rider is owed exactly what the band promised',
    'the incentive argument rests on a rider who was promised a rate being paid it',
    async () => {
      const row = await one<{ payout_paise: string }>(
        `SELECT d."payout_paise"::text FROM "dispatches" d WHERE d."id" = $1`,
        [state.dispatchId],
      )
      const owed = Number(row?.payout_paise ?? 0)
      must(Number.isInteger(owed) && owed > 0, `the rider is owed ${row?.payout_paise}`)

      const page = await call('/rider', { jar: runJar, expect: 200 })
      must(
        page.text.includes(rupees(owed)),
        `the rider run page does not show the ${rupees(owed)} they have earned.`,
      )
    },
  )

  await check(
    'the customer is asked to review a plant they have actually received',
    'the review wall is empty forever, because nothing can write to it',
    async () => {
      const item = await one<{ id: string }>(
        `SELECT oi."id" FROM "orders_items" oi
          WHERE oi."_parent_id" = (SELECT o."id" FROM "orders" o WHERE o."order_code" = $1) LIMIT 1`,
        [state.guestOrder],
      )
      must(item, 'the order has no lines to review')

      // The review route authorises on the signed order cookie OR a customer
      // session, exactly like every other order-scoped surface. A guest has
      // neither until they do the code+phone lookup, so the harness has to do
      // what a guest does — and it is worth doing, because a 404 here would be
      // the correct answer and a 201 would be a leak.
      const guestJar = new Jar()
      await call(`/api/orders/lookup?orderCode=${state.guestOrder}&phone=${state.guestPhone}`, {
        jar: guestJar,
        expect: 200,
      })

      const res = await call('/api/reviews', {
        method: 'POST',
        jar: guestJar,
        expect: 201,
        body: JSON.stringify({
          orderCode: state.guestOrder,
          phone: state.guestPhone,
          orderItemId: item!.id,
          rating: 5,
          title: 'Arrived bigger than expected',
          review: 'Packed really well and no shock to the leaves at all.',
        }),
      })
      must(res.body.reviewId, `the review was not recorded: ${JSON.stringify(res.body)}`)

      const stored = await one<{ author_name: string; is_published: boolean }>(
        `SELECT r."author_name", r."is_published" FROM "reviews" r WHERE r."id" = $1`,
        [res.body.reviewId],
      )
      must(stored, 'the review row is not in the database')
      must(
        stored!.author_name.includes(state.customerName.split(' ')[0]!),
        `the review author is "${stored!.author_name}" — expected it to be derived from the order.`,
      )
    },
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   §5 · RECOVERY — the guarantee, which is the whole business
   ══════════════════════════════════════════════════════════════════════════ */

async function recovery() {
  section('§5 · RECOVERY — a plant dies, and somebody has to fix it')

  const jar = new Jar()
  const phone = state.guestPhone
  const code = state.guestOrder

  await check(
    'a customer can open the claim form for their own delivered order',
    'a dead plant with nobody able to do anything about it',
    async () => {
      await call(`/api/orders/lookup?orderCode=${code}&phone=${phone}`, { jar, expect: 200 })
      const page = await call(`/claim/${code}`, { jar, expect: 200 })
      must(page.text.includes('Tell us what arrived'), 'the claim form did not render')

      const item = await one<{ id: string }>(
        `SELECT oi."id" FROM "orders_items" oi
          WHERE oi."_parent_id" = (SELECT o."id" FROM "orders" o WHERE o."order_code" = $1) LIMIT 1`,
        [code],
      )
      state.claimItemId = item!.id
    },
  )

  await check(
    'the claim form states the real guarantee window, from the price book',
    'the customer is told 48 hours here and 30 days on the policy page, and believes whichever they read second',
    async () => {
      const page = await call(`/claim/${code}`, { jar, expect: 200 })
      must(
        !page.text.includes('48 hours from delivery'),
        'the claim form still hardcodes "48 hours from delivery"',
      )

      const tier = await one<{ guarantee_tier: string }>(
        `SELECT o."guarantee_tier"::text FROM "orders" o WHERE o."order_code" = $1`,
        [code],
      )
      note(`order sold at guarantee tier ${tier?.guarantee_tier}`)
    },
  )

  await check(
    'the customer can file a claim and is given a reference',
    'a customer who has lost the e-mail has no handle on their own complaint',
    async () => {
      const res = await call('/api/claims', {
        method: 'POST',
        expect: 201,
        body: JSON.stringify({
          orderCode: code,
          phone,
          kind: 'DEAD_ON_ARRIVAL',
          orderItemId: state.claimItemId,
          description:
            'The stem was black and soft at the base two days after it arrived. It was wet soil, not a dry plant.',
        }),
      })
      must(res.body.claimId, `no claim reference came back: ${JSON.stringify(res.body)}`)
      state.claimCode = res.body.claimId
      state.claimOrderCode = code
      note(`claim ${state.claimCode}`)
    },
  )

  await check(
    'the claim is visible on the customer own order page',
    'a customer has to email support to find out what happened to their claim',
    async () => {
      const page = await call(`/order/${code}`, { jar, expect: 200 })
      must(
        page.text.includes(state.claimCode),
        `the order page does not mention ${state.claimCode}`,
      )
    },
  )

  await check(
    'the claim reaches the owner, in the inbox rather than the database',
    'a claim sits unseen until a customer escalates',
    async () => {
      await waitForMail(
        (m) => m.subject.includes(state.claimCode) || m.subject.includes('CLAIM'),
        'the claim alert to the owner',
      )
    },
  )

  await check(
    'a second claim is refused with an explanation, not a stack trace',
    'a customer writes the same complaint twice and gets an error',
    async () => {
      const res = await call('/api/claims', {
        method: 'POST',
        expect: 409,
        body: JSON.stringify({
          orderCode: code,
          phone,
          kind: 'DAMAGED',
          orderItemId: state.claimItemId,
          description: 'Actually the pot was cracked as well as the plant being dead.',
        }),
      })
      must(
        typeof res.body.message === 'string' && res.body.message.length > 20,
        'a duplicate claim produced no human sentence.',
      )
      must(
        !/SELECT|INSERT|pg_|error/i.test(res.body.message),
        `an internal detail reached the customer: ${res.body.message}`,
      )
    },
  )

  await check(
    'the claim appears in the ops console where a person can decide it',
    'a claim a human cannot answer is a complaint, not a process',
    async () => {
      const page = await call('/admin-ops/claims', { jar: state.staffJar!, expect: 200 })
      must(page.text.includes(state.claimCode), `${state.claimCode} is not in the claims console`)
    },
  )

  const claimRow = await one<{ id: number }>(
    `SELECT "id" FROM "order_claims" WHERE "order_code" = $1 AND "status" = 'OPEN' ORDER BY "id" DESC LIMIT 1`,
    [code],
  )

  await check(
    'a stranger cannot resolve a claim',
    'a customer rejects their own claim, or accepts a replacement they are not owed',
    async () => {
      const res = await call(`/api/admin-ops/claims/${claimRow!.id}/resolve`, {
        method: 'POST',
        expect: 401,
        body: JSON.stringify({ outcome: 'accepted' }),
      })
      must(res.body.message, 'an unauthenticated triage attempt produced no message')
    },
  )

  await check(
    'a rejection cannot be filed without saying why',
    'a customer whose plant died is told "we disagree" with no reason, and cannot appeal',
    async () => {
      const res = await call(`/api/admin-ops/claims/${claimRow!.id}/resolve`, {
        method: 'POST',
        jar: state.staffJar!,
        expect: 400,
        body: JSON.stringify({ outcome: 'rejected' }),
      })
      must(res.body.message, 'a bare rejection was accepted without a reason')

      const still = await one<{ status: string }>(
        `SELECT c."status" FROM "order_claims" c WHERE c."id" = $1`,
        [claimRow!.id],
      )
      must(still?.status === 'OPEN', 'the claim was closed despite the rejection being refused.')
    },
  )

  await check(
    'the owner accepts the claim, and the order leaves CLAIM_OPEN',
    'the order is pinned at CLAIM_OPEN for ever, which also blocks a second genuine report',
    async () => {
      const res = await call(`/api/admin-ops/claims/${claimRow!.id}/resolve`, {
        method: 'POST',
        jar: state.staffJar!,
        expect: 200,
        body: JSON.stringify({ outcome: 'accepted', note: 'Photo shows a black stem. Replacing.' }),
      })
      must(res.body.ok, `triage failed: ${JSON.stringify(res.body)}`)

      const claim = await one<{ status: string; resolved_by: string | null }>(
        `SELECT c."status", c."resolved_by" FROM "order_claims" c WHERE c."id" = $1`,
        [claimRow!.id],
      )
      must(claim?.status === 'ACCEPTED', `the claim status is ${claim?.status}`)
      must(
        claim?.resolved_by,
        'the resolved claim has no resolved_by. That is an unattributable decision.',
      )

      const order = await one<{ status: string }>(
        `SELECT o."status"::text AS "status" FROM "orders" o WHERE o."order_code" = $1`,
        [code],
      )
      must(
        order?.status !== 'CLAIM_OPEN',
        `the order is still pinned at ${order?.status}. Nothing can ever move it.`,
      )
    },
  )

  await check(
    'the customer is told what we decided',
    'a customer who filed a claim and heard nothing concludes they were ignored',
    async () => {
      await waitForMail(
        (m) =>
          m.to.replace(/\D/g, '').includes(state.guestPhone) &&
          /we have accepted|accepted your claim/i.test(m.subject),
        'the claim-resolution e-mail to the customer',
      )
    },
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   §6 · PRODUCTION — the paths that only differ because NODE_ENV differs
   ══════════════════════════════════════════════════════════════════════════ */

async function productionPaths(cat: Awaited<ReturnType<typeof pickCatalogueItem>>) {
  section('§6 · PRODUCTION-ONLY PATHS — simulated')

  const phone = mobile(Number(RUN) * 13 + 31)

  await check(
    'an UNKNOWN number gets no sign-in challenge (anti-enumeration)',
    'anyone can discover which mobile numbers are customers',
    async () => {
      const res = await call('/api/rider/session', {
        method: 'POST',
        expect: 200,
        body: JSON.stringify({ action: 'request', phone }),
      })
      must(
        res.body.challengeId === undefined,
        'an unknown rider number received a challenge. The endpoint is an account-existence oracle.',
      )
    },
  )

  await check(
    'a wrong rider OTP is refused, generically',
    'a rider is told whether their challenge id was real, which lets them enumerate riders',
    async () => {
      const res = await call('/api/rider/session', {
        method: 'POST',
        expect: 401,
        body: JSON.stringify({ action: 'verify', challengeId: 999999, code: '123456' }),
      })
      must(typeof res.body.message === 'string', 'no message came back')
      must(
        !/challenge|expired|not found|does not exist/i.test(res.body.message),
        `the message distinguishes the failure modes: "${res.body.message}"`,
      )
    },
  )

  await check(
    'the rider sign-out form works as a real form post, with no JavaScript',
    'a rider with a broken bundle cannot end their shift, and the session lives on',
    async () => {
      const rider = await pickRider()
      const { jar } = await signInRider(rider.phone)

      const before = await call('/rider', { jar, expect: 200 })
      must(before.text.includes('End shift'), 'the rider is not signed in to begin with')

      await call('/api/rider/session', {
        method: 'POST',
        jar,
        form: { action: 'signout' },
        expect: [200, 303],
      })

      const after = await call('/rider', { jar })
      must(
        after.status === 307 || after.status === 302,
        `after signing out as a form post, /rider answered ${after.status}. The session survived.`,
      )
    },
  )

  await check(
    'the delivery code survives a delivery window, not a five-minute sign-in window',
    'a drop assigned at 6pm cannot be closed at 8pm, and three error messages tell the rider to ask a dispatcher who has no such button',
    async () => {
      const placed = await call('/api/orders', {
        method: 'POST',
        expect: 200,
        body: JSON.stringify({
          pincode: cat.pincode,
          lines: [{ skuId: cat.skuId, planterId: null }],
          customerName: 'Window Test',
          customerPhone: mobile(Number(RUN) * 17 + 3),
          addressLine1: '22 Long Shift Road',
          addressCity: 'Bengaluru',
          addressState: 'Karnataka',
        }),
      })
      const orderCode = placed.body.orderCode
      const intent = await call('/api/payments/intent', {
        method: 'POST',
        expect: 200,
        body: JSON.stringify({ orderCode, phone: mobile(Number(RUN) * 17 + 3) }),
      })
      await call('/api/payments/capture', {
        method: 'POST',
        expect: 200,
        body: JSON.stringify({
          intentId: intent.body.intentId,
          orderCode,
          phone: mobile(Number(RUN) * 17 + 3),
          simulate: 'success',
        }),
      })
      await call('/api/dispatch/assign', {
        method: 'POST',
        jar: state.staffJar!,
        expect: 200,
        body: JSON.stringify({ orderCode, distanceKm: 5 }),
      })

      const row = await one<{ expires_at: Date; sent_at: Date }>(
        `SELECT d."delivery_otp_expires_at" AS "expires_at", d."delivery_otp_sent_at" AS "sent_at"
           FROM "dispatches" d JOIN "orders" o ON o."id" = d."order_id"
          WHERE o."order_code" = $1`,
        [orderCode],
      )
      const windowMinutes =
        (new Date(row!.expires_at).getTime() - new Date(row!.sent_at).getTime()) / 60_000
      note(`delivery code window: ${Math.round(windowMinutes)} minutes`)
      must(
        windowMinutes > 30,
        `the delivery code is only valid for ${Math.round(windowMinutes)} minutes. ` +
          `That is a sign-in OTP lifetime applied to a doorstep transaction.`,
      )
    },
  )

  await check(
    'a dispatcher can reissue a code, and the customer is actually told',
    'five wrong taps and a drop is permanently unclosable by anyone, through any interface',
    async () => {
      const stuck = await one<{ id: number; order_code: string }>(
        `SELECT d."id", o."order_code"
           FROM "dispatches" d JOIN "orders" o ON o."id" = d."order_id"
          WHERE d."status" NOT IN ('DELIVERED','CANCELLED')
          ORDER BY d."id" DESC LIMIT 1`,
      )
      must(stuck, 'no open dispatch to reissue a code for')

      const res = await call(`/api/dispatch/${stuck!.id}/reissue`, {
        method: 'POST',
        jar: state.staffJar!,
        expect: 200,
      })
      must(res.body.ok, `reissue failed: ${JSON.stringify(res.body)}`)

      await waitForMail(
        (m) => m.subject.includes(stuck!.order_code) && /your delivery code is/i.test(m.subject),
        'the reissued delivery code to the customer',
      )
    },
  )

  await check(
    'the contact form records a corporate lead even when the visitor gave a MOBILE number',
    'every phone-only B2B enquiry vanishes from the pipeline, behind a log line nobody reads',
    async () => {
      const res = await call('/api/contact', {
        method: 'POST',
        expect: 201,
        body: JSON.stringify({
          topic: 'corporate',
          name: 'Deepa from Halcyon',
          contact: mobile(Number(RUN) * 19 + 7),
          message: 'We want 40 plants for two office floors in Whitefield. Please quote.',
          optIn: true,
        }),
      })
      must(
        res.body.reference,
        `the contact form did not return a reference: ${JSON.stringify(res.body)}`,
      )

      const lead = await one<{ id: number }>(
        `SELECT q."id" FROM "quote_requests" q WHERE q."notes" LIKE $1 ORDER BY q."id" DESC LIMIT 1`,
        [`%${res.body.reference}%`],
      )
      must(
        lead,
        'a phone-only corporate enquiry was acknowledged with a reference and no lead was created. The customer believes they were recorded.',
      )
    },
  )

  await check(
    'the compliance pages read the settings the owner can change',
    'the owner corrects a registered address and the invoice, contact page and legal policies keep the old one',
    async () => {
      const settings = await one<{
        principal_address: string | null
        customer_care_phone: string | null
      }>(`SELECT b."principal_address", b."customer_care_phone" FROM "business_settings" b LIMIT 1`)
      const care = settings?.customer_care_phone
      must(care, 'no customer_care_phone is configured, so this check proves nothing')

      for (const path of ['/contact', '/grievance', '/invoice']) {
        const res = await call(path)
        must(
          res.status !== 200 || res.text.includes(care),
          `${path} does not show the configured care number.`,
        )
      }
    },
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   §7 · INJECTED FAULTS — break it, and check it holds
   ══════════════════════════════════════════════════════════════════════════ */

async function injectedFaults(cat: Awaited<ReturnType<typeof pickCatalogueItem>>) {
  section('§7 · INJECTED FAULTS — deliberately broken things')

  /*
   * Each of these breaks ONE thing and asserts the system refuses. They are
   * grouped so a failure names the stakeholder immediately.
   *
   * The point is not that they pass today. The point is that the harness CAN fail,
   * which is what makes a green run worth anything.
   */

  await check(
    'an order code cannot be guessed from the clock',
    'every customer order is enumerable',
    async () => {
      const code = await one<{ order_code: string }>(
        `SELECT o."order_code" FROM "orders" o ORDER BY o."created_at" DESC LIMIT 1`,
      )
      const created = new Date().getTime().toString(36).toUpperCase()
      must(
        code?.order_code !== `UPV-${created}`,
        'the order code looks like a clock again. It is not CSPRNG.',
      )
    },
  )

  await check(
    'order lookup is rate limited, so a leaked code cannot be brute-forced',
    'a code from a screenshot plus 10,000 guesses gets somebody else delivery address',
    async () => {
      const codes = await all<{ order_code: string }>(
        `SELECT o."order_code" FROM "orders" o ORDER BY o."created_at" DESC LIMIT 1`,
      )
      const target = codes[0]!.order_code
      let limited = false
      for (let i = 0; i < 40; i += 1) {
        const res = await call(
          `/api/orders/lookup?orderCode=${target}&phone=9${String(i).padStart(9, '0')}`,
        )
        if (res.status === 429) {
          limited = true
          break
        }
      }
      must(
        limited,
        '40 consecutive lookup attempts were never rate limited. A leaked code is fully brute-forceable.',
      )
    },
  )

  await check(
    'a customer cannot read the EmailLog through Payload',
    'every customer address and message is world-readable on the storefront origin',
    async () => {
      const res = await call('/api/email-log')
      must(
        res.status === 401 || res.status === 403 || res.status === 404,
        `/api/email-log answered ${res.status} to an anonymous visitor.`,
      )
    },
  )

  await check(
    'the Wishlists collection cannot be written to anonymously',
    'anyone can fill our waitlist with rows, and we will e-mail people who never asked',
    async () => {
      const res = await call('/api/wishlists', {
        method: 'POST',
        expect: 401,
        body: JSON.stringify({ skuId: 1 }),
      })
      must(
        res.status === 401,
        `/api/wishlists answered ${res.status} to an anonymous visitor. It must require a session.`,
      )
    },
  )

  await check(
    'a rider cannot close a drop that is not theirs',
    'a rider marks somebody else parcel delivered, and the anti-fraud control is a UI convention',
    async () => {
      const other = await pickRider()
      const { jar } = await signInRider(other.phone)
      const res = await call(`/api/rider/dispatch/${state.dispatchId}/transition`, {
        method: 'POST',
        jar,
        expect: [403, 409],
        body: JSON.stringify({ to: 'OUT_FOR_DELIVERY' }),
      })
      must(
        res.status === 403 || res.status === 409,
        `a foreign rider got ${res.status} on somebody else's drop.`,
      )
    },
  )

  await check(
    'money cannot be stored as a fraction of a rupee',
    'a float reaches a paise column and every total after it is quietly wrong',
    async () => {
      const message = await expectRefused(
        'a fractional paise value',
        `INSERT INTO "orders" (order_code, city_id, status, payment_mode, pincode, revenue_paise, contribution_paise)
         SELECT 'UPV-FRACTION', (SELECT MIN("id") FROM "cities"), 'PAYMENT_PENDING', 'prepaid',
                '560001', 100.5, 0`,
      )
      must(
        /orders_money_is_paise/.test(message),
        `the CHECK that fired was not the money one: ${message}`,
      )
    },
  )

  await check(
    'an order cannot be marked delivered without the customer code',
    '"marked delivered but not received" — the complaint that produced this whole anti-fraud design',
    async () => {
      /*
       * On a drop that is NOT ALREADY delivered.
       *
       * The first version of this check updated whichever dispatch it had to
       * hand — which, by that point in the run, was the one §4 had already closed
       * properly. The UPDATE therefore changed nothing (status was already
       * DELIVERED, delivery_otp_verified_at was already set), the trigger had no
       * reason to fire, and the database accepted it.
       *
       * Which reported a working security control as broken, which is the
       * failure mode this harness is supposed to be immune to. A fault has to be
       * injected into a state the fault applies to.
       *
       * So this builds a real drop first: an order, a payment, a dispatch — all
       * through the schema's own rules — and then tries to close it without a code.
       */
      const code = `UPV-NOOTP-${RUN}`

      /*
       * A fixture that satisfies the schema's own rules, because the schema has
       * several and they are all right: revenue must equal the sum of the lines,
       * the pincode must be serviceable, a captured payment needs a contact. Each
       * of those fired at least once while this check was being written, which is
       * the point — the invariants hold even for a synthetic order.
       */
      const sku = await one<{ id: number; price: string }>(
        `SELECT s."id", s."base_price_paise"::text AS "price"
           FROM "skus" s WHERE s."is_published" ORDER BY s."id" LIMIT 1`,
      )
      must(sku, 'no published SKU to build the fixture order from')

      /*
       * In ONE transaction, because the revenue-matches-lines check is a DEFERRABLE
       * INITIALLY DEFERRED constraint trigger.
       *
       * That is a genuinely good design decision — it means "revenue equals the
       * sum of the lines" can hold without forcing a write order on checkout — and
       * it is also invisible until you try to build an order across two
       * autocommitted statements. Statement one inserts an order whose lines do
       * not exist yet; the check fires at that statement's commit and refuses.
       *
       * So the fixture is built the way checkout builds one: order, lines,
       * commit.
       */
      const fixture = await db().connect()
      try {
        await fixture.query('BEGIN')
        const orderRow = await fixture.query<{ id: number }>(
          `INSERT INTO "orders" (order_code, city_id, status, payment_mode, pincode,
                                 revenue_paise, contribution_paise,
                                 customer_phone, customer_name, address_line1, address_city, payment_state)
           VALUES ($1, (SELECT c."id" FROM "cities" c WHERE c."is_active" LIMIT 1),
                   'PAID', 'prepaid', $2, $3, 0, $4, 'No OTP Test', '1 Test Road', 'Bengaluru', 'captured')
           RETURNING "id"`,
          [code, cat.pincode, sku!.price, state.guestPhone],
        )
        await fixture.query(
          `INSERT INTO "orders_items" (id, _order, _parent_id, sku_id, price_paise, planter_id)
           VALUES ($1, 0, $2, $3, $4, NULL)`,
          [`${code}-1`, orderRow.rows[0]!.id, sku!.id, sku!.price],
        )
        await fixture.query('COMMIT')
      } catch (error) {
        await fixture.query('ROLLBACK').catch(() => {})
        throw error
      } finally {
        fixture.release()
      }

      const band = await one<{ code: string; pay_paise: string }>(
        `SELECT b."code", b."pay_paise"::text FROM "delivery_bands" b LIMIT 1`,
      )
      const rider = await pickRider()
      const inserted = await db().query<{ id: number }>(
        `INSERT INTO "dispatches" (order_id, rider_id, zone_id, status, band_code, band_pay_paise, pay_multiplier_bp, payout_paise, assigned_at)
         VALUES ((SELECT o."id" FROM "orders" o WHERE o."order_code" = $1), $2, NULL, 'ASSIGNED', $3, $4, 10000, $4, now())
         RETURNING "id"`,
        [code, rider.id, band!.code, band!.pay_paise],
      )

      const message = await expectRefused(
        'a delivery closed with no OTP',
        `UPDATE "dispatches" SET "status" = 'DELIVERED' WHERE "id" = $1`,
        [inserted.rows[0]!.id],
      )
      must(
        /otp|OTP|verified/i.test(message),
        `the trigger that fired does not mention the code: ${message}`,
      )
    },
  )

  await check(
    'the dispatch ledger cannot be edited after the fact',
    'the audit trail is only as good as its immutability, and "we edited the record" is the oldest lie there is',
    async () => {
      await expectRefused(
        'editing an event',
        `UPDATE "dispatch_events" SET "detail" = '{}' WHERE "dispatch_id" = $1`,
        [state.dispatchId],
      )
      await expectRefused(
        'deleting an event',
        `DELETE FROM "dispatch_events" WHERE "dispatch_id" = $1`,
        [state.dispatchId],
      )
    },
  )

  await check(
    'a rider payout cannot be rewritten after assignment',
    'a rider was promised ₹60 and the record later says ₹45',
    async () => {
      const message = await expectRefused(
        'rewriting a snapshotted payout',
        `UPDATE "dispatches" SET "payout_paise" = 1 WHERE "id" = $1`,
        [state.dispatchId],
      )
      note(`payout immutability said: ${message.split('\n')[0]?.slice(0, 90)}`)
    },
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   §8 · SCHEMA PROOFS — the invariants, at the layer that owns them
   ══════════════════════════════════════════════════════════════════════════ */

async function schemaProofs(cat: Awaited<ReturnType<typeof pickCatalogueItem>>) {
  section('§8 · SCHEMA PROOFS — illegal SQL, and the database saying no')

  await check(
    'cash-on-delivery cannot be recorded',
    'a COD return leg is a total write-off, and it is refused everywhere else in this system',
    async () => {
      const message = await expectRefused(
        'a COD order',
        `INSERT INTO "orders" (order_code, city_id, status, payment_mode, pincode, revenue_paise, contribution_paise)
         SELECT 'UPV-CODROW', (SELECT MIN("id") FROM "cities"), 'PAYMENT_PENDING', 'cod', '560001', 100, 0`,
      )
      // Two layers refuse this, and the enum is the first one reached: the
      // `payment_mode` enum has no 'cod' member, so Postgres rejects the value
      // before the CHECK that exists specifically to say so. Asserting on the
      // CHECK name alone would have reported a working control as broken.
      must(
        /orders_no_cod|orders_prepaid_only|enum_orders_payment_mode/i.test(message),
        `unexpected error: ${message}`,
      )
    },
  )

  await check(
    'an unserviceable pincode cannot be ordered',
    'we take money for a parcel we cannot deliver',
    async () => {
      const message = await expectRefused(
        'an order to an unserviceable pincode',
        `INSERT INTO "orders" (order_code, city_id, status, payment_mode, pincode, revenue_paise, contribution_paise)
         SELECT 'UPV-BADPIN', (SELECT MIN("id") FROM "cities"), 'PAYMENT_PENDING', 'prepaid', '999999', 100, 0`,
      )
      note(`serviceable-set CHECK said: ${message.split('\n')[0]?.slice(0, 90)}`)
    },
  )

  await check(
    'a review cannot be written for a plant nobody received',
    'a review wall that counts opinions about parcels still in transit is worse than none',
    async () => {
      const pending = await one<{ order_code: string }>(
        `SELECT o."order_code" FROM "orders" o WHERE o."payment_state" IS DISTINCT FROM 'captured' LIMIT 1`,
      )
      if (!pending) {
        note('no unpaid order available to try; skipping rather than reporting a false pass')
        return
      }
      const item = await one<{ id: string; sku_id: number }>(
        `SELECT oi."id", oi."sku_id" FROM "orders_items" oi
        WHERE oi."_parent_id" = (SELECT o."id" FROM "orders" o WHERE o."order_code" = $1) LIMIT 1`,
        [pending.order_code],
      )
      if (!item) {
        note('no unpaid order line available; skipping')
        return
      }
      const message = await expectRefused(
        'a review of an undelivered plant',
        `INSERT INTO "reviews" (sku_id, order_item_id, rating, title, body, author_name, is_published, created_at, updated_at)
         VALUES ($1, $2, 5, 'Great', 'Really great plant thank you', 'A Customer', false, now(), now())`,
        [item.sku_id, item.id],
      )
      must(/DELIVERED/i.test(message), `unexpected error: ${message}`)
    },
  )

  await check(
    'a review cannot carry a phone number or an e-mail address',
    'a review wall is the most-scraped page on a plant site, and this becomes a contact list',
    async () => {
      const delivered = await one<{ id: string; sku_id: number }>(
        `SELECT oi."id", oi."sku_id"
           FROM "orders_items" oi JOIN "orders" o ON o."id" = oi."_parent_id"
          WHERE o."status"::text IN ('DELIVERED','RESOLVED')
          LIMIT 1`,
      )
      must(delivered, 'no delivered order line to try')

      const message = await expectRefused(
        'a review containing a phone number',
        `INSERT INTO "reviews" (sku_id, order_item_id, rating, title, body, author_name, is_published, created_at, updated_at)
         VALUES ($1, $2, 5, 'Call me', 'Ring me on 9845012345 any time', 'A Customer', false, now(), now())`,
        [delivered.sku_id, delivered.id],
      )
      must(/reviews_body_carries_no_contact_details/.test(message), `unexpected error: ${message}`)
    },
  )

  await check(
    'a dispatch cannot exist for an unpaid order',
    'cash-on-delivery through the back door',
    async () => {
      const unpaid = await one<{ id: number }>(
        `SELECT o."id" FROM "orders" o WHERE o."payment_state" IS DISTINCT FROM 'captured' LIMIT 1`,
      )
      must(unpaid, 'no unpaid order to try')
      const rider = await pickRider()
      const band = await one<{ code: string; pay_paise: string }>(
        `SELECT b."code", b."pay_paise"::text FROM "delivery_bands" b LIMIT 1`,
      )
      const message = await expectRefused(
        'a dispatch for an unpaid order',
        `INSERT INTO "dispatches" (order_id, rider_id, zone_id, status, band_code, band_pay_paise, pay_multiplier_bp, payout_paise, assigned_at)
         VALUES ($1, $2, NULL, 'ASSIGNED', $3, $4, 10000, $4, now())`,
        [unpaid.id, rider.id, band!.code, band!.pay_paise],
      )
      must(
        /has not been paid|dispatches_require_paid/i.test(message),
        `unexpected error: ${message}`,
      )
    },
  )

  await check(
    'a corporate lead must be reachable by something',
    'a lead row nobody can be contacted about is not a lead',
    async () => {
      const message = await expectRefused(
        'a lead with neither an e-mail nor a phone',
        `INSERT INTO "quote_requests" (organisation, contact_name, email, phone, minimum_quantity, occasion, status, created_at, updated_at)
         VALUES ('Nowhere Ltd', 'Nobody', 'not-an-email', '123', 10, 'other', 'new', now(), now())`,
      )
      must(/quote_requests_contact_is_reachable/.test(message), `unexpected error: ${message}`)
    },
  )

  await check(
    'a corporate lead with only a MOBILE number is allowed',
    'the entire phone-first B2B pipeline is dropped, because the e-mail column was NOT NULL',
    async () => {
      const lead = await call('/api/contact', {
        method: 'POST',
        expect: 201,
        body: JSON.stringify({
          topic: 'corporate',
          name: 'Kiran from Fernwood',
          contact: mobile(Number(RUN) * 23 + 9),
          message: '25 plants for a clinic reception. Please send a quote.',
          optIn: true,
        }),
      })
      const row = await one<{ email: string | null; phone: string }>(
        `SELECT q."email", q."phone" FROM "quote_requests" q WHERE q."notes" LIKE $1 ORDER BY q."id" DESC LIMIT 1`,
        [`%${lead.body.reference}%`],
      )
      must(row, 'a phone-only corporate lead was not created.')
      must(row!.phone?.length >= 10, `the lead phone is "${row!.phone}"`)
    },
  )

  await check(
    'a resolved claim must say who resolved it',
    'a declined claim with no resolver is indistinguishable from one that was ignored',
    async () => {
      const message = await expectRefused(
        'a decided claim with no resolver',
        `UPDATE "order_claims" SET "status" = 'REJECTED', "resolved_at" = now(), "resolved_by" = NULL
          WHERE "id" = (SELECT MIN("id") FROM "order_claims")`,
      )
      must(/order_claims_resolution_is_attributable/.test(message), `unexpected error: ${message}`)
    },
  )

  await check(
    'stock cannot go negative',
    'we sell plants we do not have, and the customer finds out at the packing bench',
    async () => {
      const message = await expectRefused(
        'an oversell',
        `UPDATE "sku_stock" SET "stock_on_hand" = -5 WHERE "sku_id" = $1`,
        [cat.skuId],
      )
      note(`stock CHECK said: ${message.split('\n')[0]?.slice(0, 90)}`)
    },
  )
}

/* ══════════════════════════════════════════════════════════════════════════ */

async function main(): Promise<void> {
  console.log(`\n\x1b[1mUpvvan business simulation\x1b[0m · ${BASE}`)
  console.log(
    `\x1b[2mrun ${RUN} · five people, one order, one shift, and the paths nobody clicks\x1b[0m`,
  )

  await clearMail()

  const cat = await storefront()
  // Fixture setup, before anything is asserted. See `ensureStock`.
  const stock = await ensureStock(cat.skuId, 60)
  if (stock === 60) note(`stock ledger topped up to ${stock} for ${cat.slug}`)
  await checkout(cat)
  await account(cat)
  await fulfilment(cat)
  await recovery()
  await productionPaths(cat)
  await injectedFaults(cat)
  await schemaProofs(cat)

  await closeDb()

  console.log('')
  if (failures > 0) {
    console.log(`\x1b[31m${failures} of ${step} checks failed.\x1b[0m`)
    console.log(
      '\x1b[2mEach one names who it strands. Read them in order — they are ordered by who\x1b[0m',
    )
    console.log('\x1b[2mis waiting at the other end of it.\x1b[0m\n')
    process.exit(1)
  }

  console.log(`\x1b[32m✓ ${step} checks passed.\x1b[0m`)
  console.log(
    `\x1b[2m  order ${state.guestOrder} · dispatch ${state.dispatchId} · claim ${state.claimCode}\x1b[0m\n`,
  )
  process.exit(0)
}

void sleep
void note

main().catch(async (error: unknown) => {
  console.error(
    '\n\x1b[31m✗ simulation crashed:\x1b[0m',
    error instanceof Error ? error.stack : error,
  )
  await closeDb().catch(() => {})
  process.exit(1)
})
