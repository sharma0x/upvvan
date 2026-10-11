/**
 * Copy the `.env` compliance values into `business_settings`, once.
 *
 * ── WHY A SEED AND NOT A MIGRATION ──────────────────────────────────────────
 *
 * DDL in migrations, DATA in seeds. Migration 000015 creates the table and a
 * defaults-only row; it does not read the environment, because interpolating
 * values into a file that lives in version control forever is wrong, and because
 * a migration that rewrites these columns would overwrite the owner's edits on
 * every future deploy — which is the one thing this table exists to prevent.
 *
 * ── WHY IT IS SAFE TO RE-RUN ────────────────────────────────────────────────
 *
 * `COALESCE(existing, env)` in both directions:
 *
 *   · a field already set IN THE PANEL is left alone — this is the important
 *     half, and it is why `make seed` can sit in an onboarding script without
 *     anyone being afraid of it;
 *   · a field still blank is filled from env, so a fresh clone becomes compliant
 *     without a human having to open the panel and retype what is already
 *     configured.
 *
 * So the seed can only ever ADD information. It can never remove a correction.
 *
 * ── HOW TO OVERRIDE AN ENV VALUE ON PURPOSE ─────────────────────────────────
 *
 * Edit it in the admin panel. That is the whole point. If the environment says
 * `hello@old-domain.com` and you have moved to `care@new-domain.com`, you change
 * it once in Settings and this script will never touch it again.
 */
import { Pool } from 'pg'

const required = (name: string): string => {
  const value = process.env[name]
  if (!value || value.trim() === '') {
    throw new Error(
      `${name} is not set. Copy .env.example to .env, or fill it in — these are the ` +
        `statutory disclosures and the site will not boot without them.`,
    )
  }
  return value
}

const pool = new Pool({ connectionString: required('DATABASE_URL') })

async function main(): Promise<void> {
  const env = {
    trading_name: process.env.EMAIL_FROM_NAME ?? 'Upvvan',
    legal_entity_name: required('LEGAL_ENTITY_NAME'),
    principal_address: required('PRINCIPAL_ADDRESS'),
    customer_care_email: required('CUSTOMER_CARE_EMAIL'),
    customer_care_phone: required('CUSTOMER_CARE_PHONE'),
    grievance_officer_name: required('GRIEVANCE_OFFICER_NAME'),
    grievance_officer_designation: required('GRIEVANCE_OFFICER_DESIGNATION'),
    grievance_officer_email: required('GRIEVANCE_OFFICER_EMAIL'),
    grievance_officer_phone: required('GRIEVANCE_OFFICER_PHONE'),
  }

  const { rows } = await pool.query<{ id: number }>(
    'SELECT id FROM business_settings ORDER BY id LIMIT 1',
  )
  const id = rows[0]?.id ?? null

  if (id === null) {
    await pool.query(
      `INSERT INTO business_settings
         (trading_name, legal_entity_name, principal_address, customer_care_email,
          customer_care_phone, grievance_officer_name, grievance_officer_designation,
          grievance_officer_email, grievance_officer_phone, gst_rate_bp,
          created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now(), now())`,
      [
        env.trading_name,
        env.legal_entity_name,
        env.principal_address,
        env.customer_care_email,
        env.customer_care_phone,
        env.grievance_officer_name,
        env.grievance_officer_designation,
        env.grievance_officer_email,
        env.grievance_officer_phone,
        Number(process.env.DEFAULT_TAX_RATE_BP ?? 1800),
      ],
    )
    console.log('✓ business_settings row created from .env')
    return
  }

  // COALESCE(current, incoming) — the panel always wins.
  const { rowCount } = await pool.query(
    `UPDATE business_settings SET
       trading_name                = COALESCE(NULLIF(btrim(trading_name), ''), $2),
       legal_entity_name           = COALESCE(NULLIF(btrim(legal_entity_name), ''), $3),
       principal_address           = COALESCE(NULLIF(btrim(principal_address), ''), $4),
       customer_care_email         = COALESCE(NULLIF(btrim(customer_care_email), ''), $5),
       customer_care_phone         = COALESCE(NULLIF(btrim(customer_care_phone), ''), $6),
       grievance_officer_name      = COALESCE(NULLIF(btrim(grievance_officer_name), ''), $7),
       grievance_officer_designation = COALESCE(NULLIF(btrim(grievance_officer_designation), ''), $8),
       grievance_officer_email     = COALESCE(NULLIF(btrim(grievance_officer_email), ''), $9),
       grievance_officer_phone     = COALESCE(NULLIF(btrim(grievance_officer_phone), ''), $10),
       gst_rate_bp                 = COALESCE(gst_rate_bp, $11),
       updated_at                  = now()
     WHERE id = $1`,
    [
      id,
      env.trading_name,
      env.legal_entity_name,
      env.principal_address,
      env.customer_care_email,
      env.customer_care_phone,
      env.grievance_officer_name,
      env.grievance_officer_designation,
      env.grievance_officer_email,
      env.grievance_officer_phone,
      Number(process.env.DEFAULT_TAX_RATE_BP ?? 1800),
    ],
  )

  console.log(
    rowCount === 1
      ? '✓ business_settings filled from .env (existing panel values kept)'
      : '! business_settings untouched',
  )
}

main()
  .then(() => pool.end())
  .catch(async (error) => {
    console.error(error.message)
    await pool.end()
    process.exit(1)
  })
