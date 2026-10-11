import type { ReactNode } from 'react'
import { headers } from 'next/headers'

import './globals.css'

import { metadata } from '@/app/metadata'
import SiteHeader from '@/components/SiteHeader'
import AnnouncementBar from '@/components/AnnouncementBar'
import SiteFooter from '@/components/SiteFooter'
import { ToastContainer } from '@/components/ui/Toast'

/**
 * The ROOT layout — required by the App Router, and the only place a global
 * stylesheet may be imported.
 */
export { metadata }

export default async function RootLayout({ children }: { children: ReactNode }) {
  const surface = (await headers()).get('x-upvvan-surface')
  const isStaff = surface === 'staff'

  return (
    <html lang="en">
      <body>
        {!isStaff && (
          <a
            href="#main"
            className="bg-primary text-surface px-base sr-only rounded-sm py-3 font-semibold focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-100"
          >
            Skip to content
          </a>
        )}

        {!isStaff && <AnnouncementBar />}
        {!isStaff && <SiteHeader />}
        {children}
        {!isStaff && <SiteFooter />}
        {!isStaff && <ToastContainer />}
      </body>
    </html>
  )
}
