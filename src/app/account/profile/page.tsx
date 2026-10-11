import { pageMetadata } from '@/app/metadata'
import { loadProfile } from '@/lib/accounts/profile'
import ProfileForm from '@/components/auth/ProfileForm'

/**
 * `/account/profile` — who you are.
 *
 * The session check is inherited from `src/app/account/layout.tsx`, which wraps
 * every page in this segment. It is deliberately NOT repeated here — a guard
 * duplicated into each page is a guard that eventually gets edited in one place
 * and not the other.
 */
export const dynamic = 'force-dynamic'

export const metadata = pageMetadata(
  'Your profile',
  'Your name, your email and the mobile number you sign in with.',
  '/account/profile',
)

export default async function ProfilePage() {
  const profile = await loadProfile()

  return (
    <main>
      <h2 className="mb-xs mt-0">Your details</h2>
      <p className="text-ink-muted mt-0">
        Two things we ask for, and neither of them is a password. Your name goes on the invoice and
        tells the rider who to ask for. Your email is a spare — a copy you can keep, not the channel
        we rely on.
      </p>

      <div className="mt-lg">
        <ProfileForm
          initialName={profile?.name ?? ''}
          initialEmail={profile?.contactEmail ?? ''}
          phone={profile?.phone ?? ''}
        />
      </div>
    </main>
  )
}
