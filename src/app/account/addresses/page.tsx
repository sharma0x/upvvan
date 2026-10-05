import { pageMetadata } from '@/app/metadata'
import { listAddresses } from '@/lib/accounts/addresses'
import AddressBook from '@/components/auth/AddressBook'

/**
 * Saved addresses.
 *
 * The session check is inherited from `src/app/account/layout.tsx`, which wraps
 * every page in this segment. It is deliberately NOT repeated here — a guard
 * duplicated into each page is a guard that eventually gets edited in one place
 * and not the other.
 */
export const dynamic = 'force-dynamic'

export const metadata = pageMetadata(
  'Your addresses',
  'Save the addresses you want us to deliver to, and choose your default.',
  '/account/addresses',
)

export default async function AddressesPage() {
  const addresses = await listAddresses()

  return (
    <main>
      <h2 className="mt-0 mb-xs">Addresses</h2>
      <p className="text-ink-muted mt-0">
        Your rider calls this number on arrival. We deliver to serviceable
        pincodes only — check yours on the home page if you are unsure.
      </p>

      <AddressBook addresses={addresses} />
    </main>
  )
}