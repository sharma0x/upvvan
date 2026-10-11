import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * A dispatch may only exist for a PAID order.
 *
 * ── THE BUG ─────────────────────────────────────────────────────────────────
 *
 * The assign queue lists orders with no dispatch, filtering on status alone:
 *
 *     AND o.status NOT IN ('DELIVERED','RESOLVED','CANCELLED','CLAIM_REJECTED')
 *
 * `PAYMENT_PENDING` is not in that list, so an order whose money has NEVER been
 * taken appeared in the queue with a working Assign button. Verified in a browser:
 *
 *     POST /api/dispatch/assign { orderCode: 'UPV--LVN2OGU', distanceKm: 4 }
 *     200 { ok: true, dispatchId: 561, riderName: 'Asha', payoutPaise: 6000 }
 *
 * So a rider can be dispatched to deliver a plant that has not been paid for, and
 * the dispatch snapshot pays them ₹60 for doing it. That is the business model
 * working against itself in three ways at once:
 *
 *   · The plant leaves the nursery unpaid. A COD-return leg is already refused
 *     everywhere — `orders_no_cod` — so this is the back door to COD, dressed as
 *     an ops convenience.
 *   · The rider's pay is snapshotted and owed for a delivery that should not be
 *     happening.
 *   · The order's own timeline will show a rider en route to a customer who never
 *     paid, which is the exact complaint shape this project exists to prevent.
 *
 * ── WHY THIS IS A TRIGGER AND NOT A CHECK ───────────────────────────────────
 *
 * A CHECK can only see columns of its own row. `dispatches` carries `order_id`,
 * and "that order has been paid" lives in `orders.payment_state`. The rule spans
 * two tables, so it is a trigger — which also means it holds for a direct
 * `INSERT` from `psql`, a script, or a future service, not only for the route
 * that happens to check today.
 *
 * This is the project's own rule: a business invariant enforced in application
 * code is bypassable, and therefore is not an invariant.
 *
 * ── WHY IT IS NOT `AFTER` ───────────────────────────────────────────────────
 *
 * BEFORE, so the row never exists. An AFTER trigger would have to undo the insert
 * to refuse it, which leaves a window and a sequence gap for a write that should
 * never have happened.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION dispatches_require_paid_order() RETURNS trigger AS $$
    DECLARE
      order_payment_state text;
      order_code text;
    BEGIN
      SELECT o."payment_state"::text, o."order_code"
        INTO order_payment_state, order_code
        FROM "orders" o
       WHERE o."id" = NEW."order_id";

      /*
       * "The order does not exist" and "the order exists and is unpaid" both leave
       * order_payment_state NULL, and they need OPPOSITE answers.
       *
       * payment_state has no column default, so NULL on a real row means "payment
       * was never captured" -- the case this trigger exists to refuse. The first
       * version tested order_payment_state IS NULL and returned early, which waved
       * through precisely the worst case: an order created without a payment_state
       * could be dispatched with no objection whatsoever, which is what every
       * pre-existing order row looks like.
       *
       * order_code is NOT NULL on orders, so it is the reliable tell for "no such
       * row". That case is a different problem, and the foreign key reports it
       * better than this function would, so the FK gets to speak.
       *
       * (No backticks in this comment: it lives inside a JS template literal,
       * where one silently ends the string.)
       */
      IF order_code IS NULL THEN
        RETURN NEW;
      END IF;

      IF order_payment_state IS DISTINCT FROM 'captured' THEN
        RAISE EXCEPTION
          'Order % is % and has not been paid. A rider cannot be dispatched for unpaid goods — dispatch it only after payment is captured.',
          order_code, order_payment_state
          USING ERRCODE = 'check_violation';
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'dispatches_require_paid_order_trg'
      ) THEN
        CREATE TRIGGER "dispatches_require_paid_order_trg"
          BEFORE INSERT ON "dispatches"
          FOR EACH ROW
          EXECUTE FUNCTION dispatches_require_paid_order();
      END IF;
    END $$;
  `)

  /*
   * ── EXISTING ROWS ──────────────────────────────────────────────────────────
   *
   * A trigger that only guards the future leaves whatever is already wrong in
   * place. So the migration refuses to run while an unpaid order has a rider
   * holding its goods.
   *
   * It counts only NON-TERMINAL dispatches — ASSIGNED, PICKED_UP,
   * OUT_FOR_DELIVERY — and that scoping is the whole design:
   *
   *   · Those are the rows that mean "a person is currently carrying unpaid
   *     plants", which is the harm. They are resolvable: cancel the dispatch, and
   *     the order with it.
   *
   *   · A DELIVERED, CANCELLED or FAILED dispatch on an unpaid order is
   *     HISTORY. It cannot recur, the goods are gone or returned, and there is
   *     nothing to stop. Blocking a migration on those would mean either deleting
   *     an append-only event log to satisfy a constraint — destroying the
   *     delivery history this schema exists to preserve — or refusing to migrate
   *     forever because of a row that is inert.
   *
   * Refusing rather than auto-fixing, because the fix is a business decision: was
   * that parcel delivered and never paid for (recover the money), or was it a
   * test artefact? A migration does not get to guess, and the append-only trigger
   * makes a silent correction impossible anyway.
   */
  const inFlight = await db.execute(sql`
    SELECT o."order_code", d."status"
      FROM "dispatches" d
      JOIN "orders" o ON o."id" = d."order_id"
     WHERE o."payment_state" IS DISTINCT FROM 'captured'
       AND d."status" IN ('ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY')
  `)

  const rows = (inFlight as unknown as { rows?: Array<{ order_code: string; status: string }> })
    .rows
  if (rows && rows.length > 0) {
    throw new Error(
      `Refusing to migrate: ${rows.length} UNPAID order(s) currently have a rider holding the goods ` +
        `(${rows.map((r) => `${r.order_code} is ${r.status}`).join('; ')}).\n` +
        `Cancel the dispatch for each, or capture the payment, then re-run.\n` +
        `A dispatch for an unpaid order is the back door to cash-on-delivery, which this ` +
        `business refuses everywhere else — see the CHECK on orders.payment_mode.`,
    )
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TRIGGER IF EXISTS "dispatches_require_paid_order_trg" ON "dispatches";`)
  await db.execute(sql`DROP FUNCTION IF EXISTS dispatches_require_paid_order();`)
}
