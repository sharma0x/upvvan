/**
 * Guarantee windows — one canonical number, read from the price book.
 *
 * ── WHY THIS MODULE EXISTS ───────────────────────────────────────────────────
 *
 * The audit's sharpest compliance finding about this category is that Ugaoo
 * ships **two live, contradictory guarantee policies** with no deprecation
 * notice: a 30-day plant guarantee on `/policies/refund-policy` and a 14-day
 * replacement window on `/pages/shipping-and-return-policy`, with a cached
 * homepage saying "Arrives alive 14-day guarantee". Their nav also links to four
 * pages that 404.
 *
 * That is what happens when the guarantee window is written into page copy
 * instead of read from configuration. This codebase had already started down
 * the same road — the string "48-hour" appeared in TrustRail, the PDP, the
 * claim flow and the policies page, hardcoded, while the authoritative value sat
 * in `price_books.active_guarantee_tier`, read by nothing.
 *
 * So: the tier lives in the database, this module turns a tier into a promise,
 * and every surface renders the promise from here. There is no string to drift.
 *
 * ── WHY THE TIERS ARE FLAGS AND NOT A DURATION ─────────────────────────────
 *
 * `T1` and `T2` are booleans in `price_books`, not "30 days" / "90 days"
 * columns. The duration is a property of the tier; the flag is a decision about
 * whether we are prepared to stand behind it. Shipping a 90-day promise before
 * we have a measured dead-on-arrival rate is how a guarantee becomes a cost
 * centre, and `orders_guarantee_tier_is_enabled()` in
 * 20261005_000007_launch_blockers.ts already refuses to write an order at a
 * disabled tier — so a page that rendered T2 while the schema refused T2 would
 * be a promise the database declines to honour.
 *
 * That is the whole reason this module is one function reading both.
 */
import 'server-only'

import { Pool } from 'pg'

import { getPool as sharedPool } from '@/lib/db/pool'

export type GuaranteeTier = 'T0' | 'T1' | 'T2'

export interface GuaranteeTerms {
  tier: GuaranteeTier
  /** Human label for the tier, e.g. "48-hour arrival guarantee". */
  label: string
  /** Whole days of cover from delivery. */
  days: number
  /** One sentence, stated identically everywhere it appears. */
  summary: string
  /**
   * The replacement remedy in one sentence. Plants are REPLACED, never
   * refunded — a returned plant is a total write-off, which is the whole reason
   * the business is prepaid-only.
   */
  remedy: string
  /** Hours within which a damaged or dead-on-arrival parcel must be reported. */
  arrivalWindowHours: number
}

const TERMS: Record<GuaranteeTier, Omit<GuaranteeTerms, 'tier'>> = {
  T0: {
    label: '48-hour arrival guarantee',
    days: 2,
    summary:
      'Damaged or dead on arrival, we replace it — you do not pay to send it back. Prepaid only, on purpose.',
    remedy:
      'If a plant arrives damaged or dead, send us a photo on WhatsApp within 48 hours of delivery and we send a replacement. You do not pay to ship anything back.',
    arrivalWindowHours: 48,
  },
  T1: {
    label: '30-day survival guarantee',
    days: 30,
    summary:
      'If it dies in the first 30 days, we replace it. Registered on your order automatically — there is nothing to sign up for.',
    remedy:
      'If a plant dies within 30 days of delivery, send us a photo on WhatsApp and we send a replacement. Registration is automatic on the order, so there is nothing to remember to do.',
    arrivalWindowHours: 48,
  },
  T2: {
    label: '90-day survival guarantee',
    days: 90,
    summary:
      'Ninety days, registered on your order automatically. If it dies inside the window we replace it, and we do not ask you to send anything back.',
    remedy:
      'If a plant dies within 90 days of delivery, send us a photo on WhatsApp and we send a replacement. Registration is automatic on the order.',
    arrivalWindowHours: 48,
  },
}

export function guaranteeTerms(tier: string): GuaranteeTerms {
  const known = tier in TERMS ? (tier as GuaranteeTier) : 'T0'
  return { tier: known, ...TERMS[known] }
}

/** The tiers a city may actually sell, given its price book. */
export interface PriceBookTerms {
  terms: GuaranteeTerms
  /** Free delivery threshold in paise. 0 means always free. */
  freeDeliveryThresholdPaise: number
  deliveryFeePaise: number
  /** The heat-window wording this city uses to exclude tender species. */
  heatWindowExclusionWording: string | null
  /** Planter uplift floor/ceiling for this city, in basis points. */
  planterLadderMinUpliftBp: number
  planterLadderMaxUpliftBp: number
}

