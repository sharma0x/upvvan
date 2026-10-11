import type { PoolClient } from 'pg'

/**
 * Stock decrement — the oversell guard.
 *
 * ── THE ONE INVARIANT ───────────────────────────────────────────────────────
 *
 * `stock_on_hand` must never go below zero. A negative stock count is not a
 * rounding nuisance: it is a promise to a customer who has already paid for a
 * plant that is not on the bench, and the failure lands two days later at a
 * rider's door where it cannot be fixed.
 *
 * ── WHY THE CHECK IS IN SQL, NOT HERE ───────────────────────────────────────
 *
 * AGENTS.md is explicit that application-code enforcement is a fail, because it
 * is bypassable by a direct write or a second code path. The function below reads
 * the row and decides in JavaScript; that decision is a UX improvement (it can say
 * WHICH plant ran out), not the guarantee. The guarantee is the
 * `sku-stock_no_negative` CHECK on the column plus the conditional UPDATE below —
 * both of which a raw `UPDATE sku_stock SET stock_on_hand = stock_on_hand - 1`
 * from psql cannot get past.
 *
 * ── WHY `UPDATE … WHERE stock_on_hand >= $n` AND NOT READ-THEN-WRITE ─────────
 *
 * The read-then-write version is the classic lost update:
 *
 *   BEGIN
 *     SELECT stock_on_hand FROM sku_stock WHERE sku_id = 1;   -- both read 3
 *     UPDATE sku_stock SET stock_on_hand = 2 WHERE sku_id = 1;
 *     UPDATE sku_stock SET stock_on_hand = 2 WHERE sku_id = 1; -- both write 2
 *   COMMIT
 *
 * Two customers, one plant, and the ledger says 2 when it should say 1. The
 * conditional UPDATE makes the guard part of the write itself: the row is locked
 * and re-checked by Postgres in the same statement, so of the two racing
 * transactions exactly one sees `3 >= 2` and the other sees `0 >= 1` and matches
 * no rows. Zero rows affected IS the oversell signal, and it cannot be
 * distinguished from "row missing" without a follow-up read — which is why
 * `ensureStockRow` is called first.
 */
export interface StockLine {
  skuId: string
  /** Whole units. Validated as an integer before it reaches SQL. */
  qty: number
}

export class OversellError extends Error {
  constructor(
    readonly skuId: string,
    readonly requested: number,
    /** Null when the SKU has no ledger row at all, which is a data fault not an oversell. */
    readonly available: number | null,
  ) {
    super(
      available === null
        ? `SKU ${skuId} has no stock ledger row, so it cannot be sold. Creating an order against it would make the oversell undetectable.`
        : `SKU ${skuId} has ${available} unit(s) on hand and ${requested} were requested.`,
    )
    this.name = 'OversellError'
  }

  /** Customer-facing wording. This sentence IS the copy — see the error contract in AGENTS.md. */
  get customerMessage(): string {
    return this.available === null
      ? 'An item in your cart is not available right now.'
      : 'An item in your cart has sold out while you were checking out.'
  }
}

/**
 * Create the ledger row for a SKU if it is missing.
 *
 * Called inside the order transaction BEFORE the decrement, so that a missing row
 * and a genuine zero are distinguishable: a missing row means the seed is wrong
 * (and says so), while a row reading 0 means we genuinely sold out.
 *
 * `INSERT … ON CONFLICT DO NOTHING` rather than an upsert that sets a value —
 * re-seeding stock must never resurrect stock that a sale legitimately consumed.
 */
export async function ensureStockRow(
  client: PoolClient,
  skuId: string,
  initial = 0,
): Promise<void> {
  await client.query(
    `INSERT INTO "sku_stock" ("sku_id", "stock_on_hand", "updated_at", "created_at")
     VALUES ($1, $2, now(), now())
     ON CONFLICT ("sku_id") DO NOTHING`,
    [skuId, initial],
  )
}

/**
 * Decrement one line, refusing to go negative.
 *
 * MUST be called with a client already inside a transaction. The reason is not
 * tidiness: the order row and the stock decrement have to commit together. If the
 * order insert fails for any reason — an unserviceable pincode, a licence gate, a
 * revenue-matches-lines trigger — the decrement must roll back with it, or we have
 * sold a plant that was never ordered.
 */
export async function decrementStock(client: PoolClient, line: StockLine): Promise<void> {
  if (!Number.isInteger(line.qty) || line.qty < 1) {
    throw new Error(`Quantity must be a whole positive number of units, received ${line.qty}.`)
  }

  const existing = await client.query<{ stock_on_hand: number }>(
    `SELECT "stock_on_hand" FROM "sku_stock" WHERE "sku_id" = $1`,
    [line.skuId],
  )

  const row = existing.rows[0]
  if (!row) throw new OversellError(line.skuId, line.qty, null)

  const updated = await client.query(
    `UPDATE "sku_stock"
        SET "stock_on_hand" = "stock_on_hand" - $2,
            "updated_at" = now()
      WHERE "sku_id" = $1
        AND "stock_on_hand" >= $2
      RETURNING "stock_on_hand"`,
    [line.skuId, line.qty],
  )

  // Zero rows = another transaction took the last unit between our read and our
  // write, OR the count was already below the request. Either way we do not sell.
  if (updated.rowCount === 0) {
    const now = await client.query<{ stock_on_hand: number }>(
      `SELECT "stock_on_hand" FROM "sku_stock" WHERE "sku_id" = $1`,
      [line.skuId],
    )
    throw new OversellError(line.skuId, line.qty, now.rows[0]?.stock_on_hand ?? 0)
  }
}

/**
 * Return stock when an order is cancelled before dispatch.
 *
 * Called from the same transaction as the status transition to CANCELLED, for the
 * same reason: a cancelled order whose stock is not returned is a plant that
 * exists, is sellable, and is not on any ledger.
 *
 * Deliberately un-capped. If someone cancels and the row was concurrently topped
 * up by a stock count, the two are independent facts about different things and
 * adding them is correct.
 */
export async function returnStock(client: PoolClient, skuId: string, qty: number): Promise<void> {
  if (!Number.isInteger(qty) || qty < 1) {
    throw new Error(`Quantity to return must be a whole positive number, received ${qty}.`)
  }
  const res = await client.query(
    `UPDATE "sku_stock"
        SET "stock_on_hand" = "stock_on_hand" + $2,
            "updated_at" = now()
      WHERE "sku_id" = $1`,
    [skuId, qty],
  )
  if (res.rowCount === 0) {
    // Cancelling must not be blocked by a bookkeeping gap: the order is being
    // cancelled either way, and refusing here would leave a customer unable to
    // cancel because of our data hygiene.
    console.error(`[stock] cannot return ${qty} of SKU ${skuId} — no ledger row exists`)
  }
}
