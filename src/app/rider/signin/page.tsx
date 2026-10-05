import { redirect } from 'next/navigation'

import { RiderSignIn } from '@/components/rider/RiderSignIn'
import { currentRider } from '@/lib/dispatch/session.server'

export const dynamic = 'force-dynamic'

export default async function RiderSignInPage() {
  // An already-signed-in rider has no business on the sign-in screen — redirect
  // rather than render both, so a shared phone does not leave a second sign-in
  // form sitting above somebody else's run.
  const rider = await currentRider()
  if (rider) redirect('/rider')

  return <RiderSignIn />
}