/*
 * Delegates to the ONE process-wide pool.
 *
 * There were nine module-level pools in this codebase — this one was `max: 20`,
 * and `catalogue/loader.server.ts` was another `max: 20`, which is 40 connections
 * from two modules before anything else loads. `next build` prerenders dozens of
 * routes in parallel and died with
 *
 *     error: sorry, too many clients already
 *     Error occurred prerendering page "/collections/plants-for-a-bright-room"
 *
 * A pool exists to REUSE connections. Nine pools reusing the same handful is not
 * reuse; it is nine warm-up costs and nine places for a leak to hide. See
 * `src/lib/db/pool.ts`.
 *
 * Kept as a thin wrapper rather than replaced at every call site: the callers are
 * correct, and rewriting working call sites during an incident is how an incident
 * becomes an outage.
 */
function getPool(): Pool {
  return sharedPool()
}

/**
 * The guarantee and delivery terms a city sells under.
 *
 * Defaults to T0 on ANY failure — a missing price book, a down database, an
 * unmigrated column. That direction is deliberate and it is the opposite of
 * what the rest of this codebase does.
 *
 * Everywhere else, a read failure is escalated loudly: the PDP does not turn a
 * query error into a 404, `assertConfigValid` refuses to boot without
 * compliance keys. Here, escalating would be worse than the fallback. A
 * database blip must not take the storefront down, and the safe direction is
 * the SHORT window: promising 90 days because we could not read the price book
 * would turn a connectivity problem into a liability. T0 is the promise we can
 * always keep.
 *
 * The failure is still logged, because a silent fallback that is never noticed
 * is a fallback that becomes permanent.
 */
export async function loadPriceBookTerms(cityId: number): Promise<PriceBookTerms> {
  const defaults: PriceBookTerms = {
    terms: guaranteeTerms('T0'),
    freeDeliveryThresholdPaise: 0,
    deliveryFeePaise: 0,
    heatWindowExclusionWording: null,
    planterLadderMinUpliftBp: 0,
    planterLadderMaxUpliftBp: 12_100,
  }

  try {
    const { rows } = await getPool().query<{
      active_guarantee_tier: string
      guarantee_t1_enabled: boolean | null
      guarantee_t2_enabled: boolean | null
      free_delivery_threshold_paise: string | null
      delivery_fee_paise: string | null
      heat_window_exclusion_wording: string | null
      planter_ladder_min_uplift_bp: string | null
      planter_ladder_max_uplift_bp: string | null
    }>(
      `SELECT "active_guarantee_tier",
              "guarantee_t1_enabled",
              "guarantee_t2_enabled",
              "free_delivery_threshold_paise",
              "delivery_fee_paise",
              "heat_window_exclusion_wording",
              "planter_ladder_min_uplift_bp",
              "planter_ladder_max_uplift_bp"
         FROM "price_books"
        WHERE "city_id" = $1
        LIMIT 1`,
      [cityId],
    )

    const row = rows[0]
    if (!row) return defaults

    // The flags gate the tiers. A city whose book says T2 but has T2 disabled
    // is selling T2 — the same mismatch `orders_guarantee_tier_is_enabled`
    // refuses at write time, reproduced here so the PAGE cannot make a promise
    // the SCHEMA would decline.
    let tier = row.active_guarantee_tier as GuaranteeTier
    if (tier === 'T1' && !row.guarantee_t1_enabled) tier = 'T0'
    if (tier === 'T2' && !row.guarantee_t2_enabled) tier = 'T0'

    return {
      terms: guaranteeTerms(tier),
      freeDeliveryThresholdPaise: intOr(row.free_delivery_threshold_paise, 0),
      deliveryFeePaise: intOr(row.delivery_fee_paise, 0),
      heatWindowExclusionWording: row.heat_window_exclusion_wording,
      planterLadderMinUpliftBp: intOr(row.planter_ladder_min_uplift_bp, 0),
      planterLadderMaxUpliftBp: intOr(row.planter_ladder_max_uplift_bp, 12_100),
    }
  } catch (err) {
    console.error(
      '[guarantee] falling back to T0 guarantee terms — the page will promise less than the price book allows, which is the safe direction:',
      err instanceof Error ? err.message : err,
    )
    return defaults
  }
}

function intOr(value: string | null, fallback: number): number {
  if (value == null || value.trim() === '') return fallback
  const n = Number(value)
  if (!Number.isFinite(n) || !Number.isInteger(n)) return fallback
  return n
}

/**
 * "48 hours" / "30 days" — the window, phrased the way a person would say it.
 *
 * Kept here rather than inlined at each call site because the audit's failure
 * mode was precisely a window spelled three different ways on three pages.
 */
export function formatWindow(days: number): string {
  if (days % 7 === 0 && days >= 7) {
    const weeks = days / 7
    return `${weeks} day${weeks === 1 ? '' : 's'}`
  }
  if (days === 1) return '24 hours'
  return `${days} days`
}

/** "Report within 48 hours of delivery." — the deadline sentence. */
export function claimDeadlineSentence(terms: GuaranteeTerms): string {
  return `Report within ${terms.arrivalWindowHours} hours of delivery.`
}
