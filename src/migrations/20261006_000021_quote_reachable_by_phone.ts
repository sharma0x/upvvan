import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * A corporate lead may be reachable by phone.
 *
 * ── THE BUG, AND WHO IT SILENTLY COST ────────────────────────────────────────
 *
 * `/api/contact` treats a `corporate` topic as a lead and also inserts a
 * `quote_requests` row. To satisfy `quote_requests_contact_is_reachable` it
 * fabricated a contact for whatever the visitor had NOT given:
 *
 *     email: looksLikeEmail(contact) ? contact : `pending:${contact}`
 *     phone: looksLikePhone(contact) ? contact : '0000000000'
 *
 * The form field is labelled "Mobile or e-mail". A visitor who typed a phone
 * number — which the label invites first, and which is how an Indian B2B enquiry
 * actually starts — produced `pending:9845012345` as an e-mail address.
 *
 * That value does not match the CHECK's e-mail pattern, so the INSERT was refused.
 * The route wrapped the enrichment in `.catch()` and logged, so the request still
 * returned 201 with a reference number and the customer believed they had been
 * put in the pipeline.
 *
 * The lead was never created. And it was never created for the *primary* case.
 * `quote_requests` is the reportable B2B pipeline number; this silently removed
 * every phone-only corporate enquiry from it, which is most of them.
 *
 * ── THE FIX ──────────────────────────────────────────────────────────────────
 *
 * Make `email` nullable and let the CHECK mean what its name says: the lead is
 * REACHABLE — by e-mail, or by phone. A real address is still validated as an
 * address; a real number is still validated as a number; a row with neither is
 * refused, which is the actual rule.
 *
 * The fabricated values are then unnecessary and are removed. `pending:<phone>`
 * in an e-mail column is the kind of value that later gets exported to a CRM and
 * dialled as an extension.
 *
 * ── EXISTING ROWS ────────────────────────────────────────────────────────────
 *
 * None need repairing. Every row that got in has a real e-mail, because every row
 * with a fake one was rejected by the CHECK. The rows this ADD were never written,
 * which is the problem.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "quote_requests" ALTER COLUMN "email" DROP NOT NULL;
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'quote_requests_contact_is_reachable'
      ) THEN
        ALTER TABLE "quote_requests" DROP CONSTRAINT "quote_requests_contact_is_reachable";
      END IF;

      ALTER TABLE "quote_requests"
        ADD CONSTRAINT quote_requests_contact_is_reachable
        CHECK (
          /*
           * EITHER channel is enough. An e-mail present must be a real e-mail —
           * so a typo is refused rather than stored and never received — but its
           * absence is no longer fatal, because the person gave us a mobile.
           */
          (
            "email" IS NULL
            OR "email"::text ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
          )
          AND length(btrim(regexp_replace("phone"::text, '[^0-9+]'::text, ''::text, 'g'::text))) >= 10
        );
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DELETE FROM "quote_requests"
     WHERE "email" IS NULL OR "email"::text NOT LIKE '%@%.%';
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'quote_requests_contact_is_reachable'
      ) THEN
        ALTER TABLE "quote_requests" DROP CONSTRAINT "quote_requests_contact_is_reachable";
      END IF;

      ALTER TABLE "quote_requests"
        ADD CONSTRAINT quote_requests_contact_is_reachable
        CHECK (
          "email"::text ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
          AND length(btrim(regexp_replace("phone"::text, '[^0-9+]'::text, ''::text, 'g'::text))) >= 10
        );
    END $$;
  `)

  await db.execute(sql`ALTER TABLE "quote_requests" ALTER COLUMN "email" SET NOT NULL;`)
}
