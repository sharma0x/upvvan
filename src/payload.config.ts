import path from 'path'
import { fileURLToPath } from 'url'
import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'

import { config } from '@/lib/config'
import { Cities } from '@/collections/Cities'
import { Users } from '@/collections/Users'
import { Zones } from '@/collections/Zones'
import { DeliveryBands } from '@/collections/DeliveryBands'
import { Pincodes } from '@/collections/Pincodes'
import { PriceBooks } from '@/collections/PriceBooks'
import { Planters } from '@/collections/Planters'
import { Skus } from '@/collections/Skus'
import { SkuStock } from '@/collections/SkuStock'
import { Species } from '@/collections/Species'
import { SupplierBatches } from '@/collections/SupplierBatches'
import { Orders } from '@/collections/Orders'
import { Reviews } from '@/collections/Reviews'
import { Posts } from '@/collections/Posts'
import { Wishlists } from '@/collections/Wishlists'
import { QuoteRequests } from '@/collections/QuoteRequests'
import { ContactMessages } from '@/collections/ContactMessages'
import { BusinessSettings } from '@/collections/BusinessSettings'
import { EmailLog } from '@/collections/EmailLog'
import { Riders } from '@/collections/Riders'
import { Dispatches } from '@/collections/Dispatches'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

/**
 * Object storage is enabled only when a bucket is configured, so the app boots in
 * environments that do not need it (a bare test run, a CI job that only
 * typechecks). Whether storage is on is configuration, not a code change.
 *
 * RustFS in dev, S3 or R2 in production — the app reaches storage only through
 * these config values, never by image name, which is why swapping MinIO for
 * RustFS in infra/dev-services.yml needed no application change.
 */
const storageEnabled = Boolean(config.storage.endpoint && config.storage.bucket)

export default buildConfig({
  admin: {
    user: Users.slug,
    components: {
      /*
       * Puts the delivery desk one click away.
       *
       * The ops console is a SEPARATE app (`/admin-ops`) because it is built
       * around zones, distance bands and a day's work rather than around records.
       * But nothing pointed at it, so the person who signed in to manage the shop
       * had no way to find the thing that dispatches the shop's orders — and asked
       * where to navigate. The answer should not require prior knowledge.
       */
      /*
       * BY PATH, not by import — see the note at the top of that component.
       *
       * The path uses the `@/` alias rather than being rooted at the project
       * directory, because that is the form the import map records. An absolute
       * `/src/...` path type-checks perfectly and then fails at runtime with
       * "Module not found: Can't resolve '../../../src/components/…'" — the
       * import map resolves relative to itself, not to the repository root.
       *
       * Requires `make generate-importmap` after adding or renaming the file.
       */
      afterNavLinks: ['@/components/admin/OpsConsoleLinks'],
    },
    // MUST be plain JS at this exact path — src/app/(payload)/admin/importMap.js.
    // Not TypeScript, and not at (payload)/importMap.js. Getting this wrong
    // costs hours.
    importMap: { baseDir: path.resolve(dirname) },
  },
  collections: [
    Users,
    Cities,
    Zones,
    DeliveryBands,
    Pincodes,
    PriceBooks,
    Species,
    Planters,
    SupplierBatches,
    Skus,
    SkuStock,
    Orders,

    /*
     * Trust and acquisition. `Reviews` MUST be registered before anything that
     * references it, and `Posts` before `Posts.relatedSpecies` — same rule as
     * `Riders`/`Dispatches` below: Payload resolves `relationTo` against the
     * REGISTERED collection set at boot, and with an unregistered target the
     * build fails at typecheck before it reaches the database.
     */
    Reviews,
    Posts,
    Wishlists,
    QuoteRequests,
    ContactMessages,
    // First in the list on purpose: it is the one screen a non-technical owner
    // has to open, and Payload lists collections in declaration order.
    BusinessSettings,
    EmailLog,

    /*
     * Dispatch. `Riders` MUST be registered before `Dispatches` references it —
     * `Dispatches.rider` is a `relationTo: 'riders'`, and Payload resolves
     * relationship targets against the REGISTERED collection set at boot, not
     * against the filesystem. With `riders` unregistered the config does not
     * merely warn: `generate: true` types `relationTo` as `CollectionSlug`, so
     * TypeScript rejects the literal outright (TS2820) and the build fails before
     * it ever reaches the database.
     */
    Riders,
    Dispatches,
  ],
  secret: config.payload.secret,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: { connectionString: config.database.url },

    // C-3: migrations only. Never `push: true`.
    //
    // All DDL — the generated collection tables AND our hand-written
    // business-invariant triggers and CHECK constraints — is applied by ONE
    // runner from src/migrations/. That single DDL history is the deciding
    // factor in the stack choice: see STACK-DECISION.md §3.
    //
    // It goes INSIDE postgresAdapter(), not alongside it. Spreading the adapter
    // and adding `push` at the `db:` level is a type error: `push` is an adapter
    // argument, not a property of the adapter result.
    push: false,
  }),
  editor: lexicalEditor(),
  // SMTP settings go in `transportOptions` (nodemailer's own options shape), not
  // as top-level smtpHost/smtpPort keys — those are not part of the adapter's
  // args and TypeScript rejects them.
  //
  // `defaultFromAddress`/`defaultFromName` are required; without them the adapter
  // falls back to an ethereal.email test account, which would silently swallow
  // real order-status and claim emails in production.
  email: nodemailerAdapter({
    defaultFromAddress: config.email.from,
    defaultFromName: config.email.fromName,
    transportOptions: {
      host: config.email.host,
      port: config.email.port,
      ...(config.email.user && config.email.password
        ? {
            auth: {
              user: config.email.user,
              pass: config.email.password,
            },
          }
        : {}),
    },
  }),
  plugins: storageEnabled
    ? [
        s3Storage({
          collections: { media: true },
          bucket: config.storage.bucket,
          config: {
            endpoint: config.storage.endpoint,
            region: config.storage.region,
            forcePathStyle: true,
            credentials: {
              accessKeyId: config.storage.accessKeyId,
              secretAccessKey: config.storage.secretAccessKey,
            },
          },
        }),
      ]
    : [],
})
